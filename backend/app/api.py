from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.models import Enrollment, ProfessorSubject, Role, Student, Subject, User
from backend.app.schemas import (
    DemoLoginRequest,
    EnrollmentCreate,
    EnrollmentResponse,
    EnrollmentSummary,
    StudentCreate,
    StudentResponse,
    SubjectCreate,
    SubjectResponse,
    TokenResponse,
    UserResponse,
)
from backend.app.security import issue_access_token, require_roles


def create_api_router(
    get_db,
    get_current_user,
    demo_login_enabled: bool,
    token_secret: str,
):
    router = APIRouter(prefix="/api")
    require_admin = require_roles(get_current_user, Role.ADMINISTRATOR)

    @router.post("/auth/demo-login", response_model=TokenResponse)
    def demo_login(payload: DemoLoginRequest, db: Session = Depends(get_db)):
        if not demo_login_enabled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Demo login is disabled.",
            )
        user = db.scalar(
            select(User).where(func.lower(User.username) == payload.username.lower())
        )
        if user is None or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unknown or inactive demo account.",
            )
        return TokenResponse(
            access_token=issue_access_token(user, token_secret),
            expires_in=3600,
        )

    @router.get("/auth/me", response_model=UserResponse)
    def current_user(user: User = Depends(get_current_user)):
        return UserResponse(id=user.id, username=user.username, role=user.role.value)

    @router.get("/students", response_model=list[StudentResponse])
    def list_students(
        user: User = Depends(get_current_user), db: Session = Depends(get_db)
    ):
        statement = select(Student).join(User, Student.user_id == User.id)
        if user.role == Role.STUDENT:
            statement = statement.where(Student.user_id == user.id)
        elif user.role == Role.PROFESSOR:
            statement = (
                statement.join(Enrollment, Enrollment.student_id == Student.id)
                .join(ProfessorSubject, ProfessorSubject.subject_id == Enrollment.subject_id)
                .where(ProfessorSubject.professor_id == user.id)
                .distinct()
            )
        return [
            StudentResponse(
                id=student.id,
                user_id=student.user_id,
                username=student.user.username,
                roll_number=student.roll_number,
                name=student.name,
                department=student.department,
                semester=student.semester,
            )
            for student in db.scalars(statement.order_by(Student.roll_number)).all()
        ]

    @router.post(
        "/students",
        response_model=StudentResponse,
        status_code=status.HTTP_201_CREATED,
    )
    def create_student(
        payload: StudentCreate,
        db: Session = Depends(get_db),
        _admin: User = Depends(require_admin),
    ):
        if db.scalar(
            select(User).where(func.lower(User.username) == payload.username.lower())
        ):
            raise HTTPException(status_code=409, detail="Username already exists.")
        if db.scalar(
            select(Student).where(
                func.lower(Student.roll_number) == payload.roll_number.lower()
            )
        ):
            raise HTTPException(status_code=409, detail="Roll number already exists.")

        user = User(username=payload.username, role=Role.STUDENT)
        student = Student(
            user=user,
            roll_number=payload.roll_number,
            name=payload.name,
            department=payload.department,
            semester=payload.semester,
        )
        db.add(student)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Username or roll number already exists.",
            ) from None
        db.refresh(student)
        return StudentResponse(
            id=student.id,
            user_id=student.user_id,
            username=user.username,
            roll_number=student.roll_number,
            name=student.name,
            department=student.department,
            semester=student.semester,
        )

    @router.get("/subjects", response_model=list[SubjectResponse])
    def list_subjects(
        user: User = Depends(get_current_user), db: Session = Depends(get_db)
    ):
        statement = select(Subject)
        if user.role == Role.PROFESSOR:
            statement = statement.join(ProfessorSubject).where(
                ProfessorSubject.professor_id == user.id
            )
        elif user.role == Role.STUDENT:
            statement = (
                statement.join(Enrollment)
                .join(Student, Student.id == Enrollment.student_id)
                .where(Student.user_id == user.id)
            )
        return db.scalars(statement.order_by(Subject.code).distinct()).all()

    @router.post(
        "/subjects",
        response_model=SubjectResponse,
        status_code=status.HTTP_201_CREATED,
    )
    def create_subject(
        payload: SubjectCreate,
        db: Session = Depends(get_db),
        _admin: User = Depends(require_admin),
    ):
        if db.scalar(
            select(Subject).where(func.lower(Subject.code) == payload.code.lower())
        ):
            raise HTTPException(status_code=409, detail="Subject code already exists.")
        subject = Subject(
            code=payload.code,
            name=payload.name,
            department=payload.department,
            semester=payload.semester,
        )
        db.add(subject)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=409, detail="Subject code already exists."
            ) from None
        db.refresh(subject)
        return subject

    @router.get("/enrollments", response_model=list[EnrollmentSummary])
    def list_enrollments(
        user: User = Depends(get_current_user), db: Session = Depends(get_db)
    ):
        statement = (
            select(Enrollment)
            .join(Student)
            .join(Subject)
            .join(User, Student.user_id == User.id)
        )
        if user.role == Role.STUDENT:
            statement = statement.where(Student.user_id == user.id)
        elif user.role == Role.PROFESSOR:
            statement = (
                statement.join(
                    ProfessorSubject,
                    ProfessorSubject.subject_id == Enrollment.subject_id,
                )
                .where(ProfessorSubject.professor_id == user.id)
                .distinct()
            )
        enrollments = db.scalars(statement.order_by(Subject.code, Student.roll_number)).all()
        return [
            EnrollmentSummary(
                id=enrollment.id,
                student_id=enrollment.student_id,
                subject_id=enrollment.subject_id,
                roll_number=enrollment.student.roll_number,
                student_name=enrollment.student.name,
                subject_code=enrollment.subject.code,
                subject_name=enrollment.subject.name,
                department=enrollment.subject.department,
                semester=enrollment.subject.semester,
            )
            for enrollment in enrollments
        ]

    @router.post(
        "/enrollments",
        response_model=EnrollmentResponse,
        status_code=status.HTTP_201_CREATED,
    )
    def create_enrollment(
        payload: EnrollmentCreate,
        db: Session = Depends(get_db),
        _admin: User = Depends(require_admin),
    ):
        student = db.get(Student, payload.student_id)
        subject = db.get(Subject, payload.subject_id)
        if student is None or subject is None:
            raise HTTPException(
                status_code=404, detail="Student or subject was not found."
            )
        if (
            student.department.casefold() != subject.department.casefold()
            or student.semester != subject.semester
        ):
            raise HTTPException(
                status_code=422,
                detail="Student department and semester must match the subject.",
            )
        if db.scalar(
            select(Enrollment).where(
                Enrollment.student_id == student.id,
                Enrollment.subject_id == subject.id,
            )
        ):
            raise HTTPException(status_code=409, detail="Enrollment already exists.")

        enrollment = Enrollment(student_id=student.id, subject_id=subject.id)
        db.add(enrollment)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=409, detail="Enrollment already exists.") from None
        db.refresh(enrollment)
        return EnrollmentResponse(
            id=enrollment.id,
            student_id=student.id,
            subject_id=subject.id,
            roll_number=student.roll_number,
            student_name=student.name,
            subject_code=subject.code,
            subject_name=subject.name,
        )

    return router
