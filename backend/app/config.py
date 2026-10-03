import os
import secrets
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./academic_monitoring.db")
DEMO_LOGIN_ENABLED = os.getenv("DEMO_LOGIN_ENABLED", "true").strip().lower() in {
    "1",
    "true",
    "yes",
}
configured_token_secret = os.getenv("APP_SECRET_KEY", "")
if configured_token_secret and len(configured_token_secret.encode("utf-8")) < 32:
    raise ValueError("APP_SECRET_KEY must contain at least 32 bytes.")
TOKEN_SECRET = configured_token_secret or secrets.token_urlsafe(48)
TOKEN_ISSUER = "academic-monitoring-local"
TOKEN_TTL_SECONDS = 3600
ATTENDANCE_REQUIREMENT_PERCENT = int(os.getenv("ATTENDANCE_REQUIREMENT_PERCENT", "75"))
ATTENDANCE_WARNING_PERCENT = int(os.getenv("ATTENDANCE_WARNING_PERCENT", "80"))
FACE_TEMPLATE_ENCRYPTION_KEY = os.getenv("FACE_TEMPLATE_ENCRYPTION_KEY", "")

if (
    FACE_TEMPLATE_ENCRYPTION_KEY
    and len(FACE_TEMPLATE_ENCRYPTION_KEY.encode("utf-8")) < 32
):
    raise ValueError("FACE_TEMPLATE_ENCRYPTION_KEY must contain at least 32 bytes.")

if not 0 < ATTENDANCE_REQUIREMENT_PERCENT <= ATTENDANCE_WARNING_PERCENT <= 100:
    raise ValueError(
        "Attendance thresholds must satisfy "
        "0 < ATTENDANCE_REQUIREMENT_PERCENT <= "
        "ATTENDANCE_WARNING_PERCENT <= 100."
    )
