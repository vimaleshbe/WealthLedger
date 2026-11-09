import pytest
from fastapi import Response
from pydantic import SecretStr

from app.core.config import settings
from app.core.security import (
    SESSION_COOKIE_NAME,
    clear_session_cookie,
    set_session_cookie,
    validate_auth_config,
    verify_credentials,
    verify_csrf,
)
from app.services.auth import LoginRateLimiter, SessionData, SessionStore


@pytest.fixture()
def auth_settings(monkeypatch):
    monkeypatch.setattr(settings, "auth_username", "admin")
    monkeypatch.setattr(settings, "auth_password", SecretStr("test-password-123"))
    monkeypatch.setattr(settings, "auth_session_ttl_minutes", 60)
    monkeypatch.setattr(settings, "auth_session_idle_minutes", 30)
    monkeypatch.setattr(settings, "auth_max_login_attempts", 5)
    monkeypatch.setattr(settings, "auth_login_window_seconds", 300)


def test_validate_auth_config_accepts_valid_values(auth_settings):
    validate_auth_config()


def test_validate_auth_config_requires_credentials(monkeypatch):
    monkeypatch.setattr(settings, "auth_username", "")
    monkeypatch.setattr(settings, "auth_password", SecretStr(""))

    with pytest.raises(RuntimeError, match="not configured"):
        validate_auth_config()


def test_validate_auth_config_rejects_short_password(monkeypatch, auth_settings):
    monkeypatch.setattr(settings, "auth_password", SecretStr("short"))

    with pytest.raises(RuntimeError, match="at least 8 characters"):
        validate_auth_config()


def test_validate_auth_config_rejects_weak_password(monkeypatch, auth_settings):
    monkeypatch.setattr(settings, "auth_password", SecretStr("password123"))

    with pytest.raises(RuntimeError, match="too common"):
        validate_auth_config()


def test_validate_auth_config_rejects_zero_session_ttl(monkeypatch, auth_settings):
    monkeypatch.setattr(settings, "auth_session_ttl_minutes", 0)

    with pytest.raises(RuntimeError, match="AUTH_SESSION_TTL_MINUTES"):
        validate_auth_config()


def test_validate_auth_config_rejects_long_password(monkeypatch, auth_settings):
    monkeypatch.setattr(settings, "auth_password", SecretStr("x" * 513))

    with pytest.raises(RuntimeError, match="at most 512 characters"):
        validate_auth_config()


def test_validate_auth_config_rejects_zero_login_attempts(monkeypatch, auth_settings):
    monkeypatch.setattr(settings, "auth_max_login_attempts", 0)

    with pytest.raises(RuntimeError, match="AUTH_MAX_LOGIN_ATTEMPTS"):
        validate_auth_config()


def test_verify_credentials(auth_settings):
    assert verify_credentials("admin", "test-password-123")
    assert not verify_credentials("admin", "wrong-password")
    assert not verify_credentials("someone", "test-password-123")


def test_verify_csrf():
    session = SessionData(
        session_id="session",
        username="admin",
        csrf_token="csrf-token",
        created_at=0.0,
        last_seen_at=0.0,
        expires_at=60.0,
    )

    assert verify_csrf(session, "csrf-token")
    assert not verify_csrf(session, "other-token")
    assert not verify_csrf(session, "")


def test_session_store_create_and_delete(auth_settings):
    store = SessionStore()
    session_id, session = store.create("admin")

    assert store.get(session_id) is not None
    assert session.username == "admin"

    store.delete(session_id)
    assert store.get(session_id) is None


def test_session_store_expires_after_idle_timeout(monkeypatch, auth_settings):
    monkeypatch.setattr(settings, "auth_session_idle_minutes", 0)
    store = SessionStore()
    session_id, _ = store.create("admin")

    assert store.get(session_id) is None


def test_session_store_expires_after_absolute_ttl(monkeypatch, auth_settings):
    monkeypatch.setattr(settings, "auth_session_ttl_minutes", 0)
    store = SessionStore()
    session_id, _ = store.create("admin")

    assert store.get(session_id) is None


def test_session_store_caps_session_count(auth_settings):
    store = SessionStore(max_sessions=2)
    first_id, _ = store.create("admin")
    second_id, _ = store.create("admin")
    third_id, _ = store.create("admin")

    assert store.get(first_id) is None
    assert store.get(second_id) is not None
    assert store.get(third_id) is not None


def test_rate_limiter_blocks_and_resets():
    limiter = LoginRateLimiter(max_attempts=2, window_seconds=60)

    assert limiter.retry_after("client") is None
    limiter.record_failure("client")
    limiter.record_failure("client")

    retry_after = limiter.retry_after("client")
    assert retry_after is not None
    assert retry_after >= 1

    limiter.reset("client")
    assert limiter.retry_after("client") is None


def test_rate_limiter_keys_are_independent():
    limiter = LoginRateLimiter(max_attempts=1, window_seconds=60)
    limiter.record_failure("first-client")

    assert limiter.retry_after("second-client") is None


def test_session_cookie_uses_safe_flags(monkeypatch, auth_settings):
    monkeypatch.setattr(settings, "auth_cookie_secure", False)
    response = Response()

    set_session_cookie(response, "session-value")

    cookie = response.headers["set-cookie"]
    assert SESSION_COOKIE_NAME in cookie
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie
    assert "Path=/" in cookie
    assert "Max-Age=3600" in cookie
    assert "Secure" not in cookie


def test_session_cookie_is_secure_when_configured(monkeypatch, auth_settings):
    monkeypatch.setattr(settings, "auth_cookie_secure", True)
    response = Response()

    set_session_cookie(response, "session-value")

    assert "Secure" in response.headers["set-cookie"]


def test_clear_session_cookie_expires_it(auth_settings):
    response = Response()

    clear_session_cookie(response)

    cookie = response.headers["set-cookie"]
    assert "Max-Age=0" in cookie
    assert "HttpOnly" in cookie
