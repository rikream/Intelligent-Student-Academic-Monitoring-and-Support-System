from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app
from backend.seed import seed_demo_data


@pytest.fixture
def client(tmp_path) -> Iterator[TestClient]:
    database_url = f"sqlite:///{tmp_path / 'academic-test.db'}"
    seed_demo_data(database_url)
    app = create_app(
        database_url,
        demo_login_enabled=True,
        token_secret="test-only-secret-that-is-long-enough",
    )
    with TestClient(app) as test_client:
        yield test_client


def login(client: TestClient, username: str) -> dict[str, str]:
    response = client.post("/api/auth/demo-login", json={"username": username})
    assert response.status_code == 200
    payload = response.json()
    assert payload["demo_only"] is True
    return {"Authorization": f"Bearer {payload['access_token']}"}


def test_seeded_users_receive_server_assigned_roles(client: TestClient) -> None:
    response = client.get(
        "/api/auth/me", headers=login(client, "student.001")
    )

    assert response.status_code == 200
    assert response.json()["role"] == "student"


def test_student_professor_and_admin_data_are_role_scoped(client: TestClient) -> None:
    student_headers = login(client, "student.001")
    professor_headers = login(client, "professor.cs")
    admin_headers = login(client, "admin.demo")

    student_rows = client.get("/api/students", headers=student_headers).json()
    professor_rows = client.get("/api/students", headers=professor_headers).json()
    admin_rows = client.get("/api/students", headers=admin_headers).json()

    assert [row["roll_number"] for row in student_rows] == ["STU001"]
    assert "STU001" in {row["roll_number"] for row in professor_rows}
    assert {row["roll_number"] for row in admin_rows} == {
        f"STU{number:03d}" for number in range(1, 31)
    }
    student_enrollments = client.get(
        "/api/enrollments", headers=student_headers
    ).json()
    professor_enrollments = client.get(
        "/api/enrollments", headers=professor_headers
    ).json()
    assert {row["roll_number"] for row in student_enrollments} == {"STU001"}
    assert {row["subject_code"] for row in student_enrollments} == {
        "CS301",
        "CS304",
        "CS307",
    }
    assert all(
        row["subject_code"] in {"CS301", "CS305"}
        for row in professor_enrollments
    )
    assert {row["roll_number"] for row in professor_rows} == {
        row["roll_number"] for row in professor_enrollments
    }
    assert len(professor_rows) < 30
    assert {row["code"] for row in client.get(
        "/api/subjects", headers=professor_headers
    ).json()} == {"CS301", "CS305"}
    assert {row["code"] for row in client.get(
        "/api/subjects", headers=student_headers
    ).json()} == {"CS301", "CS304", "CS307"}


def test_non_admin_cannot_manage_students_subjects_or_enrollments(
    client: TestClient,
) -> None:
    professor_headers = login(client, "professor.cs")

    response = client.post(
        "/api/students",
        headers=professor_headers,
        json={
            "username": "new.student",
            "roll_number": "NEW001",
            "name": "Fictional Student",
            "department": "Computer Science",
            "semester": 3,
        },
    )

    assert response.status_code == 403
    response = client.post(
        "/api/enrollments",
        headers=professor_headers,
        json={"student_id": 1, "subject_id": 1},
    )
    assert response.status_code == 403
    response = client.post(
        "/api/subjects",
        headers=professor_headers,
        json={
            "code": "CS999",
            "name": "Unauthorized Subject",
            "department": "Computer Science",
            "semester": 3,
        },
    )
    assert response.status_code == 403


def test_admin_can_create_records_and_duplicate_rolls_are_rejected(
    client: TestClient,
) -> None:
    headers = login(client, "admin.demo")
    payload = {
        "username": "student.new",
        "roll_number": "NEW001",
        "name": "Fictional Student",
        "department": "Computer Science",
        "semester": 3,
    }

    created = client.post("/api/students", headers=headers, json=payload)
    assert created.status_code == 201
    assert created.json()["roll_number"] == "NEW001"

    duplicate = client.post(
        "/api/students",
        headers=headers,
        json={**payload, "username": "student.other", "roll_number": "new001"},
    )
    assert duplicate.status_code == 409

    subject = client.post(
        "/api/subjects",
        headers=headers,
        json={
            "code": "CS399",
            "name": "Fictional Prototype Subject",
            "department": "Computer Science",
            "semester": 3,
        },
    )
    assert subject.status_code == 201

    enrollment = client.post(
        "/api/enrollments",
        headers=headers,
        json={
            "student_id": created.json()["id"],
            "subject_id": subject.json()["id"],
        },
    )
    assert enrollment.status_code == 201
    assert enrollment.json()["roll_number"] == "NEW001"

    duplicate_enrollment = client.post(
        "/api/enrollments",
        headers=headers,
        json={
            "student_id": created.json()["id"],
            "subject_id": subject.json()["id"],
        },
    )
    assert duplicate_enrollment.status_code == 409


def test_invalid_department_semester_and_missing_enrollments_are_rejected(
    client: TestClient,
) -> None:
    headers = login(client, "admin.demo")
    math_student = client.post(
        "/api/students",
        headers=headers,
        json={
            "username": "math.student",
            "roll_number": "MATH001",
            "name": "Fictional Mathematics Student",
            "department": "Mathematics",
            "semester": 3,
        },
    )
    assert math_student.status_code == 201
    cs_subject_id = next(
        row["id"]
        for row in client.get("/api/subjects", headers=headers).json()
        if row["code"] == "CS301"
    )

    mismatch = client.post(
        "/api/enrollments",
        headers=headers,
        json={"student_id": math_student.json()["id"], "subject_id": cs_subject_id},
    )
    assert mismatch.status_code == 422
    missing = client.post(
        "/api/enrollments",
        headers=headers,
        json={"student_id": 9999, "subject_id": cs_subject_id},
    )
    assert missing.status_code == 404
    invalid_semester = client.post(
        "/api/subjects",
        headers=headers,
        json={
            "code": "CS999",
            "name": "Invalid Semester",
            "department": "Computer Science",
            "semester": 0,
        },
    )
    assert invalid_semester.status_code == 422


def test_access_requires_valid_token_and_login_requires_seeded_user(
    client: TestClient,
) -> None:
    assert client.get("/api/students").status_code == 401
    assert client.get(
        "/api/students", headers={"Authorization": "Bearer invalid"}
    ).status_code == 401
    assert client.post(
        "/api/auth/demo-login", json={"username": "unknown.user"}
    ).status_code == 401


def test_seed_is_idempotent_and_database_survives_app_restart(tmp_path) -> None:
    database_url = f"sqlite:///{tmp_path / 'persistent.db'}"
    seed_demo_data(database_url)
    seed_demo_data(database_url)

    first_app = create_app(
        database_url,
        demo_login_enabled=True,
        token_secret="test-only-secret-that-is-long-enough",
    )
    with TestClient(first_app) as first_client:
        headers = login(first_client, "admin.demo")
        created = first_client.post(
            "/api/students",
            headers=headers,
            json={
                "username": "persistent.student",
                "roll_number": "PERSIST001",
                "name": "Fictional Persistent Student",
                "department": "Computer Science",
                "semester": 3,
            },
        )
        assert created.status_code == 201

    second_app = create_app(
        database_url,
        demo_login_enabled=True,
        token_secret="test-only-secret-that-is-long-enough",
    )
    with TestClient(second_app) as second_client:
        rows = second_client.get(
            "/api/students", headers=login(second_client, "admin.demo")
        ).json()
        assert any(row["roll_number"] == "PERSIST001" for row in rows)


def test_demo_login_can_be_disabled(tmp_path) -> None:
    app = create_app(
        f"sqlite:///{tmp_path / 'disabled.db'}",
        demo_login_enabled=False,
        token_secret="test-only-secret-that-is-long-enough",
    )
    with TestClient(app) as client:
        response = client.post(
            "/api/auth/demo-login", json={"username": "admin.demo"}
        )

    assert response.status_code == 403
