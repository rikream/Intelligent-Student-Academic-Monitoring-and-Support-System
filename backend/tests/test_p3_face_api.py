from collections.abc import Iterator
import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from backend.app.main import create_app
from backend.app.models import Enrollment, FaceTemplate
from backend.seed import seed_demo_data

TEST_KEY = "p3-test-only-biometric-encryption-key-000000000000"


@pytest.fixture
def client(tmp_path) -> Iterator[TestClient]:
    database_url = f"sqlite:///{tmp_path / 'face-attendance.db'}"
    seed_demo_data(database_url)
    app = create_app(
        database_url,
        demo_login_enabled=True,
        token_secret="face-api-tests-only-secret-longer-than-32-bytes",
        face_template_encryption_key=TEST_KEY,
    )
    with TestClient(app) as test_client:
        yield test_client


def login(client: TestClient, username: str) -> dict[str, str]:
    response = client.post("/api/auth/demo-login", json={"username": username})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def start_session(client: TestClient, professor: dict[str, str]) -> int:
    response = client.post(
        "/api/attendance/sessions",
        headers=professor,
        json={"subject_id": 1},
    )
    assert response.status_code == 201
    return response.json()["id"]


def register_template(
    client: TestClient,
    professor: dict[str, str],
    student_id: int,
    descriptor: list[float],
    *,
    consent: bool = True,
):
    return client.put(
        f"/api/attendance/subjects/1/students/{student_id}/face-template",
        headers=professor,
        json={"descriptor": descriptor, "consent_confirmed": consent},
    )


def test_template_requires_consent_and_is_encrypted(client: TestClient) -> None:
    professor = login(client, "professor.cs")
    descriptor = [0.0] * 128

    missing_consent = register_template(
        client, professor, 1, descriptor, consent=False
    )
    assert missing_consent.status_code == 422
    assert register_template(client, professor, 1, descriptor).status_code == 200

    with client.app.state.session_factory() as db:
        template = db.scalar(select(FaceTemplate))
        assert template is not None
        plaintext = json.dumps(descriptor, separators=(",", ":")).encode()
        assert plaintext not in template.encrypted_descriptor

    session_id = start_session(client, professor)
    statuses = client.get(
        f"/api/attendance/sessions/{session_id}/face-templates",
        headers=professor,
    ).json()
    assert next(item for item in statuses if item["student_id"] == 1)[
        "registered"
    ] is True
    assert all(
        not item["registered"] for item in statuses if item["student_id"] != 1
    )


def test_match_is_only_a_proposal_until_professor_confirms(client: TestClient) -> None:
    professor = login(client, "professor.cs")
    session_id = start_session(client, professor)
    descriptor = [0.0] * 128
    assert register_template(client, professor, 1, descriptor).status_code == 200

    proposal = client.post(
        f"/api/attendance/sessions/{session_id}/face-match",
        headers=professor,
        json={"descriptor": descriptor},
    )

    assert proposal.status_code == 200
    assert proposal.json()["status"] == "proposed"
    assert proposal.json()["candidates"][0]["roll_number"] == "STU001"
    roster = client.get(
        f"/api/attendance/sessions/{session_id}/records",
        headers=professor,
    ).json()
    assert roster[0]["status"] is None


def test_student_face_match_only_compares_the_authenticated_student(
    client: TestClient,
) -> None:
    professor = login(client, "professor.cs")
    student = login(client, "student.001")
    session_id = start_session(client, professor)
    with client.app.state.session_factory() as db:
        db.add(Enrollment(student_id=2, subject_id=1))
        db.commit()
    assert register_template(client, professor, 1, [0.9] * 128).status_code == 200
    assert register_template(client, professor, 2, [0.0] * 128).status_code == 200

    proposal = client.post(
        f"/api/attendance/sessions/{session_id}/face-match",
        headers=student,
        json={"descriptor": [0.0] * 128},
    )

    assert proposal.status_code == 200
    assert proposal.json() == {"status": "unknown", "candidates": []}


def test_student_cannot_face_match_after_professor_ends_session(
    client: TestClient,
) -> None:
    professor = login(client, "professor.cs")
    student = login(client, "student.001")
    session_id = start_session(client, professor)
    assert register_template(client, professor, 1, [0.0] * 128).status_code == 200
    assert client.post(
        f"/api/attendance/sessions/{session_id}/end", headers=professor
    ).status_code == 200

    response = client.post(
        f"/api/attendance/sessions/{session_id}/face-match",
        headers=student,
        json={"descriptor": [0.0] * 128},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "This attendance session has ended."


def test_unknown_and_ambiguous_faces_do_not_propose_a_single_student(
    client: TestClient,
) -> None:
    professor = login(client, "professor.cs")
    session_id = start_session(client, professor)
    assert register_template(client, professor, 1, [0.0] * 128).status_code == 200

    with client.app.state.session_factory() as db:
        if db.scalar(
            select(Enrollment.id).where(
                Enrollment.student_id == 2, Enrollment.subject_id == 1
            )
        ) is None:
            db.add(Enrollment(student_id=2, subject_id=1))
            db.commit()

    assert register_template(client, professor, 2, [0.001] * 128).status_code == 200
    ambiguous = client.post(
        f"/api/attendance/sessions/{session_id}/face-match",
        headers=professor,
        json={"descriptor": [0.0] * 128},
    )
    unknown = client.post(
        f"/api/attendance/sessions/{session_id}/face-match",
        headers=professor,
        json={"descriptor": [1.0] * 128},
    )

    assert ambiguous.json()["status"] == "ambiguous"
    assert len(ambiguous.json()["candidates"]) == 2
    assert unknown.json() == {"status": "unknown", "candidates": []}
    roster = client.get(
        f"/api/attendance/sessions/{session_id}/records",
        headers=professor,
    ).json()
    assert all(entry["status"] is None for entry in roster)


def test_students_can_check_and_remove_only_their_own_template(
    client: TestClient,
) -> None:
    professor = login(client, "professor.cs")
    student = login(client, "student.001")
    assert register_template(client, professor, 1, [0.0] * 128).status_code == 200

    assert client.get("/api/attendance/face-template", headers=student).json() == {
        "student_id": 1,
        "registered": True,
    }
    removed = client.delete("/api/attendance/face-template", headers=student)
    assert removed.status_code == 204
    assert client.get("/api/attendance/face-template", headers=student).json() == {
        "student_id": 1,
        "registered": False,
    }
    assert register_template(client, professor, 1, [0.0] * 128).status_code == 200
    professor_removal = client.delete(
        "/api/attendance/subjects/1/students/1/face-template",
        headers=professor,
    )
    assert professor_removal.status_code == 200
    assert professor_removal.json() == {"student_id": 1, "registered": False}


def test_templates_are_assignment_scoped_and_descriptors_validated(
    client: TestClient,
) -> None:
    math_professor = login(client, "professor.math")
    cs_professor = login(client, "professor.cs")
    session_id = start_session(client, cs_professor)
    forbidden = register_template(
        client, math_professor, 1, [0.0] * 128
    )
    invalid_descriptor = register_template(
        client, cs_professor, 1, [0.0] * 127
    )
    unassigned_match = client.post(
        f"/api/attendance/sessions/{session_id}/face-match",
        headers=math_professor,
        json={"descriptor": [0.0] * 128},
    )

    assert forbidden.status_code == 403
    assert invalid_descriptor.status_code == 422
    assert unassigned_match.status_code == 403


def test_face_registration_requires_persistent_encryption_key(tmp_path) -> None:
    database_url = f"sqlite:///{tmp_path / 'missing-key.db'}"
    seed_demo_data(database_url)
    app = create_app(
        database_url,
        demo_login_enabled=True,
        token_secret="face-api-tests-only-secret-longer-than-32-bytes",
        face_template_encryption_key="",
    )
    with TestClient(app) as client:
        professor = login(client, "professor.cs")
        response = register_template(client, professor, 1, [0.0] * 128)

    assert response.status_code == 503
    assert "FACE_TEMPLATE_ENCRYPTION_KEY" in response.json()["detail"]
