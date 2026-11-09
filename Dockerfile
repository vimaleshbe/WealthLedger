# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Production image: builds the React frontend and serves it from FastAPI.
# No nginx — a single container exposes port 8000.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Quality gate: fail the build on frontend test or type/build errors.
RUN npm test && npm run build

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS backend-builder
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=0

COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-install-project

COPY backend/app ./app
COPY backend/tests ./tests

# Quality gate: the image build fails if linting, formatting, or tests fail.
RUN uv sync --frozen \
    && uv run ruff check . \
    && uv run ruff format --check . \
    && uv run pytest -q

# Drop development dependencies before exporting the virtualenv.
RUN uv sync --frozen --no-dev \
    && .venv/bin/python -c "import importlib.util; assert importlib.util.find_spec('pytest') is None; assert importlib.util.find_spec('ruff') is None"

FROM python:3.12-slim-bookworm
WORKDIR /app

COPY --from=backend-builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

COPY backend/app ./app
COPY --from=frontend-builder /app/dist ./app/static

RUN useradd -m appuser \
    && mkdir -p /app/data \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
