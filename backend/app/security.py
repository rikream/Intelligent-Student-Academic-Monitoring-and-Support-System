from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.config import TOKEN_ISSUER, TOKEN_SECRET, TOKEN_TTL_SECONDS
from backend.app.models import Role, User

bearer_scheme = HTTPBearer(auto_error=False)


def issue_access_token(user: User, secret: str = TOKEN_SECRET) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "role": user.role.value,
        "iss": TOKEN_ISSUER,
        "iat": now,
        "exp": now + timedelta(seconds=TOKEN_TTL_SECONDS),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def create_current_user_dependency(get_db, secret: str = TOKEN_SECRET):
    def get_current_user(
        credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
        db: Session = Depends(get_db),
    ) -> User:
        unauthorized = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A valid bearer token is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        if credentials is None:
            raise unauthorized

        try:
            payload = jwt.decode(
                credentials.credentials,
                secret,
                algorithms=["HS256"],
                issuer=TOKEN_ISSUER,
                options={"require": ["sub", "iss", "exp"]},
            )
            user_id = int(payload["sub"])
        except (InvalidTokenError, TypeError, ValueError):
            raise unauthorized from None

        user = db.scalar(select(User).where(User.id == user_id))
        if user is None or not user.is_active or payload.get("role") != user.role.value:
            raise unauthorized
        return user

    return get_current_user


def require_roles(get_current_user, *roles: Role):
    def check_role(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your role is not permitted to perform this operation.",
            )
        return user

    return check_role
