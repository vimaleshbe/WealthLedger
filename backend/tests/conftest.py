import os
import shutil
import tempfile
from pathlib import Path

# Configure an isolated throwaway database and deterministic credentials
# before the app (and its settings) are imported by test modules.
_TEST_DIR = Path(tempfile.mkdtemp(prefix="portfolio-tests-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(_TEST_DIR / 'test.db').as_posix()}"
os.environ["ENVIRONMENT"] = "test"
os.environ["AUTH_USERNAME"] = "testuser"
os.environ["AUTH_PASSWORD"] = "test-password-123"
os.environ["AUTH_SESSION_TTL_MINUTES"] = "60"
os.environ["AUTH_SESSION_IDLE_MINUTES"] = "30"
os.environ["AUTH_COOKIE_SECURE"] = "false"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services.auth import login_rate_limiter, session_store  # noqa: E402

TEST_USERNAME = os.environ["AUTH_USERNAME"]
TEST_PASSWORD = os.environ["AUTH_PASSWORD"]


@pytest.fixture(autouse=True)
def reset_auth_state():
    session_store.clear()
    login_rate_limiter.reset("testclient")
    yield
    session_store.clear()
    login_rate_limiter.reset("testclient")


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def auth_client(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"username": TEST_USERNAME, "password": TEST_PASSWORD},
    )
    assert response.status_code == 200, response.text
    client.headers.update({"X-CSRF-Token": response.json()["csrf_token"]})
    return client


@pytest.fixture()
def clean_database(auth_client):
    """Empty every table in the isolated test database before a test."""
    from sqlmodel import Session, SQLModel

    from app.db import engine

    url = str(engine.url)
    if "portfolio-tests-" not in url:
        raise RuntimeError(
            f"Refusing to clean a database outside the pytest temp directory: {url}"
        )

    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        for table in reversed(SQLModel.metadata.sorted_tables):
            session.exec(table.delete())
        session.commit()
    return auth_client


def pytest_sessionfinish(session, exitstatus):
    engine.dispose()
    shutil.rmtree(_TEST_DIR, ignore_errors=True)
