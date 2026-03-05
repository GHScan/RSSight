from pathlib import Path
from typing import Callable

from fastapi.testclient import TestClient

from app.main import app


def _override_data_root(tmp_path: Path) -> Callable[[], Path]:
    """
    Helper to lazily provide a fixed data root for tests.

    We use a callable so that the application code can obtain the
    data directory via dependency injection without knowing about
    pytest internals.
    """

    def _get_root() -> Path:
        return tmp_path

    return _get_root


def test_create_and_list_feeds_happy_path(tmp_path: Path, monkeypatch) -> None:
    """
    Happy path: creating a feed should persist it and it should be
    returned by the list endpoint.
    """
    from app import main as app_main

    # Arrange: force the backend to use an isolated data directory.
    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))

    client = TestClient(app)

    # Act: create a new feed.
    create_response = client.post(
        "/api/feeds",
        json={
            "title": "Example Feed",
            "url": "https://example.com/rss",
        },
    )

    # Assert: feed is created successfully.
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["title"] == "Example Feed"
    assert created["url"] == "https://example.com/rss"
    assert isinstance(created["id"], str) and created["id"]

    # Act: list feeds.
    list_response = client.get("/api/feeds")
    assert list_response.status_code == 200
    feeds = list_response.json()
    assert isinstance(feeds, list)
    assert len(feeds) == 1
    assert feeds[0]["id"] == created["id"]
    assert feeds[0]["title"] == "Example Feed"
    assert feeds[0]["url"] == "https://example.com/rss"


def test_update_nonexistent_feed_returns_404(tmp_path: Path, monkeypatch) -> None:
    """
    Boundary/exception: updating a feed that does not exist should
    return a 404 error with a machine-readable payload.
    """
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))

    client = TestClient(app)

    response = client.put(
        "/api/feeds/nonexistent",
        json={"title": "Updated title"},
    )

    assert response.status_code == 404
    body = response.json()
    # Basic contract: error responses should include code/message/details.
    assert body.get("code") == "FEED_NOT_FOUND"
    assert "message" in body
    assert "details" in body


def test_delete_feed_removes_index_and_directory(tmp_path: Path, monkeypatch) -> None:
    """
    Regression-style contract: deleting a feed removes it from the
    index and also deletes its directory under data/feeds/{feedId}.
    """
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))

    client = TestClient(app)

    # First create a feed.
    create_response = client.post(
        "/api/feeds",
        json={
            "title": "To Be Deleted",
            "url": "https://example.com/delete-me",
        },
    )
    assert create_response.status_code == 201
    created = create_response.json()
    feed_id = created["id"]

    # The feed directory should exist after creation.
    feed_dir = tmp_path / "feeds" / feed_id
    assert feed_dir.exists() and feed_dir.is_dir()

    # Delete the feed.
    delete_response = client.delete(f"/api/feeds/{feed_id}")
    assert delete_response.status_code == 204

    # After deletion, the feed should no longer be listed.
    list_response = client.get("/api/feeds")
    assert list_response.status_code == 200
    feeds = list_response.json()
    assert feeds == []

    # And the feed directory should have been removed as well.
    assert not feed_dir.exists()
