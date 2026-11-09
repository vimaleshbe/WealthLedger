"""Credential, session-cookie, and CSRF helpers."""

import hashlib
import hmac

from fastapi import Request, Response

from app.core.config import settings
from app.services.auth import SessionData

CSRF_HEADER_NAME = "X-CSRF-Token"

# The __Host- prefix binds the cookie to this exact host and path and requires
# Secure, which prevents subdomain cookie injection. It is only valid on HTTPS.
SESSION_COOKIE_NAME = (
    "__Host-portfolio_session" if settings.cookie_secure else "portfolio_session"
)

_WEAK_PASSWORDS = frozenset(
    {
        "12345678",
        "changeme",
        "change-me",
        "change-me-to-a-long-random-password",
        "password",
        "password123",
        "portfolio",
    }
)


def validate_auth_config() -> None:
    """Fail closed when credentials are missing or obviously unsafe."""
    username = settings.auth_username.strip()
    password = settings.auth_password.get_secret_value()

    if not username or not password:
        raise RuntimeError(
            "Authentication is not configured. Set AUTH_USERNAME and "
            "AUTH_PASSWORD environment variables before starting the app."
        )
    if len(password) < 8:
        raise RuntimeError("AUTH_PASSWORD must be at least 8 characters long.")
    if len(password) > 512:
        raise RuntimeError("AUTH_PASSWORD must be at most 512 characters long.")
    if len(username) > 128:
        raise RuntimeError("AUTH_USERNAME must be at most 128 characters long.")
    if password.lower() in _WEAK_PASSWORDS:
        raise RuntimeError("AUTH_PASSWORD is too common. Choose a stronger password.")
    if settings.auth_session_ttl_minutes <= 0:
        raise RuntimeError("AUTH_SESSION_TTL_MINUTES must be greater than 0.")
    if settings.auth_session_idle_minutes <= 0:
        raise RuntimeError("AUTH_SESSION_IDLE_MINUTES must be greater than 0.")
    if settings.auth_max_login_attempts <= 0:
        raise RuntimeError("AUTH_MAX_LOGIN_ATTEMPTS must be greater than 0.")
    if settings.auth_login_window_seconds <= 0:
        raise RuntimeError("AUTH_LOGIN_WINDOW_SECONDS must be greater than 0.")


def _constant_time_equal(left: str, right: str) -> bool:
    """Hash before comparing so differing lengths do not leak timing."""
    return hmac.compare_digest(
        hashlib.sha256(left.encode("utf-8")).digest(),
        hashlib.sha256(right.encode("utf-8")).digest(),
    )


def verify_credentials(username: str, password: str) -> bool:
    """Compare both fields in constant time to avoid user/timing leaks."""
    username_ok = _constant_time_equal(username, settings.auth_username.strip())
    password_ok = _constant_time_equal(
        password, settings.auth_password.get_secret_value()
    )
    return username_ok and password_ok


def verify_csrf(session: SessionData, token: str) -> bool:
    return bool(token) and _constant_time_equal(token, session.csrf_token)


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def set_session_cookie(response: Response, session_id: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_id,
        max_age=settings.auth_session_ttl_minutes * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
    )
