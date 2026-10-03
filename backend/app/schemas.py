from typing import Annotated

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from backend.app.models import AttendanceStatus

Username = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=3, max_length=64)
]


class DemoLoginRequest(BaseModel):
    username: Username


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    demo_only: bool = True


class UserResponse(BaseModel):
    id: int
    username: str
    role: str


class StudentCreate(BaseModel):
    username: Username
    roll_number: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=32)
    ]
    name: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)
    ]
    department: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
    ]
    semester: int = Field(ge=1, le=16)


class StudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    username: str
    roll_number: str
    name: str
    department: str
    semester: int


class SubjectCreate(BaseModel):
    code: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=32)
    ]
    name: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)
    ]
    department: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
    ]
    semester: int = Field(ge=1, le=16)


class SubjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    department: str
    semester: int


class EnrollmentCreate(BaseModel):
    student_id: int = Field(gt=0)
    subject_id: int = Field(gt=0)


class EnrollmentResponse(BaseModel):
    id: int
    student_id: int
    subject_id: int
    roll_number: str
    student_name: str
    subject_code: str
    subject_name: str


class EnrollmentSummary(BaseModel):
    id: int
    student_id: int
    subject_id: int
    roll_number: str
    student_name: str
    subject_code: str
    subject_name: str
    department: str
    semester: int


class AttendanceSessionCreate(BaseModel):
    subject_id: int = Field(gt=0)
    held_at: datetime | None = None


class AttendanceSessionResponse(BaseModel):
    id: int
    subject_id: int
    subject_code: str
    subject_name: str
    held_at: datetime
    ended_at: datetime | None
    is_active: bool
    professor_name: str
    student_status: str | None = None


class AttendanceRecordCreate(BaseModel):
    student_id: int = Field(gt=0)
    status: AttendanceStatus


class AttendanceStatusUpdate(BaseModel):
    status: AttendanceStatus


class AttendanceRecordResponse(BaseModel):
    id: int
    session_id: int
    student_id: int
    roll_number: str
    student_name: str
    status: str
    updated_at: datetime


class AttendanceRosterEntry(BaseModel):
    student_id: int
    roll_number: str
    student_name: str
    status: str | None


class AttendanceAuditResponse(BaseModel):
    id: int
    record_id: int
    actor_username: str
    action: str
    before_status: str
    after_status: str
    created_at: datetime


class AttendanceSummaryResponse(BaseModel):
    student_id: int
    roll_number: str
    student_name: str
    subject_id: int
    subject_code: str
    subject_name: str
    total_sessions: int
    present_sessions: int
    attendance_percent: float | None
    requirement_percent: int
    warning_percent: int
    alert: str


FaceDescriptor = Annotated[float, Field(ge=-1, le=1, allow_inf_nan=False)]


class FaceTemplateCreate(BaseModel):
    descriptor: list[FaceDescriptor] = Field(min_length=128, max_length=128)
    consent_confirmed: bool


class FaceTemplateStatus(BaseModel):
    student_id: int
    registered: bool


class FaceMatchRequest(BaseModel):
    descriptor: list[FaceDescriptor] = Field(min_length=128, max_length=128)


class FaceMatchCandidate(BaseModel):
    student_id: int
    roll_number: str
    student_name: str
    distance: float


class FaceMatchResponse(BaseModel):
    status: str
    candidates: list[FaceMatchCandidate]


class AssessmentCreate(BaseModel):
    subject_id: int = Field(gt=0)
    title: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)
    ]
    max_score: float = Field(gt=0, allow_inf_nan=False)


class AssessmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subject_id: int
    title: str
    max_score: float
    created_at: datetime


class MarkCreate(BaseModel):
    assessment_id: int = Field(gt=0)
    student_id: int = Field(gt=0)
    score: float = Field(ge=0, allow_inf_nan=False)


class MarkResponse(BaseModel):
    id: int
    assessment_id: int
    student_id: int
    roll_number: str
    student_name: str
    subject_id: int
    subject_code: str
    subject_name: str
    assessment_title: str
    score: float
    max_score: float
    updated_at: datetime


class MarkAuditResponse(BaseModel):
    id: int
    actor_username: str
    before_score: float | None
    after_score: float
    created_at: datetime


class AcademicRiskSummary(BaseModel):
    student_id: int
    roll_number: str
    student_name: str
    attendance_percent: float | None
    marks_percent: float | None
    risk_score: int | None
    risk_level: str
    factors: list[str]
    recommendation: str


class AcademicSubjectOverview(BaseModel):
    subject_id: int
    subject_code: str
    subject_name: str
    assessments: list[AssessmentResponse]
    marks: list[MarkResponse]
    risk: list[AcademicRiskSummary]


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    message: str
    read_at: datetime | None
    created_at: datetime
