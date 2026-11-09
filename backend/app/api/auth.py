from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request, Response, status

from app.api.deps import CurrentSession
from app.core.config import settings
from app.core.security import (
    clear_session_cookie,
    client_ip,
    set_session_cookie,
    verify_credentials,
)
from app.schemas import LoginRequest, SessionRead
from app.services.auth import SessionData, login_rate_limiter, session_store

router = APIRouter(prefix="/auth", tags=["auth"])


def _session_response(session: SessionData) -> SessionRead:
    return SessionRead(
        username=session.username,
        csrf_token=session.csrf_token,
        expires_at=datetime.fromtimestamp(session.expires_at, tz=UTC),
    )


@router.post("/login", response_model=SessionRead)
def login(data: LoginRequest, request: Request, response: Response) -> SessionRead:
    ip = client_ip(request)
    retry_after = login_rate_limiter.retry_after(ip)
    if retry_after is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Try again later.",
            headers={"Retry-After": str(retry_after)},
        )

    if not verify_credentials(data.username, data.password):
        login_rate_limiter.record_failure(ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )

    login_rate_limiter.reset(ip)
    session_id, session = session_store.create(settings.auth_username.strip())
    set_session_cookie(response, session_id)
    return _session_response(session)


@router.get("/me", response_model=SessionRead)
def me(session: CurrentSession) -> SessionRead:
    return _session_response(session)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(session: CurrentSession, response: Response) -> None:
    session_store.delete(session.session_id)
    clear_session_cookie(response)
