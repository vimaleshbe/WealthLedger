"""Session and login-throttling services.

Sessions are intentionally kept in process memory: this is a single-user,
single-container app that runs one worker. The small surface keeps logout
revocation immediate and avoids a database round-trip per request.
"""

import secrets
import threading
import time
from dataclasses import dataclass, replace

from app.core.config import settings


@dataclass(frozen=True)
class SessionData:
    session_id: str
    username: str
    csrf_token: str
    created_at: float
    last_seen_at: float
    expires_at: float


class SessionStore:
    """Thread-safe session registry with idle/absolute expiry and revocation."""

    def __init__(self, max_sessions: int = 20) -> None:
        self._sessions: dict[str, SessionData] = {}
        self._lock = threading.Lock()
        self._max_sessions = max_sessions

    def create(self, username: str) -> tuple[str, SessionData]:
        now = time.time()
        session_id = secrets.token_urlsafe(32)
        data = SessionData(
            session_id=session_id,
            username=username,
            csrf_token=secrets.token_urlsafe(32),
            created_at=now,
            last_seen_at=now,
            expires_at=now + settings.auth_session_ttl_minutes * 60,
        )
        with self._lock:
            self._purge_locked(now)
            self._sessions[session_id] = data
            if len(self._sessions) > self._max_sessions:
                oldest_session_id = next(iter(self._sessions))
                self._sessions.pop(oldest_session_id, None)
        return session_id, data

    def get(self, session_id: str) -> SessionData | None:
        if not session_id:
            return None
        now = time.time()
        with self._lock:
            data = self._sessions.get(session_id)
            if data is None:
                return None
            idle_deadline = data.last_seen_at + settings.auth_session_idle_minutes * 60
            if now >= data.expires_at or now >= idle_deadline:
                self._sessions.pop(session_id, None)
                return None
            refreshed = replace(data, last_seen_at=now)
            self._sessions[session_id] = refreshed
            return refreshed

    def delete(self, session_id: str) -> None:
        if not session_id:
            return
        with self._lock:
            self._sessions.pop(session_id, None)

    def clear(self) -> None:
        with self._lock:
            self._sessions.clear()

    def _purge_locked(self, now: float) -> None:
        idle_window = settings.auth_session_idle_minutes * 60
        expired = [
            session_id
            for session_id, data in self._sessions.items()
            if now >= data.expires_at or now >= data.last_seen_at + idle_window
        ]
        for session_id in expired:
            self._sessions.pop(session_id, None)


class LoginRateLimiter:
    """Sliding-window limiter for failed login attempts, keyed by client IP."""

    def __init__(self, max_attempts: int, window_seconds: int) -> None:
        self._max_attempts = max_attempts
        self._window_seconds = window_seconds
        self._failures: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def retry_after(self, key: str) -> int | None:
        """Seconds to wait, or None when another attempt is allowed."""
        now = time.monotonic()
        with self._lock:
            attempts = self._prune(key, now)
            if len(attempts) < self._max_attempts:
                return None
            remaining = self._window_seconds - (now - attempts[0])
            return max(1, int(remaining) + 1)

    def record_failure(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            attempts = self._prune(key, now)
            attempts.append(now)
            self._failures[key] = attempts

    def reset(self, key: str) -> None:
        with self._lock:
            self._failures.pop(key, None)

    def _prune(self, key: str, now: float) -> list[float]:
        cutoff = now - self._window_seconds
        attempts = [
            timestamp for timestamp in self._failures.get(key, []) if timestamp > cutoff
        ]
        self._failures[key] = attempts
        return attempts


session_store = SessionStore()
login_rate_limiter = LoginRateLimiter(
    settings.auth_max_login_attempts,
    settings.auth_login_window_seconds,
)
