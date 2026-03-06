import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from fastapi.testclient import TestClient

from app.main import app
from app.models.articles import Article


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


def test_create_virtual_feed_via_api_and_list_includes_type_marker(
    tmp_path: Path, monkeypatch
) -> None:
    """S024: Create virtual feed via API; list returns feed_type and url null."""
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    create_response = client.post(
        "/api/feeds/virtual",
        json={"name": "My Favorites"},
    )
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["title"] == "My Favorites"
    assert created["url"] is None
    assert created["feed_type"] == "virtual"
    assert isinstance(created["id"], str) and created["id"]

    list_response = client.get("/api/feeds")
    assert list_response.status_code == 200
    feeds = list_response.json()
    assert len(feeds) == 1
    assert feeds[0]["feed_type"] == "virtual"
    assert feeds[0]["url"] is None
    assert feeds[0]["title"] == "My Favorites"


def test_delete_virtual_feed_removes_directory(tmp_path: Path, monkeypatch) -> None:
    """
    S024: Deleting virtual feed removes its feed directory subtree.
    """
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    create_response = client.post("/api/feeds/virtual", json={"name": "To Delete"})
    assert create_response.status_code == 201
    feed_id = create_response.json()["id"]
    feed_dir = tmp_path / "feeds" / feed_id
    assert feed_dir.exists()

    delete_response = client.delete(f"/api/feeds/{feed_id}")
    assert delete_response.status_code == 204

    list_response = client.get("/api/feeds")
    assert list_response.status_code == 200
    assert list_response.json() == []

    assert not feed_dir.exists()


def test_get_feed_returns_single_feed(tmp_path: Path, monkeypatch) -> None:
    """S028: GET /api/feeds/{feed_id} returns the feed; 404 when not found."""
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    create_response = client.post("/api/feeds/virtual", json={"name": "My Favorites"})
    assert create_response.status_code == 201
    feed_id = create_response.json()["id"]

    get_response = client.get(f"/api/feeds/{feed_id}")
    assert get_response.status_code == 200
    feed = get_response.json()
    assert feed["id"] == feed_id
    assert feed["title"] == "My Favorites"
    assert feed["url"] is None
    assert feed["feed_type"] == "virtual"

    not_found = client.get("/api/feeds/nonexistent-id")
    assert not_found.status_code == 404


def test_create_custom_article_via_api(tmp_path: Path, monkeypatch) -> None:
    """S028: POST /api/feeds/{feed_id}/articles creates custom article for virtual feed."""
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    create_response = client.post("/api/feeds/virtual", json={"name": "My Favorites"})
    assert create_response.status_code == 201
    feed_id = create_response.json()["id"]

    post_response = client.post(
        f"/api/feeds/{feed_id}/articles",
        json={
            "title": "Custom Title",
            "link": "https://example.com/custom",
            "description": "Custom content",
            "published_at": "2025-03-01T12:00:00Z",
            "source": "Manual",
        },
    )
    assert post_response.status_code == 201
    article = post_response.json()
    assert article["title"] == "Custom Title"
    assert article["link"] == "https://example.com/custom"
    assert article["published"] == "2025-03-01T12:00:00+00:00"
    assert article["source"] == "Manual"
    assert "id" in article and len(article["id"]) > 0

    list_response = client.get(f"/api/feeds/{feed_id}/articles")
    assert list_response.status_code == 200
    articles = list_response.json()
    assert len(articles) == 1
    assert articles[0]["title"] == "Custom Title"


def test_create_custom_article_rejects_rss_feed(tmp_path: Path, monkeypatch) -> None:
    """S028: POST /api/feeds/{feed_id}/articles returns 400 for non-virtual feed."""
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    create_response = client.post(
        "/api/feeds",
        json={"title": "RSS Feed", "url": "https://example.com/rss"},
    )
    assert create_response.status_code == 201
    feed_id = create_response.json()["id"]

    post_response = client.post(
        f"/api/feeds/{feed_id}/articles",
        json={
            "title": "Custom",
            "link": "",
            "description": "",
            "published_at": "2025-03-01T12:00:00Z",
        },
    )
    assert post_response.status_code == 400


# --- S029: URL-branch missing-field autofill ---


def test_create_custom_article_url_autofill_fills_missing_fields(
    tmp_path: Path, monkeypatch
) -> None:
    """S029 happy path: URL with missing title/description/published_at; autofill fills them."""
    from datetime import datetime, timezone

    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))

    def mock_fetch(url: str):
        assert "example.com" in url
        return {
            "title": "Page Title From Fetch",
            "description": "Page description from fetch.",
            "published_at": datetime(2025, 3, 5, 14, 0, 0, tzinfo=timezone.utc),
        }

    from app.api import feeds as feeds_module

    monkeypatch.setattr(feeds_module, "fetch_and_parse_url", mock_fetch)
    client = TestClient(app)

    create_response = client.post("/api/feeds/virtual", json={"name": "Collected"})
    assert create_response.status_code == 201
    feed_id = create_response.json()["id"]

    post_response = client.post(
        f"/api/feeds/{feed_id}/articles",
        json={
            "title": "",
            "link": "https://example.com/article",
            "description": "",
            "published_at": None,
            "source": None,
        },
    )
    assert post_response.status_code == 201
    article = post_response.json()
    assert article["title"] == "Page Title From Fetch"
    assert article["link"] == "https://example.com/article"
    assert article["published"] == "2025-03-05T14:00:00+00:00"
    assert "id" in article and len(article["id"]) > 0


def test_create_custom_article_url_autofill_does_not_overwrite_user_values(
    tmp_path: Path, monkeypatch
) -> None:
    """S029: User-provided non-empty fields are never overwritten by autofill."""
    from datetime import datetime, timezone

    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))

    def mock_fetch(url: str):
        return {
            "title": "Fetched Title",
            "description": "Fetched description",
            "published_at": datetime(2025, 3, 6, 10, 0, 0, tzinfo=timezone.utc),
        }

    from app.api import feeds as feeds_module

    monkeypatch.setattr(feeds_module, "fetch_and_parse_url", mock_fetch)
    client = TestClient(app)

    create_response = client.post("/api/feeds/virtual", json={"name": "Collected"})
    assert create_response.status_code == 201
    feed_id = create_response.json()["id"]

    post_response = client.post(
        f"/api/feeds/{feed_id}/articles",
        json={
            "title": "User Chosen Title",
            "link": "https://example.com/page",
            "description": "User description.",
            "published_at": "2025-03-01T12:00:00Z",
            "source": None,
        },
    )
    assert post_response.status_code == 201
    article = post_response.json()
    assert article["title"] == "User Chosen Title"
    assert "2025-03-01" in article["published"]


def test_create_custom_article_url_autofill_failure_returns_400(
    tmp_path: Path, monkeypatch
) -> None:
    """S029 boundary: Autofill failure returns explicit actionable error response."""
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))

    def mock_fetch_fails(url: str):
        raise OSError("Connection refused")

    from app.api import feeds as feeds_module

    monkeypatch.setattr(feeds_module, "fetch_and_parse_url", mock_fetch_fails)
    client = TestClient(app)

    create_response = client.post("/api/feeds/virtual", json={"name": "Collected"})
    assert create_response.status_code == 201
    feed_id = create_response.json()["id"]

    post_response = client.post(
        f"/api/feeds/{feed_id}/articles",
        json={
            "title": "",
            "link": "https://example.com/unreachable",
            "description": "",
            "published_at": None,
        },
    )
    assert post_response.status_code == 400
    body = post_response.json()
    assert "detail" in body or "message" in body
    detail = body.get("detail") or body.get("message")
    if isinstance(detail, dict):
        code_ok = detail.get("code") == "AUTOFILL_FAILED"
        msg_ok = "autofill" in (detail.get("message") or "").lower()
        assert code_ok or msg_ok
    else:
        assert "autofill" in str(detail).lower() or "fetch" in str(detail).lower()


def test_create_custom_article_url_autofill_incomplete_defaults_title_and_published(
    tmp_path: Path, monkeypatch
) -> None:
    """S029: After autofill when title or published_at still missing, backend
    defaults them so only-URL submit succeeds."""
    from datetime import datetime, timezone

    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))

    def mock_fetch_no_title(url: str):
        return {
            "title": None,
            "description": "Some description",
            "published_at": datetime(2025, 3, 5, 12, 0, 0, tzinfo=timezone.utc),
        }

    from app.api import feeds as feeds_module

    monkeypatch.setattr(feeds_module, "fetch_and_parse_url", mock_fetch_no_title)
    client = TestClient(app)

    create_response = client.post("/api/feeds/virtual", json={"name": "Collected"})
    assert create_response.status_code == 201
    feed_id = create_response.json()["id"]

    post_response = client.post(
        f"/api/feeds/{feed_id}/articles",
        json={
            "title": "",
            "link": "https://example.com/no-title",
            "description": "",
            "published_at": None,
        },
    )
    assert post_response.status_code == 201
    article = post_response.json()
    assert article["title"] == "https://example.com/no-title"
    assert "published" in article


def test_create_custom_article_no_url_missing_title_returns_400(
    tmp_path: Path, monkeypatch
) -> None:
    """S031: No-URL path with missing title returns 400 and explicit validation message."""
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    create_response = client.post("/api/feeds/virtual", json={"name": "Collected"})
    assert create_response.status_code == 201
    feed_id = create_response.json()["id"]

    post_response = client.post(
        f"/api/feeds/{feed_id}/articles",
        json={
            "title": "",
            "link": "",
            "description": "Some content here",
            "published_at": None,
        },
    )
    assert post_response.status_code == 400
    body = post_response.json()
    detail = body.get("detail")
    assert isinstance(detail, dict)
    assert detail.get("code") == "MISSING_REQUIRED_FIELDS"
    msg = (detail.get("message") or "").lower()
    assert "title" in msg or "content" in msg
    missing = detail.get("details", {}).get("missing", [])
    assert "title" in missing


def test_create_custom_article_no_url_missing_description_returns_400(
    tmp_path: Path, monkeypatch
) -> None:
    """S031: No-URL path missing content/description returns 400 and explicit validation."""
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    create_response = client.post("/api/feeds/virtual", json={"name": "Collected"})
    assert create_response.status_code == 201
    feed_id = create_response.json()["id"]

    post_response = client.post(
        f"/api/feeds/{feed_id}/articles",
        json={
            "title": "My Title",
            "link": "",
            "description": "",
            "published_at": None,
        },
    )
    assert post_response.status_code == 400
    body = post_response.json()
    detail = body.get("detail")
    assert isinstance(detail, dict)
    assert detail.get("code") == "MISSING_REQUIRED_FIELDS"
    missing = detail.get("details", {}).get("missing", [])
    assert "description" in missing


def test_create_custom_article_no_url_title_and_content_success(
    tmp_path: Path, monkeypatch
) -> None:
    """S031: No-URL path with title and content creates article (published_at defaulted)."""
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    create_response = client.post("/api/feeds/virtual", json={"name": "Collected"})
    assert create_response.status_code == 201
    feed_id = create_response.json()["id"]

    post_response = client.post(
        f"/api/feeds/{feed_id}/articles",
        json={
            "title": "No URL Article",
            "link": "",
            "description": "Article body content",
            "published_at": None,
        },
    )
    assert post_response.status_code == 201
    created = post_response.json()
    assert created["title"] == "No URL Article"
    assert created["link"] == ""
    assert created["id"]
    list_response = client.get(f"/api/feeds/{feed_id}/articles")
    assert list_response.status_code == 200
    articles = list_response.json()
    assert len(articles) == 1
    assert articles[0]["title"] == "No URL Article"


def test_create_custom_article_no_url_with_provided_published_at_success(
    tmp_path: Path, monkeypatch
) -> None:
    """S034: No-URL two-step confirm - backend accepts default-filled published_at."""
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    create_response = client.post("/api/feeds/virtual", json={"name": "Collected"})
    assert create_response.status_code == 201
    feed_id = create_response.json()["id"]

    post_response = client.post(
        f"/api/feeds/{feed_id}/articles",
        json={
            "title": "Second Click Article",
            "link": "",
            "description": "Content after default fill.",
            "published_at": "2025-03-07T10:30:00Z",
        },
    )
    assert post_response.status_code == 201
    created = post_response.json()
    assert created["title"] == "Second Click Article"
    assert "2025-03-07" in created["published"]
    assert created["id"]


def test_virtual_feed_articles_list_returns_empty(tmp_path: Path, monkeypatch) -> None:
    """
    S026: GET /api/feeds/{feedId}/articles for a virtual feed returns 200 and empty list.
    Virtual feed has no RSS; article list is empty until custom articles are added.
    """
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    create_response = client.post("/api/feeds/virtual", json={"name": "My Favorites"})
    assert create_response.status_code == 201
    feed_id = create_response.json()["id"]

    articles_response = client.get(f"/api/feeds/{feed_id}/articles")
    assert articles_response.status_code == 200
    assert articles_response.json() == []


def test_rss_feed_list_returns_feed_type_for_backward_compat(tmp_path: Path, monkeypatch) -> None:
    """
    S024 regression: Existing RSS feed create/list still returns feed_type rss.
    """
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    client.post("/api/feeds", json={"title": "RSS Feed", "url": "https://example.com/rss"})
    list_response = client.get("/api/feeds")
    assert list_response.status_code == 200
    feeds = list_response.json()
    assert len(feeds) == 1
    assert feeds[0]["feed_type"] == "rss"
    assert feeds[0]["url"] == "https://example.com/rss"


def test_article_favorite_api_and_list_includes_favorite(tmp_path: Path, monkeypatch) -> None:
    """PUT favorite sets marker; GET list returns favorite and favorited_at."""
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    r = client.post("/api/feeds", json={"title": "F", "url": "https://example.com/rss"})
    assert r.status_code == 201
    feed_id = r.json()["id"]
    article_dir = tmp_path / "feeds" / feed_id / "articles" / "art1"
    article_dir.mkdir(parents=True)
    article = Article(
        id="art1",
        feed_id=feed_id,
        title="T",
        link="https://example.com/1",
        description="",
        guid="g1",
        published_at=datetime.now(timezone.utc),
    )
    article_dir.joinpath("article.json").write_text(
        json.dumps(article.model_dump(mode="json"), indent=2),
        encoding="utf-8",
    )

    list_r = client.get(f"/api/feeds/{feed_id}/articles")
    assert list_r.status_code == 200
    articles = list_r.json()
    assert len(articles) == 1
    assert articles[0].get("favorite") is False
    assert articles[0].get("favorited_at") is None

    put_r = client.put(
        f"/api/feeds/{feed_id}/articles/art1/favorite",
        json={"favorite": True},
    )
    assert put_r.status_code == 204

    list_r2 = client.get(f"/api/feeds/{feed_id}/articles")
    assert list_r2.status_code == 200
    articles2 = list_r2.json()
    assert len(articles2) == 1
    assert articles2[0]["favorite"] is True
    assert articles2[0]["favorited_at"] is not None


def test_feed_list_supports_split_into_rss_and_favorites_by_feed_type(
    tmp_path: Path, monkeypatch
) -> None:
    """
    S036: Data contract supports two list groups—RSS feeds and favorites collections.
    GET /api/feeds returns feeds with deterministic feed_type; partitioning by
    feed_type yields the two top-level domains for feed management.
    """
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    r1 = client.post("/api/feeds", json={"title": "RSS One", "url": "https://example.com/rss"})
    assert r1.status_code == 201
    r2 = client.post("/api/feeds/virtual", json={"name": "My Favorites"})
    assert r2.status_code == 201

    list_response = client.get("/api/feeds")
    assert list_response.status_code == 200
    feeds = list_response.json()
    assert len(feeds) == 2

    rss_feeds = [f for f in feeds if f["feed_type"] == "rss"]
    favorites_feeds = [f for f in feeds if f["feed_type"] == "virtual"]
    assert len(rss_feeds) == 1
    assert len(favorites_feeds) == 1
    assert rss_feeds[0]["url"] is not None
    assert favorites_feeds[0]["url"] is None


def test_list_feeds_domain_rss_returns_only_rss_feeds(tmp_path: Path, monkeypatch) -> None:
    """
    S037: GET /api/feeds?domain=rss returns only RSS feeds; favorites excluded.
    """
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    client.post("/api/feeds", json={"title": "RSS One", "url": "https://example.com/rss"})
    client.post("/api/feeds/virtual", json={"name": "My Favorites"})

    r = client.get("/api/feeds", params={"domain": "rss"})
    assert r.status_code == 200
    feeds = r.json()
    assert len(feeds) == 1
    assert feeds[0]["feed_type"] == "rss"
    assert feeds[0]["url"] is not None


def test_list_feeds_domain_favorites_returns_only_virtual_feeds(
    tmp_path: Path, monkeypatch
) -> None:
    """
    S037: GET /api/feeds?domain=favorites returns only favorites (virtual) collections.
    """
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    client.post("/api/feeds", json={"title": "RSS One", "url": "https://example.com/rss"})
    client.post("/api/feeds/virtual", json={"name": "My Favorites"})

    r = client.get("/api/feeds", params={"domain": "favorites"})
    assert r.status_code == 200
    feeds = r.json()
    assert len(feeds) == 1
    assert feeds[0]["feed_type"] == "virtual"
    assert feeds[0]["url"] is None


def test_list_feeds_no_domain_returns_all_backward_compatible(tmp_path: Path, monkeypatch) -> None:
    """
    S037: GET /api/feeds without domain param returns all feeds; normal RSS flow unchanged.
    """
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    client.post("/api/feeds", json={"title": "RSS One", "url": "https://example.com/rss"})
    client.post("/api/feeds/virtual", json={"name": "Favorites"})

    r = client.get("/api/feeds")
    assert r.status_code == 200
    feeds = r.json()
    assert len(feeds) == 2
    types = {f["feed_type"] for f in feeds}
    assert types == {"rss", "virtual"}


def test_list_feeds_domain_invalid_returns_422(tmp_path: Path, monkeypatch) -> None:
    """
    S037: GET /api/feeds?domain=invalid returns 422 (validation error).
    """
    from app import main as app_main

    monkeypatch.setattr(app_main, "get_data_root", _override_data_root(tmp_path))
    client = TestClient(app)

    r = client.get("/api/feeds", params={"domain": "invalid"})
    assert r.status_code == 422
