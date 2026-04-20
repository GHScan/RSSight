"""
Tests for read-later collection storage (S060).

Read-later stores reference-only records (feed_id, article_id, added_at).
Ordering: newest-added first. Add inserts, remove deletes; no duplicated article/summary entity.
"""

from pathlib import Path

from app.services.read_later import ReadLaterService


def test_add_and_list_returns_newest_first(tmp_path: Path) -> None:
    """
    Happy path: add articles to read-later; list returns them newest-added first.
    """
    service = ReadLaterService(tmp_path)
    service.add(feed_id="f1", article_id="a1")
    service.add(feed_id="f1", article_id="a2")

    entries = service.list_entries()
    assert len(entries) == 2
    assert entries[0].feed_id == "f1" and entries[0].article_id == "a2"
    assert entries[1].feed_id == "f1" and entries[1].article_id == "a1"


def test_remove_deletes_record(tmp_path: Path) -> None:
    """
    Happy path: remove deletes the corresponding record from storage.
    """
    service = ReadLaterService(tmp_path)
    service.add(feed_id="f1", article_id="a1")
    service.remove(feed_id="f1", article_id="a1")

    entries = service.list_entries()
    assert len(entries) == 0


def test_remove_when_not_in_list_is_idempotent(tmp_path: Path) -> None:
    """
    Boundary: removing an article not in read-later does not raise; idempotent.
    """
    service = ReadLaterService(tmp_path)
    service.add(feed_id="f1", article_id="a1")
    service.remove(feed_id="f1", article_id="a99")
    service.remove(feed_id="f99", article_id="a1")

    entries = service.list_entries()
    assert len(entries) == 1
    assert entries[0].article_id == "a1"


def test_read_later_file_exists_under_data_dir(tmp_path: Path) -> None:
    """
    Regression: after add, data/read_later.json exists and contains reference-only records.
    """
    service = ReadLaterService(tmp_path)
    service.add(feed_id="feed-x", article_id="art-y")

    path = tmp_path / "read_later.json"
    assert path.exists()
    raw = path.read_text(encoding="utf-8")
    assert "feed-x" in raw and "art-y" in raw
    assert "added_at" in raw
    # No article content or summary content duplicated
    assert "title" not in raw or "description" not in raw  # only refs


def test_contains_returns_true_when_in_list(tmp_path: Path) -> None:
    """contains(feed_id, article_id) returns True when entry exists."""
    service = ReadLaterService(tmp_path)
    service.add(feed_id="f1", article_id="a1")
    assert service.contains(feed_id="f1", article_id="a1") is True
    assert service.contains(feed_id="f1", article_id="a2") is False


def test_relocate_article_reference_updates_feed_id(tmp_path: Path) -> None:
    """S075: after moving an article between feeds, read-later points at the new feed_id."""
    service = ReadLaterService(tmp_path)
    service.add(feed_id="src", article_id="art1")
    service.add(feed_id="other", article_id="art2")
    service.relocate_article_reference("src", "art1", "dst")

    entries = service.list_entries()
    assert len(entries) == 2
    moved = next(e for e in entries if e.article_id == "art1")
    assert moved.feed_id == "dst"
    assert service.contains(feed_id="dst", article_id="art1") is True
    assert service.contains(feed_id="src", article_id="art1") is False
