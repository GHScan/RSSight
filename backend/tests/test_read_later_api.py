"""
API tests for read-later collection (S061, S063).

Tests cover check, add, remove, list with titles, and persistence.
"""

import json
from pathlib import Path
from typing import Callable

from fastapi.testclient import TestClient

from app.main import app


def _override_data_root(tmp_path: Path) -> Callable[[], Path]:
    def _get_root() -> Path:
        return tmp_path

    return _get_root


def test_read_later_check_returns_false_when_empty(tmp_path: Path, monkeypatch) -> None:
    """Happy path: check when no entries returns in_read_later false."""
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    response = client.get(
        "/api/read-later/check",
        params={"feed_id": "f1", "article_id": "a1"},
    )
    assert response.status_code == 200
    assert response.json() == {"in_read_later": False}


def test_read_later_add_and_check_and_remove(tmp_path: Path, monkeypatch) -> None:
    """Happy path: add article, check returns true, remove, check returns false."""
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    add_resp = client.post(
        "/api/read-later",
        json={"feed_id": "f1", "article_id": "a1"},
    )
    assert add_resp.status_code == 204

    check_resp = client.get(
        "/api/read-later/check",
        params={"feed_id": "f1", "article_id": "a1"},
    )
    assert check_resp.status_code == 200
    assert check_resp.json() == {"in_read_later": True}

    remove_resp = client.delete("/api/read-later/f1/a1")
    assert remove_resp.status_code == 204

    check_after = client.get(
        "/api/read-later/check",
        params={"feed_id": "f1", "article_id": "a1"},
    )
    assert check_after.json() == {"in_read_later": False}


def test_read_later_remove_idempotent(tmp_path: Path, monkeypatch) -> None:
    """Boundary: remove when not in list is idempotent (204)."""
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    response = client.delete("/api/read-later/f1/a1")
    assert response.status_code == 204


def test_read_later_check_missing_params_returns_422(tmp_path: Path, monkeypatch) -> None:
    """Boundary: check without feed_id or article_id returns 422."""
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    resp = client.get("/api/read-later/check", params={})
    assert resp.status_code == 422


def test_read_later_list_empty_returns_empty_array(tmp_path: Path, monkeypatch) -> None:
    """Happy path: GET list when no read-later entries returns empty list (S063)."""
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    resp = client.get("/api/read-later")
    assert resp.status_code == 200
    assert resp.json() == []


def test_read_later_list_returns_items_with_titles_newest_first(
    tmp_path: Path, monkeypatch
) -> None:
    """GET list returns items with resolved titles, newest-added first (S063)."""
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    (tmp_path / "feeds" / "f1" / "articles" / "a1").mkdir(parents=True)
    (tmp_path / "feeds" / "f1" / "articles" / "a1" / "article.json").write_text(
        json.dumps(
            {
                "id": "a1",
                "feed_id": "f1",
                "title": "First Article",
                "link": "https://example.com/1",
                "description": "d1",
                "published_at": "2024-01-01T12:00:00Z",
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    (tmp_path / "feeds" / "f1" / "articles" / "a2").mkdir(parents=True)
    (tmp_path / "feeds" / "f1" / "articles" / "a2" / "article.json").write_text(
        json.dumps(
            {
                "id": "a2",
                "feed_id": "f1",
                "title": "Second Article",
                "link": "https://example.com/2",
                "description": "d2",
                "published_at": "2024-01-02T12:00:00Z",
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    client = TestClient(app)
    client.post("/api/read-later", json={"feed_id": "f1", "article_id": "a1"})
    client.post("/api/read-later", json={"feed_id": "f1", "article_id": "a2"})

    resp = client.get("/api/read-later")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["article_id"] == "a2" and data[0]["title"] == "Second Article"
    assert data[1]["article_id"] == "a1" and data[1]["title"] == "First Article"
    assert "feed_id" in data[0] and data[0]["feed_id"] == "f1"
    assert "added_at" in data[0]
