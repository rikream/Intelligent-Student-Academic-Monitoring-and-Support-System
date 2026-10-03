from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.models import (
    Assessment,
    AttendanceRecord,
    AttendanceStatus,
    ClassSession,
    Enrollment,
    MarkAuditEvent,
    MarkRecord,
    Notification,
    ProfessorSubject,
    Role,
    Student,
    Subject,
    User,
)
from backend.app.schemas import (
    AcademicRiskSummary,
    AcademicSubjectOverview,
    AssessmentCreate,
    AssessmentResponse,
    MarkCreate,
    MarkAuditResponse,
    MarkResponse,
    NotificationResponse,
)
from backend.app.security import require_roles


def calculate_academic_risk(
    attendance_percent: float | None, marks_percent: float | None
) -> tuple[int | None, str, list[str], str]:
    factors: list[str] = []
    score = 0
    has_data = attendance_percent is not None or marks_percent is not None

    if attendance_percent is None:
        factors.append("Attendance data is not available yet.")
    elif attendance_percent < 75:
        score += 50
        factors.append(f"Attendance is below the 75% requirement ({attendance_percent:.1f}%).")
    elif attendance_percent <= 80:
        score += 30
        factors.append(f"Attendance is close to the 75% requirement ({attendance_percent:.1f}%).")
    else:
        factors.append(f"Attendance is above the warning range ({attendance_percent:.1f}%).")

    if marks_percent is None:
        factors.append("Assessment marks are not available yet.")
    elif marks_percent < 50:
        score += 50
        factors.append(f"Recorded assessment average is below 50% ({marks_percent:.1f}%).")
    elif marks_percent < 65:
        score += 30
        factors.append(f"Recorded assessment average needs attention ({marks_percent:.1f}%).")
    else:
        factors.append(f"Recorded assessment average is {marks_percent:.1f}%.")

    if not has_data:
        return (
            None,
            "insufficient_data",
            factors,
            "Risk cannot be estimated until attendance or assessment data is recorded.",
        )

    level = "high" if score >= 50 else "medium" if score >= 30 else "low"
    if attendance_percent is None or marks_percent is None:
        factors.append("Estimate is partial because one academic data source is missing.")
    actions: list[str] = []
    if attendance_percent is not None and attendance_percent < 75:
        actions.append(
            "Meet with the professor to plan attendance recovery from "
            f"{attendance_percent:.1f}%."
        )
    elif attendance_percent is not None and attendance_percent <= 80:
        actions.append(
            "Prioritize upcoming classes; attendance is "
            f"{attendance_percent:.1f}%, close to the 75% requirement."
        )
    if marks_percent is not None and marks_percent < 50:
        actions.append(
            "Review recent assessment feedback with the professor; the "
            f"recorded average is {marks_percent:.1f}%."
        )
    elif marks_percent is not None and marks_percent < 65:
        actions.append(
            "Review the topics missed in assessments; the recorded average is "
            f"{marks_percent:.1f}%."
        )
    if attendance_percent is None:
        actions.append("Record attendance to complete the risk estimate.")
    if marks_percent is None:
        actions.append("Record assessment marks to complete the risk estimate.")
    recommendation = " ".join(actions) or (
        "Continue current attendance and study habits, and review progress "
        "at the next assessment."
    )
    return score, level, factors, recommendation


def create_academic_router(get_db, get_current_user):
    router = APIRouter(prefix="/api")
    require_professor = require_roles(get_current_user, Role.PROFESSOR)
    require_professor_or_admin = require_roles(
        get_current_user, Role.PROFESSOR, Role.ADMINISTRATOR
    )
    require_student = require_roles(get_current_user, Role.STUDENT)

    def require_subject_access(db: Session, actor: User, subject_id: int) -> Subject:
        subject = db.get(Subject, subject_id)
        if subject is None:
            raise HTTPException(status_code=404, detail="Subject was not found.")
        if actor.role == Role.PROFESSOR:
            assignment = db.scalar(
                select(ProfessorSubject.id).where(
                    ProfessorSubject.professor_id == actor.id,
                    ProfessorSubject.subject_id == subject_id,
                )
            )
            if assignment is None:
                raise HTTPException(
                    status_code=403, detail="This subject is not assigned to you."
                )
        elif actor.role == Role.STUDENT:
            enrollment = db.scalar(
                select(Enrollment.id)
                .join(Student, Student.id == Enrollment.student_id)
                .where(
                    Student.user_id == actor.id,
                    Enrollment.subject_id == subject_id,
                )
            )
            if enrollment is None:
                raise HTTPException(
                    status_code=403, detail="You are not enrolled in this subject."
                )
        return subject

    @router.post(
        "/academic/assessments",
        response_model=AssessmentResponse,
        status_code=status.HTTP_201_CREATED,
    )
    def create_assessment(
        payload: AssessmentCreate,
        db: Session = Depends(get_db),
        professor: User = Depends(require_professor),
    ):
        require_subject_access(db, professor, payload.subject_id)
        assessment = Assessment(
            subject_id=payload.subject_id,
            title=payload.title,
            max_score=payload.max_score,
            created_by_user_id=professor.id,
        )
        db.add(assessment)
        db.commit()
        db.refresh(assessment)
        return assessment

    @router.post(
        "/academic/marks",
        response_model=MarkResponse,
        status_code=status.HTTP_201_CREATED,
    )
    def save_mark(
        payload: MarkCreate,
        db: Session = Depends(get_db),
        professor: User = Depends(require_professor),
    ):
        assessment = db.get(Assessment, payload.assessment_id)
        if assessment is None:
            raise HTTPException(status_code=404, detail="Assessment was not found.")
        require_subject_access(db, professor, assessment.subject_id)
        if payload.score > assessment.max_score:
            raise HTTPException(
                status_code=422, detail="Score cannot exceed the assessment maximum."
            )
        student = db.get(Student, payload.student_id)
        if student is None:
            raise HTTPException(status_code=404, detail="Student was not found.")
        enrolled = db.scalar(
            select(Enrollment.id).where(
                Enrollment.student_id == student.id,
                Enrollment.subject_id == assessment.subject_id,
            )
        )
        if enrolled is None:
            raise HTTPException(
                status_code=422, detail="Student is not enrolled in this subject."
            )

        record = db.scalar(
            select(MarkRecord).where(
                MarkRecord.assessment_id == assessment.id,
                MarkRecord.student_id == student.id,
            )
        )
        previous_score = record.score if record else None
        if record is None:
            record = MarkRecord(
                assessment_id=assessment.id,
                student_id=student.id,
                score=payload.score,
                updated_by_user_id=professor.id,
            )
            db.add(record)
            db.flush()
        else:
            record.score = payload.score
            record.updated_by_user_id = professor.id
            db.add(
                MarkAuditEvent(
                    mark_record_id=record.id,
                    actor_user_id=professor.id,
                    before_score=previous_score,
                    after_score=payload.score,
                )
            )
        db.add(
            Notification(
                student_id=student.id,
                title="Assessment mark updated" if previous_score is not None else "New assessment mark",
                message=(
                    f"{assessment.subject.code} · {assessment.title}: "
                    f"{payload.score:g} / {assessment.max_score:g}"
                ),
            )
        )
        db.commit()
        db.refresh(record)
        return MarkResponse(
            id=record.id,
            assessment_id=assessment.id,
            student_id=student.id,
            roll_number=student.roll_number,
            student_name=student.name,
            subject_id=assessment.subject_id,
            subject_code=assessment.subject.code,
            subject_name=assessment.subject.name,
            assessment_title=assessment.title,
            score=record.score,
            max_score=assessment.max_score,
            updated_at=record.updated_at,
        )

    @router.get(
        "/academic/subjects/{subject_id}/overview",
        response_model=AcademicSubjectOverview,
    )
    def subject_academic_overview(
        subject_id: int,
        db: Session = Depends(get_db),
        actor: User = Depends(get_current_user),
    ):
        subject = require_subject_access(db, actor, subject_id)
        assessment_models = db.scalars(
            select(Assessment)
            .where(Assessment.subject_id == subject.id)
            .order_by(Assessment.created_at, Assessment.id)
        ).all()
        assessment_ids = [assessment.id for assessment in assessment_models]
        marks_statement = (
            select(MarkRecord)
            .join(Assessment, MarkRecord.assessment_id == Assessment.id)
            .where(Assessment.subject_id == subject.id)
            .order_by(MarkRecord.updated_at.desc(), MarkRecord.id.desc())
        )
        students_statement = (
            select(Student)
            .join(Enrollment, Enrollment.student_id == Student.id)
            .where(Enrollment.subject_id == subject.id)
            .order_by(Student.roll_number)
        )
        if actor.role == Role.STUDENT:
            students_statement = students_statement.where(Student.user_id == actor.id)
            marks_statement = marks_statement.join(
                Student, Student.id == MarkRecord.student_id
            ).where(Student.user_id == actor.id)
        students = db.scalars(students_statement).all()
        marks = db.scalars(marks_statement).all() if assessment_ids else []
        mark_responses = [
            MarkResponse(
                id=record.id,
                assessment_id=record.assessment_id,
                student_id=record.student_id,
                roll_number=record.student.roll_number,
                student_name=record.student.name,
                subject_id=subject.id,
                subject_code=subject.code,
                subject_name=subject.name,
                assessment_title=record.assessment.title,
                score=record.score,
                max_score=record.assessment.max_score,
                updated_at=record.updated_at,
            )
            for record in marks
        ]
        risk_rows: list[AcademicRiskSummary] = []
        sessions_count = db.scalar(
            select(func.count(ClassSession.id)).where(ClassSession.subject_id == subject.id)
        ) or 0
        for student in students:
            present_count = db.scalar(
                select(func.count(AttendanceRecord.id))
                .join(ClassSession, ClassSession.id == AttendanceRecord.session_id)
                .where(
                    AttendanceRecord.student_id == student.id,
                    ClassSession.subject_id == subject.id,
                    AttendanceRecord.status == AttendanceStatus.PRESENT,
                )
            ) or 0
            attendance_percent = (
                round(present_count * 100 / sessions_count, 2)
                if sessions_count
                else None
            )
            student_marks = [
                mark for mark in marks if mark.student_id == student.id
            ]
            marks_percent = (
                round(
                    sum(mark.score / mark.assessment.max_score * 100 for mark in student_marks)
                    / len(student_marks),
                    2,
                )
                if student_marks
                else None
            )
            score, level, factors, recommendation = calculate_academic_risk(
                attendance_percent, marks_percent
            )
            risk_rows.append(
                AcademicRiskSummary(
                    student_id=student.id,
                    roll_number=student.roll_number,
                    student_name=student.name,
                    attendance_percent=attendance_percent,
                    marks_percent=marks_percent,
                    risk_score=score,
                    risk_level=level,
                    factors=factors,
                    recommendation=recommendation,
                )
            )
        return AcademicSubjectOverview(
            subject_id=subject.id,
            subject_code=subject.code,
            subject_name=subject.name,
            assessments=assessment_models,
            marks=mark_responses,
            risk=risk_rows,
        )

    @router.get(
        "/academic/marks/{mark_id}/audit",
        response_model=list[MarkAuditResponse],
    )
    def mark_audit_history(
        mark_id: int,
        db: Session = Depends(get_db),
        actor: User = Depends(require_professor_or_admin),
    ):
        mark = db.get(MarkRecord, mark_id)
        if mark is None:
            raise HTTPException(status_code=404, detail="Mark record was not found.")
        require_subject_access(db, actor, mark.assessment.subject_id)
        events = db.scalars(
            select(MarkAuditEvent)
            .where(MarkAuditEvent.mark_record_id == mark.id)
            .order_by(MarkAuditEvent.created_at, MarkAuditEvent.id)
        ).all()
        return [
            MarkAuditResponse(
                id=event.id,
                actor_username=event.actor.username,
                before_score=event.before_score,
                after_score=event.after_score,
                created_at=event.created_at,
            )
            for event in events
        ]

    @router.get(
        "/notifications",
        response_model=list[NotificationResponse],
    )
    def list_notifications(
        db: Session = Depends(get_db),
        student_user: User = Depends(require_student),
    ):
        student_id = db.scalar(
            select(Student.id).where(Student.user_id == student_user.id)
        )
        if student_id is None:
            raise HTTPException(status_code=404, detail="Student profile was not found.")
        return db.scalars(
            select(Notification)
            .where(Notification.student_id == student_id)
            .order_by(Notification.created_at.desc(), Notification.id.desc())
        ).all()

    @router.put(
        "/notifications/{notification_id}/read",
        response_model=NotificationResponse,
    )
    def mark_notification_read(
        notification_id: int,
        db: Session = Depends(get_db),
        student_user: User = Depends(require_student),
    ):
        student_id = db.scalar(
            select(Student.id).where(Student.user_id == student_user.id)
        )
        notification = db.get(Notification, notification_id)
        if notification is None or notification.student_id != student_id:
            raise HTTPException(status_code=404, detail="Notification was not found.")
        if notification.read_at is None:
            notification.read_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(notification)
        return notification

    return router
