import os

from app.core.config import settings
from app.services.auth import login_rate_limiter

TEST_USERNAME = os.environ["AUTH_USERNAME"]
TEST_PASSWORD = os.environ["AUTH_PASSWORD"]


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_api_requires_authentication(client):
    response = client.get("/api/v1/assets")
    assert response.status_code == 401
    assert response.headers["cache-control"] == "no-store"


def test_security_headers(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert response.headers["x-robots-tag"] == "noindex, nofollow"
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]


def test_api_docs_are_not_blocked_by_csp(client):
    response = client.get("/docs")
    assert response.status_code == 200
    assert "content-security-policy" not in response.headers


def test_docs_paths_keep_csp_in_production(client, monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")
    response = client.get("/docs")
    assert response.status_code == 200
    assert "content-security-policy" in response.headers


def test_login_rejects_missing_fields(client):
    response = client.post("/api/v1/auth/login", json={"username": TEST_USERNAME})
    assert response.status_code == 422


def test_login_rejects_wrong_password(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"username": TEST_USERNAME, "password": "wrong-password"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid username or password."


def test_login_returns_session_and_csrf(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"username": TEST_USERNAME, "password": TEST_PASSWORD},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == TEST_USERNAME
    assert data["csrf_token"]
    assert "portfolio_session" in client.cookies

    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["username"] == TEST_USERNAME


def test_mutations_require_csrf_token(auth_client):
    assert "X-CSRF-Token" in auth_client.headers
    del auth_client.headers["X-CSRF-Token"]

    response = auth_client.post(
        "/api/v1/assets",
        json={"name": "No CSRF", "asset_type": "stock"},
    )
    assert response.status_code == 403


def test_wrong_csrf_token_is_rejected(auth_client):
    response = auth_client.post(
        "/api/v1/assets",
        headers={"X-CSRF-Token": "not-the-real-token"},
        json={"name": "Bad CSRF", "asset_type": "stock"},
    )
    assert response.status_code == 403


def test_logout_requires_csrf_token(auth_client):
    del auth_client.headers["X-CSRF-Token"]

    response = auth_client.post("/api/v1/auth/logout")
    assert response.status_code == 403
    assert auth_client.get("/api/v1/auth/me").status_code == 200


def test_session_expires_after_idle_timeout(auth_client, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "auth_session_idle_minutes", 0)
    response = auth_client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_logout_revokes_session(auth_client):
    response = auth_client.post("/api/v1/auth/logout")
    assert response.status_code == 204

    me = auth_client.get("/api/v1/auth/me")
    assert me.status_code == 401


def test_create_asset(auth_client):
    response = auth_client.post(
        "/api/v1/assets",
        json={
            "name": "Reliance Industries",
            "asset_type": "stock",
            "symbol": "RELIANCE.NS",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Reliance Industries"
    assert data["category"] == "equity"


def test_login_rate_limit(client):
    try:
        for _ in range(5):
            response = client.post(
                "/api/v1/auth/login",
                json={"username": TEST_USERNAME, "password": "wrong-password"},
            )
            assert response.status_code == 401

        blocked = client.post(
            "/api/v1/auth/login",
            json={"username": TEST_USERNAME, "password": TEST_PASSWORD},
        )
        assert blocked.status_code == 429
        assert blocked.headers["Retry-After"]
    finally:
        login_rate_limiter.reset("testclient")
