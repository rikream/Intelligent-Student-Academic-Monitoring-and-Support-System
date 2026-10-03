from datetime import datetime
from enum import Enum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Enum as SqlEnum,
    ForeignKey,
    JSON,
    LargeBinary,
    String,
    UniqueConstraint,
    DateTime,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.database import Base


class Role(str, Enum):
    STUDENT = "student"
    PROFESSOR = "professor"
    ADMINISTRATOR = "administrator"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64, collation="NOCASE"), unique=True)
    role: Mapped[Role] = mapped_column(SqlEnum(Role, native_enum=False), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    student: Mapped["Student | None"] = relationship(back_populates="user", uselist=False)
    taught_subjects: Mapped[list["ProfessorSubject"]] = relationship(
        back_populates="professor"
    )


class Student(Base):
    __tablename__ = "students"
    __table_args__ = (CheckConstraint("semester >= 1 AND semester <= 16"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    roll_number: Mapped[str] = mapped_column(
        String(32, collation="NOCASE"), unique=True, index=True
    )
    name: Mapped[str] = mapped_column(String(120))
    department: Mapped[str] = mapped_column(String(100))
    semester: Mapped[int] = mapped_column(nullable=False)
    user: Mapped[User] = relationship(back_populates="student")
    enrollments: Mapped[list["Enrollment"]] = relationship(back_populates="student")


class Subject(Base):
    __tablename__ = "subjects"
    __table_args__ = (CheckConstraint("semester >= 1 AND semester <= 16"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(
        String(32, collation="NOCASE"), unique=True, index=True
    )
    name: Mapped[str] = mapped_column(String(120))
    department: Mapped[str] = mapped_column(String(100))
    semester: Mapped[int] = mapped_column(nullable=False)
    enrollments: Mapped[list["Enrollment"]] = relationship(back_populates="subject")
    professors: Mapped[list["ProfessorSubject"]] = relationship(
        back_populates="subject"
    )


class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (
        UniqueConstraint("student_id", "subject_id", name="uq_enrollment_student_subject"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"), index=True)
    student: Mapped[Student] = relationship(back_populates="enrollments")
    subject: Mapped[Subject] = relationship(back_populates="enrollments")


class ProfessorSubject(Base):
    __tablename__ = "professor_subjects"
    __table_args__ = (
        UniqueConstraint("professor_id", "subject_id", name="uq_professor_subject"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    professor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"), index=True)
    professor: Mapped[User] = relationship(back_populates="taught_subjects")
    subject: Mapped[Subject] = relationship(back_populates="professors")


class ClassSession(Base):
    __tablename__ = "class_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"), index=True)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    held_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.current_timestamp(), index=True
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    subject: Mapped[Subject] = relationship()
    created_by: Mapped[User] = relationship()
    records: Mapped[list["AttendanceRecord"]] = relationship(back_populates="session")


class AttendanceStatus(str, Enum):
    PRESENT = "present"
    ABSENT = "absent"


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    __table_args__ = (
        UniqueConstraint(
            "session_id", "student_id", name="uq_attendance_session_student"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("class_sessions.id"), index=True
    )
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    status: Mapped[AttendanceStatus] = mapped_column(
        SqlEnum(AttendanceStatus, native_enum=False), nullable=False
    )
    recorded_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.current_timestamp()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )
    session: Mapped[ClassSession] = relationship(back_populates="records")
    student: Mapped[Student] = relationship()
    recorded_by: Mapped[User] = relationship()


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    class_session_id: Mapped[int] = mapped_column(
        ForeignKey("class_sessions.id"), index=True
    )
    attendance_record_id: Mapped[int] = mapped_column(
        ForeignKey("attendance_records.id"), index=True
    )
    actor_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(80))
    before_value: Mapped[dict[str, str]] = mapped_column(JSON)
    after_value: Mapped[dict[str, str]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.current_timestamp(), index=True
    )
    actor: Mapped[User] = relationship()
    attendance_record: Mapped[AttendanceRecord] = relationship()


class FaceTemplate(Base):
    __tablename__ = "face_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("students.id"), unique=True, index=True
    )
    encrypted_descriptor: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    registered_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    consent_confirmed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.current_timestamp()
    )
    student: Mapped[Student] = relationship()
    registered_by: Mapped[User] = relationship()


class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[int] = mapped_column(primary_key=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"), index=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    max_score: Mapped[float] = mapped_column(nullable=False)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.current_timestamp()
    )
    subject: Mapped[Subject] = relationship()
    created_by: Mapped[User] = relationship()


class MarkRecord(Base):
    __tablename__ = "mark_records"
    __table_args__ = (
        UniqueConstraint(
            "assessment_id", "student_id", name="uq_mark_assessment_student"
        ),
        CheckConstraint("score >= 0"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    assessment_id: Mapped[int] = mapped_column(ForeignKey("assessments.id"), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    score: Mapped[float] = mapped_column(nullable=False)
    updated_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )
    assessment: Mapped[Assessment] = relationship()
    student: Mapped[Student] = relationship()
    updated_by: Mapped[User] = relationship()


class MarkAuditEvent(Base):
    __tablename__ = "mark_audit_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    mark_record_id: Mapped[int] = mapped_column(ForeignKey("mark_records.id"), index=True)
    actor_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    before_score: Mapped[float | None] = mapped_column(nullable=True)
    after_score: Mapped[float] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.current_timestamp(), index=True
    )
    actor: Mapped[User] = relationship()
    mark_record: Mapped[MarkRecord] = relationship()


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), index=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    message: Mapped[str] = mapped_column(String(300), nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.current_timestamp(), index=True
    )
    student: Mapped[Student] = relationship()
