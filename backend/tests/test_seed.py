from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from backend.app.database import create_database
from backend.app.main import create_app
from backend.app.models import (
    Assessment,
    AuditEvent,
    AttendanceRecord,
    AttendanceStatus,
    ClassSession,
    Enrollment,
    MarkAuditEvent,
    MarkRecord,
    Notification,
    ProfessorSubject,
    Student,
    Subject,
    User,
)
from backend.seed import seed_demo_data

PROFESSOR_COURSES = {
    "professor.cs": {"CS301", "CS305"},
    "professor.math": {"CS302"},
    "professor.kavya.iyer": {"CS303", "CS308"},
    "professor.rahul.menon": {"CS304"},
    "professor.neha.sharma": {"CS306"},
    "professor.vikram.nair": {"CS307"},
}


def _counts(session_factory) -> dict[str, int]:
    with session_factory() as db:
        return {
            "users": db.scalar(select(func.count(User.id))) or 0,
            "students": db.scalar(select(func.count(Student.id))) or 0,
            "subjects": db.scalar(select(func.count(Subject.id))) or 0,
            "professor_assignments": db.scalar(
                select(func.count(ProfessorSubject.id))
            )
            or 0,
            "enrollments": db.scalar(select(func.count(Enrollment.id))) or 0,
            "sessions": db.scalar(select(func.count(ClassSession.id))) or 0,
            "active_sessions": db.scalar(
                select(func.count(ClassSession.id)).where(ClassSession.ended_at.is_(None))
            )
            or 0,
            "attendance_records": db.scalar(
                select(func.count(AttendanceRecord.id))
            )
            or 0,
            "assessments": db.scalar(select(func.count(Assessment.id))) or 0,
            "marks": db.scalar(select(func.count(MarkRecord.id))) or 0,
            "notifications": db.scalar(select(func.count(Notification.id))) or 0,
        }


def test_expanded_seed_is_complete_and_idempotent(tmp_path) -> None:
    database_url = f"sqlite:///{tmp_path / 'expanded-seed.db'}"
    seed_demo_data(database_url)
    engine, session_factory = create_database(database_url)
    first_counts = _counts(session_factory)

    assert first_counts["users"] == 37
    assert first_counts["students"] == 30
    assert first_counts["subjects"] == 8
    assert first_counts["professor_assignments"] == 8
    assert first_counts["enrollments"] == 120
    assert first_counts["sessions"] == 64
    assert first_counts["attendance_records"] == 960
    assert first_counts["assessments"] == 32
    assert first_counts["marks"] == 480

    with session_factory() as db:
        enrollment_counts = db.execute(
            select(Enrollment.student_id, func.count(Enrollment.id)).group_by(
                Enrollment.student_id
            )
        ).all()
        course_counts = db.execute(
            select(Enrollment.subject_id, func.count(Enrollment.id)).group_by(
                Enrollment.subject_id
            )
        ).all()
        enrollments_by_course = dict(
            db.execute(
                select(Subject.code, func.count(Enrollment.id))
                .join(Enrollment, Enrollment.subject_id == Subject.id)
                .group_by(Subject.code)
            ).all()
        )
        notification_counts = dict(
            db.execute(
                select(Notification.title, func.count(Notification.id)).group_by(
                    Notification.title
                )
            ).all()
        )
        assert all(3 <= count <= 5 for _, count in enrollment_counts)
        assert all(count > 1 for _, count in course_counts)
        assert enrollments_by_course == {
            "CS301": 14,
            "CS302": 15,
            "CS303": 15,
            "CS304": 15,
            "CS305": 16,
            "CS306": 14,
            "CS307": 15,
            "CS308": 16,
        }
        assert notification_counts == {
            "Academic risk warning": 64,
            "Attendance below requirement": 36,
            "New assessment mark": 120,
        }
        assert sum(notification_counts.values()) == 220

    seed_demo_data(database_url)
    assert _counts(session_factory) == first_counts
    engine.dispose()


def test_seed_replaces_stale_sessions_marks_and_notifications(tmp_path) -> None:
    database_url = f"sqlite:///{tmp_path / 'reset-seed.db'}"
    seed_demo_data(database_url)
    engine, session_factory = create_database(database_url)

    with session_factory() as db:
        professor = db.scalar(select(User).where(User.username == "professor.cs"))
        student = db.scalar(select(Student).where(Student.roll_number == "STU001"))
        subject = db.scalar(select(Subject).where(Subject.code == "CS301"))
        assert professor is not None and student is not None and subject is not None

        stale_sessions = [
            ClassSession(
                subject_id=subject.id,
                created_by_user_id=professor.id,
                held_at=datetime(2026, 10, 3, hour=1, minute=index, tzinfo=timezone.utc),
            )
            for index in (10, 20)
        ]
        db.add_all(stale_sessions)
        db.flush()
        stale_records = [
            AttendanceRecord(
                session_id=class_session.id,
                student_id=student.id,
                status=AttendanceStatus.PRESENT,
                recorded_by_user_id=professor.id,
            )
            for class_session in stale_sessions
        ]
        db.add_all(stale_records)
        db.flush()
        db.add_all(
            [
                AuditEvent(
                    class_session_id=record.session_id,
                    attendance_record_id=record.id,
                    actor_user_id=professor.id,
                    action="corrected",
                    before_value={"status": "absent"},
                    after_value={"status": "present"},
                )
                for record in stale_records
            ]
        )
        stale_assessment = Assessment(
            subject_id=subject.id,
            title="Demo Midterm 2026",
            max_score=40,
            created_by_user_id=professor.id,
        )
        db.add(stale_assessment)
        db.flush()
        stale_mark = MarkRecord(
            assessment_id=stale_assessment.id,
            student_id=student.id,
            score=18,
            updated_by_user_id=professor.id,
        )
        db.add(stale_mark)
        db.flush()
        db.add(
            MarkAuditEvent(
                mark_record_id=stale_mark.id,
                actor_user_id=professor.id,
                before_score=None,
                after_score=18,
            )
        )
        db.add(
            Notification(
                student_id=student.id,
                title="New assessment mark",
                message="CS301 · Demo Midterm 2026: 18 / 40",
            )
        )
        db.commit()

    seed_demo_data(database_url)
    assert _counts(session_factory) == {
        "users": 37,
        "students": 30,
        "subjects": 8,
        "professor_assignments": 8,
        "enrollments": 120,
        "sessions": 64,
        "active_sessions": 0,
        "attendance_records": 960,
        "assessments": 32,
        "marks": 480,
        "notifications": 220,
    }
    with session_factory() as db:
        assert db.scalar(
            select(func.count(Assessment.id)).where(
                Assessment.title == "Demo Midterm 2026"
            )
        ) == 0
        assert db.scalar(select(func.count(AuditEvent.id))) == 0
        assert db.scalar(select(func.count(MarkAuditEvent.id))) == 0
        assert db.scalar(
            select(func.count(Notification.id)).where(
                Notification.message.contains("Demo Midterm 2026")
            )
        ) == 0
    engine.dispose()


def test_seeded_roles_and_academic_views_are_scoped(tmp_path) -> None:
    database_url = f"sqlite:///{tmp_path / 'scoped-seed.db'}"
    seed_demo_data(database_url)
    app = create_app(
        database_url,
        demo_login_enabled=True,
        token_secret="expanded-seed-test-secret-longer-than-32-bytes",
    )

    with TestClient(app) as client:
        def login(username: str) -> dict[str, str]:
            response = client.post(
                "/api/auth/demo-login", json={"username": username}
            )
            assert response.status_code == 200
            return {"Authorization": f"Bearer {response.json()['access_token']}"}

        admin = login("admin.demo")
        assert len(client.get("/api/students", headers=admin).json()) == 30
        assert len(client.get("/api/subjects", headers=admin).json()) == 8
        assert len(client.get("/api/enrollments", headers=admin).json()) == 120

        for username, expected_codes in PROFESSOR_COURSES.items():
            headers = login(username)
            visible_codes = {
                subject["code"]
                for subject in client.get("/api/subjects", headers=headers).json()
            }
            assert visible_codes == expected_codes
            visible_students = client.get("/api/students", headers=headers).json()
            assert visible_students
            assert len(visible_students) < 30

        student = login("student.001")
        student_subjects = client.get("/api/subjects", headers=student).json()
        student_codes = {subject["code"] for subject in student_subjects}
        enrollment_codes = {
            row["subject_code"]
            for row in client.get("/api/enrollments", headers=student).json()
        }
        assert student_codes == enrollment_codes
        sessions = client.get("/api/attendance/sessions", headers=student).json()
        assert {session["subject_code"] for session in sessions} == student_codes
        assert all(session["is_active"] is False for session in sessions)

        professor = login("professor.cs")
        active = client.post(
            "/api/attendance/sessions",
            headers=professor,
            json={"subject_id": next(
                subject["id"]
                for subject in client.get("/api/subjects", headers=professor).json()
                if subject["code"] == "CS301"
            )},
        )
        assert active.status_code == 201
        active_session_id = active.json()["id"]
        enrolled_sessions = client.get(
            "/api/attendance/sessions", headers=student
        ).json()
        not_enrolled_sessions = client.get(
            "/api/attendance/sessions", headers=login("student.002")
        ).json()
        assert any(item["id"] == active_session_id for item in enrolled_sessions)
        assert all(item["id"] != active_session_id for item in not_enrolled_sessions)

        risk_levels: set[str] = set()
        attendance_values: set[float] = set()
        mark_values: set[float] = set()
        for subject in student_subjects:
            overview = client.get(
                f"/api/academic/subjects/{subject['id']}/overview",
                headers=admin,
            ).json()
            risk_levels.update(row["risk_level"] for row in overview["risk"])
            attendance_values.update(
                row["attendance_percent"]
                for row in overview["risk"]
                if row["attendance_percent"] is not None
            )
            mark_values.update(
                row["marks_percent"]
                for row in overview["risk"]
                if row["marks_percent"] is not None
            )
        assert {"low", "medium", "high"} <= risk_levels
        assert len(attendance_values) > 1
        assert len(mark_values) > 1

        my_marks = {
            mark["student_id"]
            for subject in student_subjects
            for mark in client.get(
                f"/api/academic/subjects/{subject['id']}/overview",
                headers=student,
            ).json()["marks"]
        }
        assert my_marks == {1}
        notifications = client.get("/api/notifications", headers=student).json()
        assert notifications
        assert all(
            notification["message"].split(" · ", maxsplit=1)[0]
            in student_codes
            for notification in notifications
        )
        other_notifications = client.get(
            "/api/notifications", headers=login("student.002")
        ).json()
        assert {item["message"] for item in notifications} != {
            item["message"] for item in other_notifications
        }
