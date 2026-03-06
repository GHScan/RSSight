"""
Tests for feed storage schema: normal RSS feeds and virtual feeds (S023).

Covers: virtual feed records (name, empty URL, type marker), backward-compatible
load of legacy feeds, and regression for existing RSS create/list behavior.
"""

from pathlib import Path

from app.models.feeds import Feed, FeedCreate
from app.services.feeds import FeedService


def test_storage_loads_virtual_feed_with_type_marker_and_empty_url(tmp_path: Path) -> None:
    """
    Happy path: feed index can store and load a virtual feed record with
    name, empty URL, and explicit type marker.
    """
    feeds_index = tmp_path / "feeds.json"
    feeds_index.parent.mkdir(parents=True, exist_ok=True)
    feed_id = "vf-001"
    feeds_index.write_text(
        """{
  "%s": {
    "id": "%s",
    "title": "My Favorites",
    "url": null,
    "feed_type": "virtual"
  }
}""" % (feed_id, feed_id),
        encoding="utf-8",
    )
    (tmp_path / "feeds" / feed_id).mkdir(parents=True)

    service = FeedService(tmp_path)
    feeds = service.list_feeds()

    assert len(feeds) == 1
    assert feeds[0].id == feed_id
    assert feeds[0].title == "My Favorites"
    assert feeds[0].url is None
    assert feeds[0].feed_type == "virtual"


def test_storage_loads_legacy_rss_feed_without_feed_type(tmp_path: Path) -> None:
    """
    Boundary/backward compat: existing feeds.json without feed_type field
    loads as normal RSS feed.
    """
    feeds_index = tmp_path / "feeds.json"
    feeds_index.parent.mkdir(parents=True, exist_ok=True)
    feed_id = "rss-legacy"
    feeds_index.write_text(
        """{
  "%s": {
    "id": "%s",
    "title": "Legacy Feed",
    "url": "https://example.com/feed.xml"
  }
}""" % (feed_id, feed_id),
        encoding="utf-8",
    )
    (tmp_path / "feeds" / feed_id).mkdir(parents=True)

    service = FeedService(tmp_path)
    feeds = service.list_feeds()

    assert len(feeds) == 1
    assert feeds[0].id == feed_id
    assert feeds[0].title == "Legacy Feed"
    assert str(feeds[0].url) == "https://example.com/feed.xml"
    assert feeds[0].feed_type == "rss"


def test_create_feed_persists_rss_with_feed_type_and_url(tmp_path: Path) -> None:
    """
    Regression: existing create_feed (RSS) still works and persisted feed
    has feed_type rss and url set.
    """
    service = FeedService(tmp_path)
    created = service.create_feed(FeedCreate(title="Example RSS", url="https://example.com/rss"))

    assert created.feed_type == "rss"
    assert created.url is not None
    assert str(created.url) == "https://example.com/rss"

    feeds = service.list_feeds()
    assert len(feeds) == 1
    assert feeds[0].feed_type == "rss"
    assert str(feeds[0].url) == "https://example.com/rss"


def test_storage_roundtrip_mixed_rss_and_virtual(tmp_path: Path) -> None:
    """
    List and get_feed return both normal and virtual feeds; save preserves
    feed_type and url/null for virtual.
    """
    service = FeedService(tmp_path)
    # Create RSS feed via existing API
    rss = service.create_feed(FeedCreate(title="RSS Feed", url="https://example.com/feed"))
    # Manually add virtual feed to index (simulating future virtual-feed create)
    feeds = service._load_feeds()
    virtual = Feed(
        id="virtual-1",
        title="Favorites",
        url=None,
        feed_type="virtual",
    )
    feeds[virtual.id] = virtual
    service._save_feeds(feeds)
    (tmp_path / "feeds" / virtual.id).mkdir(parents=True, exist_ok=True)

    listed = service.list_feeds()
    assert len(listed) == 2
    by_id = {f.id: f for f in listed}
    assert by_id[rss.id].feed_type == "rss" and by_id[rss.id].url is not None
    assert by_id[virtual.id].feed_type == "virtual" and by_id[virtual.id].url is None

    got = service.get_feed(virtual.id)
    assert got.feed_type == "virtual" and got.url is None


def test_create_virtual_feed_persists_and_list_returns_it(tmp_path: Path) -> None:
    """
    S024: create_virtual_feed persists virtual feed to disk; list and get_feed return it.
    """
    service = FeedService(tmp_path)
    created = service.create_virtual_feed("My Favorites")

    assert created.feed_type == "virtual"
    assert created.url is None
    assert created.title == "My Favorites"
    assert created.id

    feed_dir = tmp_path / "feeds" / created.id
    assert feed_dir.exists() and feed_dir.is_dir()

    listed = service.list_feeds()
    assert len(listed) == 1
    assert listed[0].feed_type == "virtual" and listed[0].url is None

    got = service.get_feed(created.id)
    assert got.feed_type == "virtual" and got.url is None


def test_delete_virtual_feed_removes_directory(tmp_path: Path) -> None:
    """
    S034: Deleting a virtual feed via FeedService removes its directory subtree
    and removes it from list_feeds.
    """
    service = FeedService(tmp_path)
    created = service.create_virtual_feed("To Delete")
    feed_id = created.id
    feed_dir = tmp_path / "feeds" / feed_id
    assert feed_dir.exists() and feed_dir.is_dir()

    service.delete_feed(feed_id)

    assert not feed_dir.exists()
    listed = service.list_feeds()
    assert len(listed) == 0
