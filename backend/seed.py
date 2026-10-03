from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from backend.app.academic import calculate_academic_risk
from backend.app.config import DATABASE_URL
from backend.app.database import create_database, initialize_schema
from backend.app.models import (
    Assessment,
    AuditEvent,
    AttendanceRecord,
    AttendanceStatus,
    ClassSession,
    Enrollment,
    FaceTemplate,
    MarkRecord,
    MarkAuditEvent,
    Notification,
    ProfessorSubject,
    Role,
    Student,
    Subject,
    User,
)

STUDENTS = (
    ("Aarav Rao", "student.001"),
    ("Mira Shah", "student.002"),
    ("Ishan Kulkarni", "student.003"),
    ("Anika Sen", "student.004"),
    ("Vihaan Desai", "student.005"),
    ("Tara Menon", "student.006"),
    ("Kabir Nair", "student.007"),
    ("Siya Kapoor", "student.008"),
    ("Rohan Bhat", "student.009"),
    ("Diya Iyer", "student.010"),
    ("Arjun Pillai", "student.011"),
    ("Meera Joshi", "student.012"),
    ("Nikhil Verma", "student.013"),
    ("Ira Chawla", "student.014"),
    ("Dev Malhotra", "student.015"),
    ("Sana Qureshi", "student.016"),
    ("Aditya Bose", "student.017"),
    ("Kavya Reddy", "student.018"),
    ("Neil D'Souza", "student.019"),
    ("Aditi Ghosh", "student.020"),
    ("Reyansh Sethi", "student.021"),
    ("Pia Narang", "student.022"),
    ("Kunal Shetty", "student.023"),
    ("Rhea Mukherjee", "student.024"),
    ("Dhruv Anand", "student.025"),
    ("Naina Joseph", "student.026"),
    ("Samar Chatterjee", "student.027"),
    ("Myra Khanna", "student.028"),
    ("Yash Prasad", "student.029"),
    ("Leela Thomas", "student.030"),
)

COURSES = (
    ("CS301", "Data Structures", "professor.cs"),
    ("CS302", "Database Management Systems", "professor.math"),
    ("CS303", "Operating Systems", "professor.kavya.iyer"),
    ("CS304", "Computer Networks", "professor.rahul.menon"),
    ("CS305", "Object Oriented Programming", "professor.cs"),
    ("CS306", "Machine Learning", "professor.neha.sharma"),
    ("CS307", "Web Technologies", "professor.vikram.nair"),
    ("CS308", "Software Engineering", "professor.kavya.iyer"),
)

PROFESSORS = (
    ("professor.cs", Role.PROFESSOR),
    ("professor.math", Role.PROFESSOR),
    ("professor.kavya.iyer", Role.PROFESSOR),
    ("professor.rahul.menon", Role.PROFESSOR),
    ("professor.neha.sharma", Role.PROFESSOR),
    ("professor.vikram.nair", Role.PROFESSOR),
)

ASSESSMENTS = (
    ("Internal Assessment 1", 20),
    ("Midterm", 40),
    ("Internal Assessment 2", 20),
    ("Quiz", 20),
)

SESSIONS_PER_COURSE = 8
LEGACY_STUDENT_ROLLS = {"student.001": "DEMO001", "student.002": "DEMO002"}
RETIRED_DEMO_STUDENTS = (("rick", "24cs271"), ("rupon", "24cs277"))
RETIRED_DEMO_SUBJECT_CODES = ("MA301", "U21CS505")


def _has_user_references(db: Session, user_id: int) -> bool:
    references = (
        (Student, Student.user_id),
        (ProfessorSubject, ProfessorSubject.professor_id),
        (ClassSession, ClassSession.created_by_user_id),
        (AttendanceRecord, AttendanceRecord.recorded_by_user_id),
        (FaceTemplate, FaceTemplate.registered_by_user_id),
        (Assessment, Assessment.created_by_user_id),
        (MarkRecord, MarkRecord.updated_by_user_id),
        (AuditEvent, AuditEvent.actor_user_id),
        (MarkAuditEvent, MarkAuditEvent.actor_user_id),
    )
    return any(
        db.scalar(select(model.id).where(column == user_id).limit(1)) is not None
        for model, column in references
    )


def _reset_seeded_academic_data(db: Session) -> None:
    seed_usernames = [username for _, username in STUDENTS]
    retired_rolls = dict(RETIRED_DEMO_STUDENTS)
    retired_users = db.scalars(
        select(User).where(User.username.in_(retired_rolls))
    ).all()
    retired_students: dict[int, Student] = {}
    for user in retired_users:
        expected_roll = retired_rolls[user.username]
        if user.role != Role.STUDENT:
            raise ValueError(
                f"Retired demo username {user.username!r} is not a student account."
            )
        student = db.scalar(select(Student).where(Student.user_id == user.id))
        if student is not None:
            if student.roll_number != expected_roll:
                raise ValueError(
                    f"Retired demo username {user.username!r} has an unexpected profile."
                )
            retired_students[user.id] = student

    retired_student_ids = set(retired_students)
    if retired_student_ids and db.scalar(
        select(FaceTemplate.id)
        .where(FaceTemplate.student_id.in_(retired_student_ids))
        .limit(1)
    ) is not None:
        raise ValueError(
            "A retired demo student has a registered face template; "
            "remove or retain that student explicitly before resetting the seed."
        )

    subject_codes = [code for code, _, _ in COURSES] + list(
        RETIRED_DEMO_SUBJECT_CODES
    )
    subject_ids = set(
        db.scalars(select(Subject.id).where(Subject.code.in_(subject_codes))).all()
    )
    seed_student_ids = set(
        db.scalars(
            select(Student.id)
            .join(User, User.id == Student.user_id)
            .where(User.username.in_(seed_usernames))
        ).all()
    )
    reset_student_ids = seed_student_ids | retired_student_ids

    session_ids = set()
    assessment_ids = set()
    if subject_ids:
        session_ids = set(
            db.scalars(
                select(ClassSession.id).where(
                    ClassSession.subject_id.in_(subject_ids)
                )
            ).all()
        )
        assessment_ids = set(
            db.scalars(
                select(Assessment.id).where(Assessment.subject_id.in_(subject_ids))
            ).all()
        )

    attendance_conditions = []
    if session_ids:
        attendance_conditions.append(AttendanceRecord.session_id.in_(session_ids))
    if retired_student_ids:
        attendance_conditions.append(
            AttendanceRecord.student_id.in_(retired_student_ids)
        )
    attendance_ids = set()
    if attendance_conditions:
        attendance_ids = set(
            db.scalars(
                select(AttendanceRecord.id).where(or_(*attendance_conditions))
            ).all()
        )

    mark_conditions = []
    if assessment_ids:
        mark_conditions.append(MarkRecord.assessment_id.in_(assessment_ids))
    if retired_student_ids:
        mark_conditions.append(MarkRecord.student_id.in_(retired_student_ids))
    mark_ids = set()
    if mark_conditions:
        mark_ids = set(
            db.scalars(select(MarkRecord.id).where(or_(*mark_conditions))).all()
        )

    affected_student_ids = set(reset_student_ids)
    if subject_ids:
        affected_student_ids.update(
            db.scalars(
                select(Enrollment.student_id).where(
                    Enrollment.subject_id.in_(subject_ids)
                )
            ).all()
        )
    if attendance_ids:
        affected_student_ids.update(
            db.scalars(
                select(AttendanceRecord.student_id).where(
                    AttendanceRecord.id.in_(attendance_ids)
                )
            ).all()
        )
    if mark_ids:
        affected_student_ids.update(
            db.scalars(
                select(MarkRecord.student_id).where(MarkRecord.id.in_(mark_ids))
            ).all()
        )
    if affected_student_ids:
        db.execute(
            delete(Notification).where(
                Notification.student_id.in_(affected_student_ids)
            )
        )

    audit_conditions = []
    if session_ids:
        audit_conditions.append(AuditEvent.class_session_id.in_(session_ids))
    if attendance_ids:
        audit_conditions.append(AuditEvent.attendance_record_id.in_(attendance_ids))
    if audit_conditions:
        db.execute(delete(AuditEvent).where(or_(*audit_conditions)))
    if attendance_conditions:
        db.execute(delete(AttendanceRecord).where(or_(*attendance_conditions)))
    if session_ids:
        db.execute(delete(ClassSession).where(ClassSession.id.in_(session_ids)))

    if mark_ids:
        db.execute(
            delete(MarkAuditEvent).where(MarkAuditEvent.mark_record_id.in_(mark_ids))
        )
        db.execute(delete(MarkRecord).where(MarkRecord.id.in_(mark_ids)))
    if subject_ids:
        db.execute(delete(Assessment).where(Assessment.subject_id.in_(subject_ids)))

    enrollment_conditions = []
    if subject_ids:
        enrollment_conditions.append(Enrollment.subject_id.in_(subject_ids))
    if reset_student_ids:
        enrollment_conditions.append(Enrollment.student_id.in_(reset_student_ids))
    if enrollment_conditions:
        db.execute(delete(Enrollment).where(or_(*enrollment_conditions)))
    if subject_ids:
        db.execute(
            delete(ProfessorSubject).where(
                ProfessorSubject.subject_id.in_(subject_ids)
            )
        )

    for student in retired_students.values():
        db.delete(student)
    retired_subjects = db.scalars(
        select(Subject).where(Subject.code.in_(RETIRED_DEMO_SUBJECT_CODES))
    ).all()
    for subject in retired_subjects:
        db.delete(subject)

    db.flush()
    for user in retired_users:
        if not _has_user_references(db, user.id):
            db.delete(user)


def _get_or_create_user(db, username: str, role: Role) -> User:
    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        user = User(username=username, role=role)
        db.add(user)
    elif user.role != role:
        raise ValueError(f"Demo username {username!r} already has a different role.")
    return user


def _student_course_indexes(student_index: int) -> tuple[int, ...]:
    course_count = 3 + student_index % 3
    start = student_index * 3 % len(COURSES)
    return tuple(
        (start + offset * 3) % len(COURSES) for offset in range(course_count)
    )


def _academic_tier(student_index: int) -> str:
    if student_index < 9:
        return "low"
    if student_index < 21:
        return "medium"
    return "high"


def _present_count(student_index: int, course_index: int) -> int:
    tier = _academic_tier(student_index)
    if tier == "low":
        return 7 + (student_index + course_index) % 2
    if tier == "medium":
        return 6 + (student_index + course_index) % 2
    return 4 + (student_index + course_index) % 2


def _score(
    max_score: float, student_index: int, course_index: int, assessment_index: int
) -> float:
    variation = (
        student_index * 7 + course_index * 11 + assessment_index * 5
    ) % 21
    tier = _academic_tier(student_index)
    if tier == "low":
        percent = 78 + variation
    elif tier == "medium":
        percent = 52 + variation % 14
    else:
        percent = 30 + variation % 27
    return round(max_score * percent / 100, 1)


def _ensure_notification(
    db: Session,
    existing_notifications: set[tuple[int, str, str]],
    student_id: int,
    title: str,
    message: str,
) -> None:
    key = (student_id, title, message)
    if key not in existing_notifications:
        db.add(
            Notification(
                student_id=student_id,
                title=title,
                message=message,
            )
        )
        existing_notifications.add(key)


def seed_demo_data(database_url: str = DATABASE_URL) -> None:
    engine, session_factory = create_database(database_url)
    initialize_schema(engine)
    with session_factory() as db:
        _reset_seeded_academic_data(db)
        _get_or_create_user(db, "admin.demo", Role.ADMINISTRATOR)
        professor_users = {
            username: _get_or_create_user(db, username, role)
            for username, role in PROFESSORS
        }
        student_users = {
            username: _get_or_create_user(db, username, Role.STUDENT)
            for _, username in STUDENTS
        }
        db.flush()

        student_models: dict[str, Student] = {}
        for student_index, (name, username) in enumerate(STUDENTS):
            expected_roll = f"STU{student_index + 1:03d}"
            student = db.scalar(
                select(Student).where(Student.user_id == student_users[username].id)
            )
            if student is None:
                conflicting_roll = db.scalar(
                    select(Student).where(Student.roll_number == expected_roll)
                )
                if conflicting_roll is not None:
                    raise ValueError(
                        f"Roll number {expected_roll!r} belongs to another account."
                    )
                student = Student(
                    user_id=student_users[username].id,
                    roll_number=expected_roll,
                    name=name,
                    department="Computer Science",
                    semester=3,
                )
                db.add(student)
            elif username in LEGACY_STUDENT_ROLLS and student.roll_number in {
                LEGACY_STUDENT_ROLLS[username],
                expected_roll,
            }:
                student.roll_number = expected_roll
                student.name = name
                student.department = "Computer Science"
                student.semester = 3
            elif (
                student.roll_number != expected_roll
                or student.name != name
                or student.department != "Computer Science"
                or student.semester != 3
            ):
                raise ValueError(
                    f"Existing profile for {username!r} conflicts with the demo seed."
                )
            student_models[username] = student
        db.flush()

        subject_models: dict[str, Subject] = {}
        for code, name, _ in COURSES:
            subject = db.scalar(select(Subject).where(Subject.code == code))
            if subject is None:
                subject = Subject(
                    code=code,
                    name=name,
                    department="Computer Science",
                    semester=3,
                )
                db.add(subject)
            elif (
                subject.name != name
                or subject.department != "Computer Science"
                or subject.semester != 3
            ):
                raise ValueError(
                    f"Existing subject {code!r} conflicts with the demo seed."
                )
            subject_models[code] = subject
        db.flush()

        professor_by_course: dict[str, User] = {}
        for course in COURSES:
            code = course[0]
            professor_username = course[2]
            professor = professor_users[professor_username]
            subject = subject_models[code]
            professor_by_course[code] = professor
            if db.scalar(
                select(ProfessorSubject.id).where(
                    ProfessorSubject.professor_id == professor.id,
                    ProfessorSubject.subject_id == subject.id,
                )
            ) is None:
                db.add(
                    ProfessorSubject(
                        professor_id=professor.id,
                        subject_id=subject.id,
                    )
                )

        enrollment_keys = {
            (student_id, subject_id)
            for student_id, subject_id in db.execute(
                select(Enrollment.student_id, Enrollment.subject_id)
            ).all()
        }
        for student_index, student_data in enumerate(STUDENTS):
            username = student_data[1]
            student = student_models[username]
            for course_index in _student_course_indexes(student_index):
                subject = subject_models[COURSES[course_index][0]]
                key = (student.id, subject.id)
                if key not in enrollment_keys:
                    db.add(Enrollment(student_id=student.id, subject_id=subject.id))
                    enrollment_keys.add(key)
        db.flush()

        subject_ids = [subject.id for subject in subject_models.values()]
        assessment_models = db.scalars(
            select(Assessment).where(Assessment.subject_id.in_(subject_ids))
        ).all()
        assessment_keys = {
            (item.subject_id, item.title, item.created_by_user_id): item
            for item in assessment_models
        }
        assessments_by_course: dict[str, list[Assessment]] = {}
        for course_index, course in enumerate(COURSES):
            code = course[0]
            subject = subject_models[code]
            professor = professor_by_course[code]
            course_assessments: list[Assessment] = []
            for title, max_score in ASSESSMENTS:
                key = (subject.id, title, professor.id)
                assessment = assessment_keys.get(key)
                if assessment is None:
                    assessment = Assessment(
                        subject_id=subject.id,
                        title=title,
                        max_score=max_score,
                        created_by_user_id=professor.id,
                    )
                    db.add(assessment)
                    assessment_keys[key] = assessment
                elif assessment.max_score != max_score:
                    raise ValueError(
                        f"Existing assessment {code} · {title} has a different maximum."
                    )
                course_assessments.append(assessment)
            assessments_by_course[code] = course_assessments
        db.flush()

        student_ids = [student.id for student in student_models.values()]
        mark_models = db.scalars(
            select(MarkRecord)
            .join(Assessment, Assessment.id == MarkRecord.assessment_id)
            .where(
                Assessment.subject_id.in_(subject_ids),
                MarkRecord.student_id.in_(student_ids),
            )
        ).all()
        marks_by_key = {
            (mark.assessment_id, mark.student_id): mark for mark in mark_models
        }
        existing_notifications = {
            (student_id, title, message)
            for student_id, title, message in db.execute(
                select(
                    Notification.student_id,
                    Notification.title,
                    Notification.message,
                ).where(Notification.student_id.in_(student_ids))
            ).all()
        }
        for student_index, student_data in enumerate(STUDENTS):
            username = student_data[1]
            student = student_models[username]
            for course_index in _student_course_indexes(student_index):
                code = COURSES[course_index][0]
                assessments = assessments_by_course[code]
                for assessment_index, assessment in enumerate(assessments):
                    mark = marks_by_key.get((assessment.id, student.id))
                    if mark is None:
                        mark = MarkRecord(
                            assessment_id=assessment.id,
                            student_id=student.id,
                            score=_score(
                                assessment.max_score,
                                student_index,
                                course_index,
                                assessment_index,
                            ),
                            updated_by_user_id=professor_by_course[code].id,
                        )
                        db.add(mark)
                        marks_by_key[(assessment.id, student.id)] = mark
                    if assessment_index == len(assessments) - 1:
                        _ensure_notification(
                            db,
                            existing_notifications,
                            student.id,
                            "New assessment mark",
                            (
                                f"{code} · {assessment.title}: "
                                f"{mark.score:g} / {assessment.max_score:g}"
                            ),
                        )

        historical_sessions: dict[str, list[ClassSession]] = {}
        base_date = datetime(2026, 8, 10, 9, tzinfo=timezone.utc)
        existing_sessions = db.scalars(
            select(ClassSession).where(ClassSession.subject_id.in_(subject_ids))
        ).all()
        session_by_key = {
            (
                item.subject_id,
                item.created_by_user_id,
                item.held_at.replace(tzinfo=None),
            ): item
            for item in existing_sessions
        }
        for course_index, course in enumerate(COURSES):
            code = course[0]
            subject = subject_models[code]
            professor = professor_by_course[code]
            course_sessions: list[ClassSession] = []
            for session_index in range(SESSIONS_PER_COURSE):
                held_at = base_date + timedelta(
                    days=course_index + session_index * 2
                )
                key = (subject.id, professor.id, held_at.replace(tzinfo=None))
                class_session = session_by_key.get(key)
                if class_session is None:
                    class_session = ClassSession(
                        subject_id=subject.id,
                        created_by_user_id=professor.id,
                        held_at=held_at,
                        ended_at=held_at + timedelta(minutes=50),
                    )
                    db.add(class_session)
                    session_by_key[key] = class_session
                course_sessions.append(class_session)
            historical_sessions[code] = course_sessions
        db.flush()

        session_ids = [
            item.id
            for sessions in historical_sessions.values()
            for item in sessions
        ]
        attendance_keys = {
            (session_id, student_id)
            for session_id, student_id in db.execute(
                select(AttendanceRecord.session_id, AttendanceRecord.student_id).where(
                    AttendanceRecord.session_id.in_(session_ids),
                    AttendanceRecord.student_id.in_(student_ids),
                )
            ).all()
        }
        for student_index, student_data in enumerate(STUDENTS):
            username = student_data[1]
            student = student_models[username]
            for course_index in _student_course_indexes(student_index):
                code = COURSES[course_index][0]
                sessions = historical_sessions[code]
                present_count = _present_count(student_index, course_index)
                for session_index, class_session in enumerate(sessions):
                    key = (class_session.id, student.id)
                    if key not in attendance_keys:
                        present = (
                            (session_index + student_index + course_index)
                            % SESSIONS_PER_COURSE
                        ) < present_count
                        db.add(
                            AttendanceRecord(
                                session_id=class_session.id,
                                student_id=student.id,
                                status=(
                                    AttendanceStatus.PRESENT
                                    if present
                                    else AttendanceStatus.ABSENT
                                ),
                                recorded_by_user_id=professor_by_course[code].id,
                            )
                        )
                        attendance_keys.add(key)

        db.flush()
        session_totals = dict(
            db.execute(
                select(ClassSession.subject_id, func.count(ClassSession.id))
                .where(ClassSession.subject_id.in_(subject_ids))
                .group_by(ClassSession.subject_id)
            ).all()
        )
        present_totals = {
            (student_id, subject_id): count
            for student_id, subject_id, count in db.execute(
                select(
                    AttendanceRecord.student_id,
                    ClassSession.subject_id,
                    func.count(AttendanceRecord.id),
                )
                .join(ClassSession, ClassSession.id == AttendanceRecord.session_id)
                .where(
                    AttendanceRecord.student_id.in_(student_ids),
                    ClassSession.subject_id.in_(subject_ids),
                    AttendanceRecord.status == AttendanceStatus.PRESENT,
                )
                .group_by(AttendanceRecord.student_id, ClassSession.subject_id)
            ).all()
        }
        mark_totals: dict[tuple[int, int], list[float]] = {}
        for student_id, subject_id, score, max_score in db.execute(
            select(
                MarkRecord.student_id,
                Assessment.subject_id,
                MarkRecord.score,
                Assessment.max_score,
            )
            .join(Assessment, Assessment.id == MarkRecord.assessment_id)
            .where(
                MarkRecord.student_id.in_(student_ids),
                Assessment.subject_id.in_(subject_ids),
            )
        ).all():
            mark_totals.setdefault((student_id, subject_id), []).append(
                score / max_score * 100
            )

        for student_index, student_data in enumerate(STUDENTS):
            username = student_data[1]
            student = student_models[username]
            for course_index in _student_course_indexes(student_index):
                code = COURSES[course_index][0]
                subject = subject_models[code]
                total_sessions = session_totals.get(subject.id, 0)
                present_sessions = present_totals.get((student.id, subject.id), 0)
                attendance_percent = (
                    round(present_sessions * 100 / total_sessions, 2)
                    if total_sessions
                    else None
                )
                mark_percentages = mark_totals.get((student.id, subject.id), [])
                marks_percent = (
                    round(sum(mark_percentages) / len(mark_percentages), 2)
                    if mark_percentages
                    else None
                )
                risk_result = calculate_academic_risk(
                    attendance_percent, marks_percent
                )
                level = risk_result[1]
                factors = risk_result[2]
                if attendance_percent is not None and attendance_percent < 75:
                    _ensure_notification(
                        db,
                        existing_notifications,
                        student.id,
                        "Attendance below requirement",
                        (
                            f"{code} attendance is {attendance_percent:.1f}% across "
                            f"{total_sessions} sessions, below the 75% requirement."
                        ),
                    )
                if level == "high":
                    reason = next(
                        (
                            factor
                            for factor in factors
                            if "below" in factor.lower()
                        ),
                        "Current attendance and assessment data indicate high risk.",
                    )
                    _ensure_notification(
                        db,
                        existing_notifications,
                        student.id,
                        "Academic risk warning",
                        f"{code}: {reason}",
                    )

        db.commit()
    engine.dispose()


if __name__ == "__main__":
    seed_demo_data()
