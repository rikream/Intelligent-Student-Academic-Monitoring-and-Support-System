from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, delete, inspect, text

from backend.app.database import create_database, initialize_schema
from backend.app.main import create_app
from backend.app.models import AttendanceRecord, AuditEvent, ClassSession
from backend.seed import seed_demo_data


@pytest.fixture
def client(tmp_path) -> Iterator[TestClient]:
    database_url = f"sqlite:///{tmp_path / 'attendance.db'}"
    seed_demo_data(database_url)
    engine, session_factory = create_database(database_url)
    with session_factory() as db:
        db.execute(delete(AuditEvent))
        db.execute(delete(AttendanceRecord))
        db.execute(delete(ClassSession))
        db.commit()
    engine.dispose()
    app = create_app(
        database_url,
        demo_login_enabled=True,
        token_secret="attendance-tests-only-secret-longer-than-32",
    )
    with TestClient(app) as test_client:
        yield test_client


def login(client: TestClient, username: str) -> dict[str, str]:
    response = client.post("/api/auth/demo-login", json={"username": username})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def create_session(client: TestClient, headers: dict[str, str]) -> int:
    response = client.post(
        "/api/attendance/sessions",
        headers=headers,
        json={"subject_id": 1},
    )
    assert response.status_code == 201
    return response.json()["id"]


def mark(
    client: TestClient,
    headers: dict[str, str],
    session_id: int,
    status: str,
    student_id: int = 1,
):
    return client.post(
        f"/api/attendance/sessions/{session_id}/records",
        headers=headers,
        json={"student_id": student_id, "status": status},
    )


def test_attendance_percentage_and_75_percent_boundary(client: TestClient) -> None:
    professor = login(client, "professor.cs")
    for status in ("present", "present", "present", "absent"):
        mark(client, professor, create_session(client, professor), status)

    student = login(client, "student.001")
    summary = client.get(
        "/api/attendance/subjects/1/summary", headers=student
    ).json()

    assert len(summary) == 1
    assert summary[0]["total_sessions"] == 4
    assert summary[0]["present_sessions"] == 3
    assert summary[0]["attendance_percent"] == 75
    assert summary[0]["alert"] == "warning"
    assert summary[0]["requirement_percent"] == 75


def test_warning_threshold_is_inclusive_and_below_requirement_alerts(
    client: TestClient,
) -> None:
    professor = login(client, "professor.cs")
    statuses = ("present", "present", "present", "present", "absent")
    for status in statuses:
        mark(client, professor, create_session(client, professor), status)

    summary = client.get(
        "/api/attendance/subjects/1/summary",
        headers=login(client, "student.001"),
    ).json()[0]
    assert summary["attendance_percent"] == 80
    assert summary["alert"] == "warning"
    assert summary["warning_percent"] == 80

    sixth_session = create_session(client, professor)
    assert mark(client, professor, sixth_session, "absent").status_code == 201
    below = client.get(
        "/api/attendance/subjects/1/summary",
        headers=login(client, "student.001"),
    ).json()[0]
    assert below["attendance_percent"] == pytest.approx(66.67)
    assert below["alert"] == "below_requirement"


def test_correction_recalculates_and_creates_audit_event(client: TestClient) -> None:
    professor = login(client, "professor.cs")
    session_id = create_session(client, professor)
    assert mark(client, professor, session_id, "absent").status_code == 201

    corrected = client.put(
        f"/api/attendance/sessions/{session_id}/records/1",
        headers=professor,
        json={"status": "present"},
    )
    assert corrected.status_code == 200
    assert corrected.json()["status"] == "present"

    audit = client.get(
        f"/api/attendance/sessions/{session_id}/audit", headers=professor
    )
    assert audit.status_code == 200
    assert len(audit.json()) == 1
    event = audit.json()[0]
    assert event["record_id"] == corrected.json()["id"]
    assert event["actor_username"] == "professor.cs"
    assert event["action"] == "attendance_corrected"
    assert event["before_status"] == "absent"
    assert event["after_status"] == "present"
    summary = client.get(
        "/api/attendance/subjects/1/summary",
        headers=login(client, "student.001"),
    ).json()[0]
    assert summary["attendance_percent"] == 100
    assert summary["alert"] == "ok"


def test_administrator_correction_is_allowed_and_audited(client: TestClient) -> None:
    professor = login(client, "professor.cs")
    admin = login(client, "admin.demo")
    session_id = create_session(client, professor)
    assert mark(client, professor, session_id, "absent").status_code == 201

    response = client.put(
        f"/api/attendance/sessions/{session_id}/records/1",
        headers=admin,
        json={"status": "present"},
    )

    assert response.status_code == 200
    audit = client.get(
        f"/api/attendance/sessions/{session_id}/audit", headers=admin
    ).json()
    assert len(audit) == 1
    assert audit[0]["actor_username"] == "admin.demo"
    assert audit[0]["before_status"] == "absent"
    assert audit[0]["after_status"] == "present"


def test_repeat_same_status_is_idempotent_and_does_not_audit(client: TestClient) -> None:
    professor = login(client, "professor.cs")
    session_id = create_session(client, professor)
    record = mark(client, professor, session_id, "present").json()

    response = client.put(
        f"/api/attendance/sessions/{session_id}/records/1",
        headers=professor,
        json={"status": "present"},
    )

    assert response.status_code == 200
    assert response.json()["id"] == record["id"]
    assert client.get(
        f"/api/attendance/sessions/{session_id}/audit", headers=professor
    ).json() == []


def test_duplicate_records_and_non_enrolled_students_are_rejected(
    client: TestClient,
) -> None:
    professor = login(client, "professor.cs")
    session_id = create_session(client, professor)

    first = mark(client, professor, session_id, "present")
    duplicate = mark(client, professor, session_id, "absent")
    not_enrolled = mark(client, professor, session_id, "present", student_id=2)

    assert first.status_code == 201
    assert duplicate.status_code == 409
    assert not_enrolled.status_code == 422


def test_session_creation_and_writes_are_role_and_assignment_protected(
    client: TestClient,
) -> None:
    cs_professor = login(client, "professor.cs")
    math_professor = login(client, "professor.math")
    student = login(client, "student.001")
    session_id = create_session(client, cs_professor)

    wrong_subject = client.post(
        "/api/attendance/sessions",
        headers=math_professor,
        json={"subject_id": 1},
    )
    student_session = client.post(
        "/api/attendance/sessions",
        headers=student,
        json={"subject_id": 1},
    )
    student_record = mark(client, student, session_id, "present")
    wrong_professor_records = client.get(
        f"/api/attendance/sessions/{session_id}/records",
        headers=math_professor,
    )
    student_other_subject = client.get(
        "/api/attendance/subjects/2/summary", headers=student
    )

    assert wrong_subject.status_code == 403
    assert student_session.status_code == 403
    assert student_record.status_code == 201
    assert wrong_professor_records.status_code == 403
    assert student_other_subject.json() == []


def test_student_can_mark_only_self_in_an_active_session_and_cannot_duplicate(
    client: TestClient,
) -> None:
    professor = login(client, "professor.cs")
    math_professor = login(client, "professor.math")
    student = login(client, "student.001")
    session_id = create_session(client, professor)
    other_subject_session = client.post(
        "/api/attendance/sessions",
        headers=math_professor,
        json={"subject_id": 2},
    )
    assert other_subject_session.status_code == 201

    available_sessions = client.get(
        "/api/attendance/sessions", headers=student
    ).json()
    assert all(item["subject_id"] == 1 for item in available_sessions)
    active_session = next(item for item in available_sessions if item["id"] == session_id)
    assert active_session["is_active"] is True
    assert active_session["professor_name"] == "professor.cs"
    assert active_session["student_status"] is None

    other_student = client.post(
        f"/api/attendance/sessions/{session_id}/records",
        headers=student,
        json={"student_id": 2, "status": "present"},
    )
    absent = client.post(
        f"/api/attendance/sessions/{session_id}/records",
        headers=student,
        json={"student_id": 1, "status": "absent"},
    )
    marked = client.post(
        f"/api/attendance/sessions/{session_id}/records",
        headers=student,
        json={"student_id": 1, "status": "present"},
    )
    duplicate = client.post(
        f"/api/attendance/sessions/{session_id}/records",
        headers=student,
        json={"student_id": 1, "status": "present"},
    )

    assert other_student.status_code == 403
    assert absent.status_code == 403
    assert marked.status_code == 201
    assert duplicate.status_code == 409
    refreshed = client.get(
        "/api/attendance/sessions", headers=student
    ).json()
    updated = next(item for item in refreshed if item["id"] == session_id)
    assert updated["student_status"] == "present"
    summary = client.get(
        "/api/attendance/subjects/1/summary", headers=student
    ).json()[0]
    assert summary["present_sessions"] == 1


def test_professor_can_end_an_active_session_and_students_cannot_join_it(
    client: TestClient,
) -> None:
    professor = login(client, "professor.cs")
    student = login(client, "student.001")
    session_id = create_session(client, professor)

    ended = client.post(
        f"/api/attendance/sessions/{session_id}/end", headers=professor
    )
    student_mark = mark(client, student, session_id, "present")
    student_sessions = client.get(
        "/api/attendance/sessions", headers=student
    ).json()

    assert ended.status_code == 200
    assert ended.json()["is_active"] is False
    assert ended.json()["ended_at"] is not None
    assert student_mark.status_code == 409
    assert next(item for item in student_sessions if item["id"] == session_id)[
        "is_active"
    ] is False


def test_initialize_schema_adds_session_end_time_to_existing_sqlite_table(
    tmp_path,
) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE class_sessions ("
                "id INTEGER PRIMARY KEY, subject_id INTEGER NOT NULL, "
                "created_by_user_id INTEGER NOT NULL, held_at DATETIME NOT NULL)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO class_sessions "
                "(id, subject_id, created_by_user_id, held_at) "
                "VALUES (1, 1, 1, '2026-10-02 10:00:00')"
            )
        )

    initialize_schema(engine)

    columns = {column["name"] for column in inspect(engine).get_columns("class_sessions")}
    with engine.connect() as connection:
        session_count = connection.scalar(
            text("SELECT COUNT(*) FROM class_sessions WHERE ended_at = held_at")
        )
    assert "ended_at" in columns
    assert session_count == 1
    engine.dispose()


def test_session_roster_and_summary_are_role_scoped(client: TestClient) -> None:
    professor = login(client, "professor.cs")
    session_id = create_session(client, professor)
    assert mark(client, professor, session_id, "present").status_code == 201

    professor_roster = client.get(
        f"/api/attendance/sessions/{session_id}/records", headers=professor
    ).json()
    student_roster = client.get(
        f"/api/attendance/sessions/{session_id}/records",
        headers=login(client, "student.001"),
    ).json()
    admin_summary = client.get(
        "/api/attendance/subjects/1/summary",
        headers=login(client, "admin.demo"),
    ).json()

    assert len(professor_roster) > 1
    assert len(student_roster) == 1
    assert student_roster[0]["status"] == "present"
    student_summary = next(
        row for row in admin_summary if row["roll_number"] == "STU001"
    )
    assert student_summary["attendance_percent"] == 100


def test_no_sessions_is_explicit_and_input_is_validated(client: TestClient) -> None:
    student = login(client, "student.001")
    no_sessions = client.get(
        "/api/attendance/subjects/1/summary", headers=student
    ).json()[0]
    assert no_sessions["attendance_percent"] is None
    assert no_sessions["alert"] == "no_sessions"

    professor = login(client, "professor.cs")
    created_session = client.post(
        "/api/attendance/sessions",
        headers=professor,
        json={"subject_id": 1},
    )
    assert created_session.status_code == 201
    invalid = client.post(
        f"/api/attendance/sessions/{created_session.json()['id']}/records",
        headers=professor,
        json={"student_id": 1, "status": "late"},
    )
    assert invalid.status_code == 422
