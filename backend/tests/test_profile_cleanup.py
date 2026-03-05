"""
Tests for global cascading cleanup when a profile is deleted or renamed (S005).

- Deleting a profile removes all summary .md and .meta.json for that profile.
- Renaming a profile (update with new name) removes all summary files for the old name.
- Summaries for other profiles are not deleted.
- Cleanup tolerates missing files.
"""

from __future__ import annotations

import json
from pathlib import Path

from app.models.feeds import FeedCreate
from app.models.profiles import SummaryProfileCreate, SummaryProfileUpdate
from app.services.feeds import FeedService
from app.services.profiles import SummaryProfileService


def _make_feed(tmp_path: Path, title: str = "Feed") -> str:
    feed_svc = FeedService(tmp_path)
    feed = feed_svc.create_feed(FeedCreate(title=title, url="https://example.com/feed.xml"))
    return feed.id


def _write_summary_files(
    data_root: Path, feed_id: str, article_id: str, profile_name: str, body: str = "summary"
) -> None:
    summary_dir = data_root / "feeds" / feed_id / "articles" / article_id / "summaries"
    summary_dir.mkdir(parents=True, exist_ok=True)
    (summary_dir / f"{profile_name}.md").write_text(body, encoding="utf-8")
    (summary_dir / f"{profile_name}.meta.json").write_text(
        json.dumps({"profile": profile_name}), encoding="utf-8"
    )


def _make_article_dir(data_root: Path, feed_id: str, article_id: str) -> None:
    (data_root / "feeds" / feed_id / "articles" / article_id).mkdir(parents=True, exist_ok=True)


def test_delete_profile_removes_all_summary_files_for_that_profile(tmp_path: Path) -> None:
    """
    When a profile is deleted, all summary .md and .meta.json for that profile
    under all feeds/articles are removed.
    """
    profile_svc = SummaryProfileService(tmp_path)
    profile_svc.create_profile(
        SummaryProfileCreate(
            name="to-remove",
            base_url="https://api.example.com/v1",
            key="k",
            model="gpt-4",
            fields=[],
            prompt_template="x",
        )
    )
    feed_id = _make_feed(tmp_path)
    _make_article_dir(tmp_path, feed_id, "art-1")
    _make_article_dir(tmp_path, feed_id, "art-2")
    _write_summary_files(tmp_path, feed_id, "art-1", "to-remove", "body1")
    _write_summary_files(tmp_path, feed_id, "art-2", "to-remove", "body2")

    profile_svc.delete_profile("to-remove")

    summaries_dir_1 = tmp_path / "feeds" / feed_id / "articles" / "art-1" / "summaries"
    summaries_dir_2 = tmp_path / "feeds" / feed_id / "articles" / "art-2" / "summaries"
    assert not (summaries_dir_1 / "to-remove.md").exists()
    assert not (summaries_dir_1 / "to-remove.meta.json").exists()
    assert not (summaries_dir_2 / "to-remove.md").exists()
    assert not (summaries_dir_2 / "to-remove.meta.json").exists()


def test_delete_profile_does_not_remove_summaries_of_other_profiles(tmp_path: Path) -> None:
    """
    Deleting one profile must not remove summary files for other profile names.
    """
    profile_svc = SummaryProfileService(tmp_path)
    profile_svc.create_profile(
        SummaryProfileCreate(
            name="p1",
            base_url="https://api.example.com/v1",
            key="k",
            model="gpt-4",
            fields=[],
            prompt_template="x",
        )
    )
    profile_svc.create_profile(
        SummaryProfileCreate(
            name="p2",
            base_url="https://api.example.com/v1",
            key="k",
            model="gpt-4",
            fields=[],
            prompt_template="y",
        )
    )
    feed_id = _make_feed(tmp_path)
    _make_article_dir(tmp_path, feed_id, "art-1")
    _write_summary_files(tmp_path, feed_id, "art-1", "p1", "summary-p1")
    _write_summary_files(tmp_path, feed_id, "art-1", "p2", "summary-p2")

    profile_svc.delete_profile("p1")

    summaries_dir = tmp_path / "feeds" / feed_id / "articles" / "art-1" / "summaries"
    assert not (summaries_dir / "p1.md").exists()
    assert not (summaries_dir / "p1.meta.json").exists()
    assert (summaries_dir / "p2.md").exists()
    assert (summaries_dir / "p2.md").read_text(encoding="utf-8") == "summary-p2"
    assert (summaries_dir / "p2.meta.json").exists()


def test_cleanup_tolerates_missing_summary_files(tmp_path: Path) -> None:
    """
    Cleanup does not fail when summary files or directories are missing.
    """
    profile_svc = SummaryProfileService(tmp_path)
    profile_svc.create_profile(
        SummaryProfileCreate(
            name="no-summaries",
            base_url="https://api.example.com/v1",
            key="k",
            model="gpt-4",
            fields=[],
            prompt_template="x",
        )
    )
    _make_feed(tmp_path)
    # No summary files exist for "no-summaries"; delete should succeed.
    profile_svc.delete_profile("no-summaries")
    assert [p.name for p in profile_svc.list_profiles()] == []


def test_rename_profile_removes_old_profile_summaries(tmp_path: Path) -> None:
    """
    When a profile is renamed (update with new name), all summary files
    for the old profile name are removed.
    """
    profile_svc = SummaryProfileService(tmp_path)
    profile_svc.create_profile(
        SummaryProfileCreate(
            name="old-name",
            base_url="https://api.example.com/v1",
            key="k",
            model="gpt-4",
            fields=[],
            prompt_template="x",
        )
    )
    feed_id = _make_feed(tmp_path)
    _make_article_dir(tmp_path, feed_id, "art-1")
    _write_summary_files(tmp_path, feed_id, "art-1", "old-name", "legacy summary")

    profile_svc.update_profile("old-name", SummaryProfileUpdate(name="new-name"))

    summaries_dir = tmp_path / "feeds" / feed_id / "articles" / "art-1" / "summaries"
    assert not (summaries_dir / "old-name.md").exists()
    assert not (summaries_dir / "old-name.meta.json").exists()
    profile = profile_svc.get_profile("new-name")
    assert profile.name == "new-name"
