from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from backend.app.academic import calculate_academic_risk
from backend.app.database import create_database
from backend.app.main import create_app
from backend.app.models import (
    Assessment,
    MarkAuditEvent,
    MarkRecord,
    Notification,
)
from backend.seed import seed_demo_data


@pytest.fixture
def client(tmp_path) -> Iterator[TestClient]:
    database_url = f"sqlite:///{tmp_path / 'academic.db'}"
    seed_demo_data(database_url)
    engine, session_factory = create_database(database_url)
    with session_factory() as db:
        db.execute(delete(MarkAuditEvent))
        db.execute(delete(MarkRecord))
        db.execute(delete(Notification))
        db.execute(delete(Assessment))
        db.commit()
    engine.dispose()
    app = create_app(
        database_url,
        demo_login_enabled=True,
        token_secret="academic-tests-only-secret-longer-than-32",
    )
    with TestClient(app) as test_client:
        yield test_client


def login(client: TestClient, username: str) -> dict[str, str]:
    response = client.post("/api/auth/demo-login", json={"username": username})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_assessment_mark_notification_and_student_privacy(client: TestClient) -> None:
    professor = login(client, "professor.cs")
    student = login(client, "student.001")
    other_student = login(client, "student.002")

    assessment_response = client.post(
        "/api/academic/assessments",
        headers=professor,
        json={"subject_id": 1, "title": "Midterm", "max_score": 40},
    )
    assert assessment_response.status_code == 201
    assessment_id = assessment_response.json()["id"]

    mark_response = client.post(
        "/api/academic/marks",
        headers=professor,
        json={"assessment_id": assessment_id, "student_id": 1, "score": 32},
    )
    assert mark_response.status_code == 201
    assert mark_response.json()["score"] == 32

    overview = client.get(
        "/api/academic/subjects/1/overview", headers=student
    )
    assert overview.status_code == 200
    assert len(overview.json()["marks"]) == 1
    assert overview.json()["risk"][0]["marks_percent"] == 80
    assert overview.json()["risk"][0]["risk_level"] == "low"

    notifications = client.get("/api/notifications", headers=student)
    assert notifications.status_code == 200
    assert notifications.json()[0]["message"] == "CS301 · Midterm: 32 / 40"
    assert client.get("/api/notifications", headers=other_student).json() == []
    read = client.put(
        f"/api/notifications/{notifications.json()[0]['id']}/read",
        headers=other_student,
    )
    assert read.status_code == 404
    read = client.put(
        f"/api/notifications/{notifications.json()[0]['id']}/read",
        headers=student,
    )
    assert read.status_code == 200
    assert read.json()["read_at"] is not None


def test_marks_validation_and_professor_subject_scope(client: TestClient) -> None:
    professor = login(client, "professor.cs")
    other_professor = login(client, "professor.math")
    assessment = client.post(
        "/api/academic/assessments",
        headers=professor,
        json={"subject_id": 1, "title": "Quiz", "max_score": 10},
    ).json()

    above_max = client.post(
        "/api/academic/marks",
        headers=professor,
        json={"assessment_id": assessment["id"], "student_id": 1, "score": 11},
    )
    unauthorized = client.post(
        "/api/academic/marks",
        headers=other_professor,
        json={"assessment_id": assessment["id"], "student_id": 1, "score": 8},
    )
    invalid_assessment = client.post(
        "/api/academic/assessments",
        headers=other_professor,
        json={"subject_id": 1, "title": "Not allowed", "max_score": 10},
    )
    assert above_max.status_code == 422
    assert unauthorized.status_code == 403
    assert invalid_assessment.status_code == 403


def test_missing_academic_data_is_not_scored_as_zero() -> None:
    score, level, factors, recommendation = calculate_academic_risk(None, None)
    assert score is None
    assert level == "insufficient_data"
    assert any("not available" in factor for factor in factors)
    assert "cannot be estimated" in recommendation


def test_partial_and_high_risk_data_are_explained() -> None:
    score, level, factors, recommendation = calculate_academic_risk(70, None)
    assert score == 50
    assert level == "high"
    assert any("partial" in factor for factor in factors)
    assert "70.0%" in recommendation
    assert "Record assessment marks" in recommendation

    score, level, factors, recommendation = calculate_academic_risk(70, 45)
    assert score == 100
    assert level == "high"
    assert len(factors) >= 2
    assert "attendance recovery" in recommendation
    assert "45.0%" in recommendation


def test_risk_recommendations_are_grounded_in_current_data() -> None:
    _, level, _, recommendation = calculate_academic_risk(78, 80)
    assert level == "medium"
    assert "78.0%" in recommendation

    _, level, _, recommendation = calculate_academic_risk(90, 60)
    assert level == "medium"
    assert "60.0%" in recommendation


def test_mark_updates_are_audited_and_access_is_scoped(client: TestClient) -> None:
    professor = login(client, "professor.cs")
    other_professor = login(client, "professor.math")
    student = login(client, "student.001")
    assessment = client.post(
        "/api/academic/assessments",
        headers=professor,
        json={"subject_id": 1, "title": "Final", "max_score": 100},
    ).json()
    created = client.post(
        "/api/academic/marks",
        headers=professor,
        json={"assessment_id": assessment["id"], "student_id": 1, "score": 60},
    ).json()
    updated = client.post(
        "/api/academic/marks",
        headers=professor,
        json={"assessment_id": assessment["id"], "student_id": 1, "score": 75},
    ).json()

    history = client.get(
        f"/api/academic/marks/{created['id']}/audit", headers=professor
    )
    denied = client.get(
        f"/api/academic/marks/{created['id']}/audit", headers=other_professor
    )
    student_history = client.get(
        f"/api/academic/marks/{created['id']}/audit", headers=student
    )
    assert updated["id"] == created["id"]
    assert history.status_code == 200
    assert history.json()[0]["before_score"] == 60
    assert history.json()[0]["after_score"] == 75
    assert denied.status_code == 403
    assert student_history.status_code == 403
