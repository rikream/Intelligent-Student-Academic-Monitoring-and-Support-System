from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI

from backend.app.api import create_api_router
from backend.app.academic import create_academic_router
from backend.app.attendance import create_attendance_router
from backend.app.config import (
    ATTENDANCE_REQUIREMENT_PERCENT,
    ATTENDANCE_WARNING_PERCENT,
    DATABASE_URL,
    DEMO_LOGIN_ENABLED,
    FACE_TEMPLATE_ENCRYPTION_KEY,
    TOKEN_SECRET,
)
from backend.app.database import (
    create_database,
    create_session_dependency,
    initialize_schema,
)
from backend.app.security import create_current_user_dependency


def create_app(
    database_url: str | None = None,
    *,
    demo_login_enabled: bool | None = None,
    token_secret: str | None = None,
    face_template_encryption_key: str | None = None,
) -> FastAPI:
    resolved_database_url = database_url or DATABASE_URL
    resolved_demo_login = (
        DEMO_LOGIN_ENABLED if demo_login_enabled is None else demo_login_enabled
    )
    resolved_token_secret = token_secret or TOKEN_SECRET
    resolved_face_template_encryption_key = (
        FACE_TEMPLATE_ENCRYPTION_KEY
        if face_template_encryption_key is None
        else face_template_encryption_key
    )
    engine, session_factory = create_database(resolved_database_url)
    get_db = create_session_dependency(session_factory)
    get_current_user = create_current_user_dependency(get_db, resolved_token_secret)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        initialize_schema(engine)
        yield
        engine.dispose()

    app = FastAPI(
        title="Academic Monitoring API",
        version="0.4.0",
        description=(
            "P3 face and voice attendance. Demo login is for local fictional "
            "data only and is not production authentication."
        ),
        lifespan=lifespan,
    )
    app.state.engine = engine
    app.state.session_factory = session_factory
    app.include_router(
        create_api_router(
            get_db,
            get_current_user,
            resolved_demo_login,
            resolved_token_secret,
        )
    )
    app.include_router(
        create_attendance_router(
            get_db,
            get_current_user,
            ATTENDANCE_REQUIREMENT_PERCENT,
            ATTENDANCE_WARNING_PERCENT,
            resolved_face_template_encryption_key,
        )
    )
    app.include_router(create_academic_router(get_db, get_current_user))

    @app.get("/api/health")
    def health_check() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
