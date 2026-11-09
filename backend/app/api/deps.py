from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from app.core.security import SESSION_COOKIE_NAME
from app.services.auth import SessionData, session_store


def get_current_session(request: Request) -> SessionData:
    """Return the authenticated session set by SecurityMiddleware."""
    session = getattr(request.state, "session", None)
    if session is None:
        # Fallback keeps the dependency usable in isolation (e.g. unit tests).
        session = session_store.get(request.cookies.get(SESSION_COOKIE_NAME, ""))
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated.",
            headers={"WWW-Authenticate": "Session"},
        )
    return session


CurrentSession = Annotated[SessionData, Depends(get_current_session)]
