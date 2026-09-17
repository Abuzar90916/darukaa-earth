"""Test fixtures.

The suite never touches a real database or real credentials: the database
session and the authenticated-user dependency are both overridden, and service
functions are patched per test. That keeps `pytest` runnable in CI with no
secrets configured.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest
from app.core.security import CurrentUser, get_current_user
from app.db.database import get_db
from app.main import app
from fastapi.testclient import TestClient

TEST_USER_ID = "11111111-1111-4111-8111-111111111111"


class FakeResult:
    def __init__(self, rows: list[dict[str, Any]] | None = None, rowcount: int = 0) -> None:
        self._rows = rows or []
        self.rowcount = rowcount

    def mappings(self) -> FakeResult:
        return self

    def first(self) -> dict[str, Any] | None:
        return self._rows[0] if self._rows else None

    def scalar(self) -> Any:
        row = self.first()
        return next(iter(row.values())) if row else None

    def __iter__(self) -> Iterator[dict[str, Any]]:
        return iter(self._rows)


class FakeSession:
    """Records statements and returns queued results."""

    def __init__(self) -> None:
        self.queued: list[FakeResult] = []
        self.statements: list[str] = []

    def queue(self, rows: list[dict[str, Any]] | None = None, rowcount: int = 0) -> None:
        self.queued.append(FakeResult(rows, rowcount))

    def execute(self, statement: Any, params: Any = None) -> FakeResult:
        self.statements.append(str(statement))
        return self.queued.pop(0) if self.queued else FakeResult()

    def flush(self) -> None:  # pragma: no cover - no-op in tests
        pass

    def commit(self) -> None:  # pragma: no cover
        pass

    def rollback(self) -> None:  # pragma: no cover
        pass

    def close(self) -> None:  # pragma: no cover
        pass


@pytest.fixture
def session() -> FakeSession:
    return FakeSession()


@pytest.fixture
def anon_client() -> Iterator[TestClient]:
    """Client with no authentication override — protected routes must reject it."""
    app.dependency_overrides.clear()
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
def client(session: FakeSession) -> Iterator[TestClient]:
    app.dependency_overrides[get_db] = lambda: session
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id=TEST_USER_ID, email="admin@example.com", claims={"sub": TEST_USER_ID}
    )
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def square() -> dict[str, Any]:
    return {
        "type": "Polygon",
        "coordinates": [[[75.0, 13.0], [75.1, 13.0], [75.1, 13.1], [75.0, 13.1], [75.0, 13.0]]],
    }
