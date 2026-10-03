from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.models import (
    AttendanceRecord,
    AttendanceStatus,
    AuditEvent,
    ClassSession,
    Enrollment,
    FaceTemplate,
    ProfessorSubject,
    Role,
    Student,
    Subject,
    User,
)
from backend.app.schemas import (
    AttendanceAuditResponse,
    AttendanceRecordCreate,
    AttendanceRecordResponse,
    AttendanceRosterEntry,
    AttendanceSessionCreate,
    AttendanceSessionResponse,
    AttendanceStatusUpdate,
    AttendanceSummaryResponse,
    FaceMatchCandidate,
    FaceMatchRequest,
    FaceMatchResponse,
    FaceTemplateCreate,
    FaceTemplateStatus,
)
from backend.app.biometrics import decrypt_descriptor, encrypt_descriptor
from backend.app.security import require_roles


def create_attendance_router(
    get_db,
    get_current_user,
    requirement_percent: int,
    warning_percent: int,
    face_template_encryption_key: str,
):
    router = APIRouter(prefix="/api/attendance")
    require_professor_or_admin = require_roles(
        get_current_user, Role.PROFESSOR, Role.ADMINISTRATOR
    )
    require_professor = require_roles(get_current_user, Role.PROFESSOR)

    def require_enrolled_student(
        db: Session, student_id: int, subject_id: int
    ) -> Student:
        student = db.get(Student, student_id)
        if student is None:
            raise HTTPException(status_code=404, detail="Student was not found.")
        enrolled = db.scalar(
            select(Enrollment.id).where(
                Enrollment.student_id == student.id,
                Enrollment.subject_id == subject_id,
            )
        )
        if enrolled is None:
            raise HTTPException(
                status_code=404, detail="Student is not enrolled in this subject."
            )
        return student

    def get_session_or_404(db: Session, session_id: int) -> ClassSession:
        class_session = db.get(ClassSession, session_id)
        if class_session is None:
            raise HTTPException(status_code=404, detail="Class session was not found.")
        return class_session

    def require_subject_access(db: Session, user: User, subject_id: int) -> None:
        if user.role == Role.ADMINISTRATOR:
            if db.get(Subject, subject_id) is None:
                raise HTTPException(status_code=404, detail="Subject was not found.")
            return
        if user.role != Role.PROFESSOR:
            raise HTTPException(status_code=403, detail="Professor access is required.")
        assignment = db.scalar(
            select(ProfessorSubject.id).where(
                ProfessorSubject.professor_id == user.id,
                ProfessorSubject.subject_id == subject_id,
            )
        )
        if assignment is None:
            raise HTTPException(
                status_code=403, detail="This subject is not assigned to you."
            )

    def require_session_access(
        db: Session, user: User, class_session: ClassSession, *, allow_student: bool
    ) -> None:
        if user.role == Role.ADMINISTRATOR:
            return
        if user.role == Role.PROFESSOR:
            require_subject_access(db, user, class_session.subject_id)
            return
        if allow_student and user.role == Role.STUDENT:
            enrolled = db.scalar(
                select(Enrollment.id)
                .join(Student, Enrollment.student_id == Student.id)
                .where(
                    Student.user_id == user.id,
                    Enrollment.subject_id == class_session.subject_id,
                )
            )
            if enrolled is not None:
                return
        raise HTTPException(status_code=403, detail="Access to this class is forbidden.")

    def session_response(
        class_session: ClassSession,
        user: User,
        student_status: str | None = None,
    ) -> AttendanceSessionResponse:
        return AttendanceSessionResponse(
            id=class_session.id,
            subject_id=class_session.subject_id,
            subject_code=class_session.subject.code,
            subject_name=class_session.subject.name,
            held_at=class_session.held_at,
            ended_at=class_session.ended_at,
            is_active=class_session.ended_at is None,
            professor_name=class_session.created_by.username,
            student_status=student_status,
        )

    @router.post(
        "/sessions",
        response_model=AttendanceSessionResponse,
        status_code=status.HTTP_201_CREATED,
    )
    def create_class_session(
        payload: AttendanceSessionCreate,
        db: Session = Depends(get_db),
        professor: User = Depends(require_professor),
    ):
        require_subject_access(db, professor, payload.subject_id)
        class_session = ClassSession(
            subject_id=payload.subject_id,
            created_by_user_id=professor.id,
            held_at=payload.held_at or datetime.now(timezone.utc),
        )
        db.add(class_session)
        db.commit()
        db.refresh(class_session)
        return session_response(class_session, professor)

    @router.get("/sessions", response_model=list[AttendanceSessionResponse])
    def list_class_sessions(
        db: Session = Depends(get_db), user: User = Depends(get_current_user)
    ):
        statement = select(ClassSession).join(Subject)
        if user.role == Role.PROFESSOR:
            statement = statement.join(ProfessorSubject).where(
                ProfessorSubject.professor_id == user.id
            )
        elif user.role == Role.STUDENT:
            statement = (
                statement.join(Enrollment, Enrollment.subject_id == Subject.id)
                .join(Student, Student.id == Enrollment.student_id)
                .where(Student.user_id == user.id)
            )
        sessions = db.scalars(
            statement.order_by(ClassSession.held_at.desc(), ClassSession.id.desc()).distinct()
        ).all()
        student_statuses: dict[int, str] = {}
        if user.role == Role.STUDENT and sessions:
            student_id = db.scalar(
                select(Student.id).where(Student.user_id == user.id)
            )
            if student_id is not None:
                records = db.execute(
                    select(AttendanceRecord.session_id, AttendanceRecord.status).where(
                        AttendanceRecord.student_id == student_id,
                        AttendanceRecord.session_id.in_(
                            [item.id for item in sessions]
                        ),
                    )
                ).all()
                student_statuses = {
                    session_id: record_status.value
                    for session_id, record_status in records
                }
        return [
            session_response(item, user, student_statuses.get(item.id))
            for item in sessions
        ]

    @router.post(
        "/sessions/{session_id}/end",
        response_model=AttendanceSessionResponse,
    )
    def end_class_session(
        session_id: int,
        db: Session = Depends(get_db),
        professor: User = Depends(require_professor),
    ):
        class_session = get_session_or_404(db, session_id)
        require_session_access(db, professor, class_session, allow_student=False)
        if class_session.ended_at is None:
            class_session.ended_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(class_session)
        return session_response(class_session, professor)

    @router.get(
        "/sessions/{session_id}/records",
        response_model=list[AttendanceRosterEntry],
    )
    def get_session_records(
        session_id: int,
        db: Session = Depends(get_db),
        user: User = Depends(get_current_user),
    ):
        class_session = get_session_or_404(db, session_id)
        require_session_access(db, user, class_session, allow_student=True)
        statement = (
            select(Student, AttendanceRecord)
            .join(Enrollment, Enrollment.student_id == Student.id)
            .outerjoin(
                AttendanceRecord,
                (AttendanceRecord.student_id == Student.id)
                & (AttendanceRecord.session_id == class_session.id),
            )
            .where(Enrollment.subject_id == class_session.subject_id)
            .order_by(Student.roll_number)
        )
        if user.role == Role.STUDENT:
            statement = statement.where(Student.user_id == user.id)
        rows = db.execute(statement).all()
        return [
            AttendanceRosterEntry(
                student_id=student.id,
                roll_number=student.roll_number,
                student_name=student.name,
                status=record.status.value if record else None,
            )
            for student, record in rows
        ]

    @router.post(
        "/sessions/{session_id}/records",
        response_model=AttendanceRecordResponse,
        status_code=status.HTTP_201_CREATED,
    )
    def create_attendance_record(
        session_id: int,
        payload: AttendanceRecordCreate,
        db: Session = Depends(get_db),
        actor: User = Depends(get_current_user),
    ):
        class_session = get_session_or_404(db, session_id)
        if actor.role == Role.STUDENT:
            require_session_access(db, actor, class_session, allow_student=True)
            if class_session.ended_at is not None:
                raise HTTPException(
                    status_code=409, detail="This attendance session has ended."
                )
            if payload.status != AttendanceStatus.PRESENT:
                raise HTTPException(
                    status_code=403,
                    detail="Students may only mark their own attendance as present.",
                )
            student = db.scalar(select(Student).where(Student.user_id == actor.id))
            if student is None or payload.student_id != student.id:
                raise HTTPException(
                    status_code=403,
                    detail="Students can mark attendance only for their own account.",
                )
        else:
            if actor.role != Role.PROFESSOR:
                raise HTTPException(
                    status_code=403,
                    detail="Only professors or the enrolled student can record attendance.",
                )
            require_session_access(db, actor, class_session, allow_student=False)
        student = db.get(Student, payload.student_id)
        if student is None:
            raise HTTPException(status_code=404, detail="Student was not found.")
        enrolled = db.scalar(
            select(Enrollment.id).where(
                Enrollment.student_id == student.id,
                Enrollment.subject_id == class_session.subject_id,
            )
        )
        if enrolled is None:
            raise HTTPException(
                status_code=422, detail="Student is not enrolled in this subject."
            )
        record = AttendanceRecord(
            session_id=class_session.id,
            student_id=student.id,
            status=payload.status,
            recorded_by_user_id=actor.id,
        )
        db.add(record)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Attendance already exists for this student and session.",
            ) from None
        db.refresh(record)
        return AttendanceRecordResponse(
            id=record.id,
            session_id=record.session_id,
            student_id=record.student_id,
            roll_number=student.roll_number,
            student_name=student.name,
            status=record.status.value,
            updated_at=record.updated_at,
        )

    @router.put(
        "/sessions/{session_id}/records/{student_id}",
        response_model=AttendanceRecordResponse,
    )
    def correct_attendance_record(
        session_id: int,
        student_id: int,
        payload: AttendanceStatusUpdate,
        db: Session = Depends(get_db),
        actor: User = Depends(require_professor_or_admin),
    ):
        class_session = get_session_or_404(db, session_id)
        require_session_access(db, actor, class_session, allow_student=False)
        record = db.scalar(
            select(AttendanceRecord).where(
                AttendanceRecord.session_id == class_session.id,
                AttendanceRecord.student_id == student_id,
            )
        )
        if record is None:
            raise HTTPException(status_code=404, detail="Attendance record was not found.")
        previous_status = record.status
        if previous_status != payload.status:
            record.status = payload.status
            db.add(
                AuditEvent(
                    class_session_id=class_session.id,
                    attendance_record_id=record.id,
                    actor_user_id=actor.id,
                    action="attendance_corrected",
                    before_value={"status": previous_status.value},
                    after_value={"status": payload.status.value},
                )
            )
            db.commit()
            db.refresh(record)
        return AttendanceRecordResponse(
            id=record.id,
            session_id=record.session_id,
            student_id=record.student_id,
            roll_number=record.student.roll_number,
            student_name=record.student.name,
            status=record.status.value,
            updated_at=record.updated_at,
        )

    @router.get(
        "/sessions/{session_id}/audit",
        response_model=list[AttendanceAuditResponse],
    )
    def get_attendance_audit(
        session_id: int,
        db: Session = Depends(get_db),
        user: User = Depends(require_professor_or_admin),
    ):
        class_session = get_session_or_404(db, session_id)
        require_session_access(db, user, class_session, allow_student=False)
        events = db.scalars(
            select(AuditEvent)
            .where(AuditEvent.class_session_id == class_session.id)
            .order_by(AuditEvent.created_at, AuditEvent.id)
        ).all()
        return [
            AttendanceAuditResponse(
                id=event.id,
                record_id=event.attendance_record_id,
                actor_username=event.actor.username,
                action=event.action,
                before_status=event.before_value["status"],
                after_status=event.after_value["status"],
                created_at=event.created_at,
            )
            for event in events
        ]

    @router.get(
        "/subjects/{subject_id}/summary",
        response_model=list[AttendanceSummaryResponse],
    )
    def attendance_summary(
        subject_id: int,
        db: Session = Depends(get_db),
        user: User = Depends(get_current_user),
    ):
        subject = db.get(Subject, subject_id)
        if subject is None:
            raise HTTPException(status_code=404, detail="Subject was not found.")
        if user.role == Role.PROFESSOR:
            require_subject_access(db, user, subject_id)
        sessions_count = db.scalar(
            select(func.count(ClassSession.id)).where(
                ClassSession.subject_id == subject_id
            )
        ) or 0
        statement = (
            select(Student)
            .join(Enrollment, Enrollment.student_id == Student.id)
            .where(Enrollment.subject_id == subject_id)
        )
        if user.role == Role.STUDENT:
            statement = statement.where(Student.user_id == user.id)
        students = db.scalars(statement.order_by(Student.roll_number)).all()
        summaries: list[AttendanceSummaryResponse] = []
        for student in students:
            present_count = db.scalar(
                select(func.count(AttendanceRecord.id))
                .join(ClassSession, ClassSession.id == AttendanceRecord.session_id)
                .where(
                    AttendanceRecord.student_id == student.id,
                    ClassSession.subject_id == subject_id,
                    AttendanceRecord.status == AttendanceStatus.PRESENT,
                )
            ) or 0
            percentage = (
                round(present_count * 100 / sessions_count, 2)
                if sessions_count
                else None
            )
            if percentage is None:
                alert = "no_sessions"
            elif percentage < requirement_percent:
                alert = "below_requirement"
            elif percentage <= warning_percent:
                alert = "warning"
            else:
                alert = "ok"
            summaries.append(
                AttendanceSummaryResponse(
                    student_id=student.id,
                    roll_number=student.roll_number,
                    student_name=student.name,
                    subject_id=subject.id,
                    subject_code=subject.code,
                    subject_name=subject.name,
                    total_sessions=sessions_count,
                    present_sessions=present_count,
                    attendance_percent=percentage,
                    requirement_percent=requirement_percent,
                    warning_percent=warning_percent,
                    alert=alert,
                )
            )
        return summaries

    @router.put(
        "/subjects/{subject_id}/students/{student_id}/face-template",
        response_model=FaceTemplateStatus,
    )
    def register_face_template(
        subject_id: int,
        student_id: int,
        payload: FaceTemplateCreate,
        db: Session = Depends(get_db),
        professor: User = Depends(require_professor),
    ):
        require_subject_access(db, professor, subject_id)
        student = require_enrolled_student(db, student_id, subject_id)
        if not payload.consent_confirmed:
            raise HTTPException(
                status_code=422,
                detail="Student consent must be confirmed before registration.",
            )
        encrypted = encrypt_descriptor(
            payload.descriptor, student.id, face_template_encryption_key
        )
        template = db.scalar(
            select(FaceTemplate).where(FaceTemplate.student_id == student.id)
        )
        if template is None:
            template = FaceTemplate(
                student_id=student.id,
                encrypted_descriptor=encrypted,
                registered_by_user_id=professor.id,
                consent_confirmed_at=datetime.now(timezone.utc),
            )
            db.add(template)
        else:
            template.encrypted_descriptor = encrypted
            template.registered_by_user_id = professor.id
            template.consent_confirmed_at = datetime.now(timezone.utc)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail="A face template already exists for this student.",
            ) from None
        return FaceTemplateStatus(student_id=student.id, registered=True)

    @router.delete(
        "/subjects/{subject_id}/students/{student_id}/face-template",
        response_model=FaceTemplateStatus,
    )
    def remove_face_template(
        subject_id: int,
        student_id: int,
        db: Session = Depends(get_db),
        professor: User = Depends(require_professor),
    ):
        require_subject_access(db, professor, subject_id)
        student = require_enrolled_student(db, student_id, subject_id)
        template = db.scalar(
            select(FaceTemplate).where(FaceTemplate.student_id == student.id)
        )
        if template is None:
            raise HTTPException(status_code=404, detail="Face template was not found.")
        db.delete(template)
        db.commit()
        return FaceTemplateStatus(student_id=student.id, registered=False)

    @router.delete("/face-template", status_code=status.HTTP_204_NO_CONTENT)
    def student_remove_face_template(
        db: Session = Depends(get_db),
        user: User = Depends(get_current_user),
    ):
        if user.role != Role.STUDENT:
            raise HTTPException(status_code=403, detail="Student access is required.")
        student = db.scalar(select(Student).where(Student.user_id == user.id))
        if student is None:
            raise HTTPException(status_code=404, detail="Student profile was not found.")
        template = db.scalar(
            select(FaceTemplate).where(FaceTemplate.student_id == student.id)
        )
        if template is None:
            raise HTTPException(status_code=404, detail="Face template was not found.")
        db.delete(template)
        db.commit()
        return None

    @router.get("/face-template", response_model=FaceTemplateStatus)
    def get_own_face_template_status(
        db: Session = Depends(get_db),
        user: User = Depends(get_current_user),
    ):
        if user.role != Role.STUDENT:
            raise HTTPException(status_code=403, detail="Student access is required.")
        student = db.scalar(select(Student).where(Student.user_id == user.id))
        if student is None:
            raise HTTPException(status_code=404, detail="Student profile was not found.")
        template = db.scalar(
            select(FaceTemplate.id).where(FaceTemplate.student_id == student.id)
        )
        return FaceTemplateStatus(
            student_id=student.id,
            registered=template is not None,
        )

    @router.get(
        "/sessions/{session_id}/face-templates",
        response_model=list[FaceTemplateStatus],
    )
    def list_session_face_template_statuses(
        session_id: int,
        db: Session = Depends(get_db),
        professor: User = Depends(require_professor),
    ):
        class_session = get_session_or_404(db, session_id)
        require_session_access(db, professor, class_session, allow_student=False)
        rows = db.execute(
            select(Student.id, FaceTemplate.id)
            .join(Enrollment, Enrollment.student_id == Student.id)
            .outerjoin(FaceTemplate, FaceTemplate.student_id == Student.id)
            .where(Enrollment.subject_id == class_session.subject_id)
            .order_by(Student.roll_number)
        ).all()
        return [
            FaceTemplateStatus(student_id=student_id, registered=template_id is not None)
            for student_id, template_id in rows
        ]

    @router.post(
        "/sessions/{session_id}/face-match",
        response_model=FaceMatchResponse,
    )
    def propose_face_match(
        session_id: int,
        payload: FaceMatchRequest,
        db: Session = Depends(get_db),
        user: User = Depends(get_current_user),
    ):
        class_session = get_session_or_404(db, session_id)
        if user.role not in (Role.PROFESSOR, Role.STUDENT):
            raise HTTPException(
                status_code=403,
                detail="Face matching is available to the assigned professor or enrolled student.",
            )
        require_session_access(db, user, class_session, allow_student=True)
        if user.role == Role.STUDENT and class_session.ended_at is not None:
            raise HTTPException(
                status_code=409, detail="This attendance session has ended."
            )
        rows = db.execute(
            select(Student, FaceTemplate)
            .join(Enrollment, Enrollment.student_id == Student.id)
            .join(FaceTemplate, FaceTemplate.student_id == Student.id)
            .where(Enrollment.subject_id == class_session.subject_id)
            .where(
                Student.user_id == user.id
                if user.role == Role.STUDENT
                else True
            )
        ).all()
        if not rows:
            return FaceMatchResponse(status="unknown", candidates=[])

        matches = []
        for student, template in rows:
            stored_descriptor = decrypt_descriptor(
                template.encrypted_descriptor,
                student.id,
                face_template_encryption_key,
            )
            distance = sum(
                (left - right) ** 2
                for left, right in zip(payload.descriptor, stored_descriptor)
            ) ** 0.5
            matches.append(
                FaceMatchCandidate(
                    student_id=student.id,
                    roll_number=student.roll_number,
                    student_name=student.name,
                    distance=round(distance, 4),
                )
            )
        matches.sort(key=lambda candidate: candidate.distance)
        nearest = matches[0]
        if nearest.distance > 0.5:
            return FaceMatchResponse(status="unknown", candidates=[])
        if len(matches) > 1 and matches[1].distance - nearest.distance < 0.05:
            return FaceMatchResponse(
                status="ambiguous",
                candidates=[nearest, matches[1]],
            )
        return FaceMatchResponse(status="proposed", candidates=[nearest])

    return router
