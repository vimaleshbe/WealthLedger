"""HTTP middleware that enforces authentication and hardens responses."""

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response

from app.core.config import settings
from app.core.security import (
    CSRF_HEADER_NAME,
    SESSION_COOKIE_NAME,
    verify_csrf,
)
from app.services.auth import session_store

_UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
_PUBLIC_API_PATHS = frozenset({"/api/v1/auth/login"})
_DOCS_PATHS = frozenset({"/docs", "/redoc", "/openapi.json"})

_CONTENT_SECURITY_POLICY = (
    "default-src 'self'; "
    "base-uri 'self'; "
    "form-action 'self'; "
    "frame-ancestors 'none'; "
    "object-src 'none'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: blob:; "
    "font-src 'self' data:; "
    "connect-src 'self'"
)


def _is_https(request: Request) -> bool:
    forwarded_proto = (
        request.headers.get("x-forwarded-proto", "").split(",")[0].strip().lower()
    )
    return request.url.scheme == "https" or forwarded_proto == "https"


def _apply_security_headers(request: Request, response: Response) -> Response:
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("X-Robots-Tag", "noindex, nofollow")
    response.headers.setdefault(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), payment=()",
    )
    response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
    response.headers.setdefault("Cross-Origin-Resource-Policy", "same-origin")
    # Swagger UI / ReDoc load their own assets and inline bootstrap script.
    # In production these routes fall through to the SPA, so keep the CSP.
    if settings.is_production or request.url.path not in _DOCS_PATHS:
        response.headers.setdefault("Content-Security-Policy", _CONTENT_SECURITY_POLICY)
    if _is_https(request):
        response.headers.setdefault(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains",
        )
    return response


def _unauthorized() -> JSONResponse:
    return JSONResponse(
        status_code=401,
        content={"detail": "Not authenticated."},
        headers={"WWW-Authenticate": "Session"},
    )


def _csrf_failure() -> JSONResponse:
    return JSONResponse(
        status_code=403,
        content={"detail": "Invalid or missing CSRF token."},
    )


def _finalize(request: Request, response: Response, *, is_api: bool) -> Response:
    if is_api:
        response.headers.setdefault("Cache-Control", "no-store")
    return _apply_security_headers(request, response)


class SecurityMiddleware(BaseHTTPMiddleware):
    """Require a valid session for the API and add hardening headers."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        path = request.url.path
        normalized_path = path.rstrip("/") or "/"
        is_api = path.startswith("/api/v1")

        if (
            is_api
            and request.method != "OPTIONS"
            and normalized_path not in _PUBLIC_API_PATHS
        ):
            session = session_store.get(request.cookies.get(SESSION_COOKIE_NAME, ""))
            if session is None:
                return _finalize(request, _unauthorized(), is_api=True)
            if request.method in _UNSAFE_METHODS and not verify_csrf(
                session, request.headers.get(CSRF_HEADER_NAME, "")
            ):
                return _finalize(request, _csrf_failure(), is_api=True)
            request.state.session = session

        response = await call_next(request)
        return _finalize(request, response, is_api=is_api)
