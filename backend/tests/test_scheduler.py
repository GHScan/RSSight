"""
Tests for scheduled feed fetching (S006).

- Scheduler trigger logic: run_once invokes the fetch job; start/stop lifecycle.
- Manual and scheduled tasks coexist: same fetch logic can be run by both.
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

from app.services.scheduler import FeedFetchScheduler


def test_scheduler_run_once_invokes_fetch_callable() -> None:
    """
    When run_once() is called, the injected fetch_all callable is invoked.

    This covers the scheduling trigger logic in a testable way without
    relying on real timers.
    """
    fetch_all = MagicMock()
    scheduler = FeedFetchScheduler(fetch_all=fetch_all, interval_seconds=60.0)
    scheduler.run_once()
    fetch_all.assert_called_once()


def test_scheduler_start_and_stop_do_not_raise() -> None:
    """
    start() and stop() can be called without error.

    Allows the app lifecycle to wire the scheduler safely.
    """
    fetch_all = MagicMock()
    scheduler = FeedFetchScheduler(fetch_all=fetch_all, interval_seconds=60.0)
    scheduler.start()
    scheduler.stop()


def test_scheduler_run_once_after_stop_still_invokes_fetch() -> None:
    """
    run_once() can be used after stop() for testing or manual trigger.

    Ensures manual triggers and scheduled runs share the same job logic.
    """
    fetch_all = MagicMock()
    scheduler = FeedFetchScheduler(fetch_all=fetch_all, interval_seconds=60.0)
    scheduler.start()
    scheduler.stop()
    fetch_all.reset_mock()
    scheduler.run_once()
    fetch_all.assert_called_once()


def test_scheduler_job_failure_does_not_crash_scheduler(tmp_path: Path) -> None:
    """
    If the fetch job raises, the scheduler thread logs and continues.

    Error isolation: one run's failure must not stop the scheduler.
    """
    from app.models.feeds import FeedCreate
    from app.services.feeds import FeedService

    feed_service = FeedService(tmp_path)
    feed_service.create_feed(
        payload=FeedCreate(title="One", url="https://example.com/one"),
    )

    call_count = 0

    def failing_then_ok() -> None:
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise RuntimeError("simulated job failure")
        # second call succeeds

    scheduler = FeedFetchScheduler(fetch_all=failing_then_ok, interval_seconds=60.0)
    scheduler.run_once()
    assert call_count == 1
    scheduler.run_once()
    assert call_count == 2


def test_manual_fetch_and_scheduler_run_once_coexist(tmp_path: Path) -> None:
    """
    Manual trigger (direct fetch) and scheduler run_once share the same job;

    both can run without conflict; idempotent behaviour is preserved.
    """
    from textwrap import dedent

    from app.models.feeds import FeedCreate
    from app.services.articles import ArticleService
    from app.services.feeds import FeedService

    sample_rss = dedent("""\
        <?xml version='1.0' encoding='UTF-8'?>
        <rss version="2.0">
          <channel>
            <title>Test</title>
            <item>
              <title>Post</title>
              <link>https://example.com/post</link>
              <guid isPermaLink="false">guid-1</guid>
              <pubDate>Tue, 03 Mar 2026 00:00:00 +0000</pubDate>
            </item>
          </channel>
        </rss>
    """)

    feed_service = FeedService(tmp_path)
    feed = feed_service.create_feed(
        payload=FeedCreate(title="Test", url="https://example.com/feed"),
    )

    def _fake_fetch(url: str) -> str:
        return sample_rss

    article_service = ArticleService(data_root=tmp_path, fetch_rss=_fake_fetch)
    fetch_all = article_service.fetch_and_persist_all_feeds

    # Manual trigger
    fetch_all()
    articles_after_manual = article_service.list_articles_for_feed(feed.id)
    assert len(articles_after_manual) == 1

    # Scheduler run (same callable)
    scheduler = FeedFetchScheduler(fetch_all=fetch_all, interval_seconds=60.0)
    scheduler.run_once()
    articles_after_scheduled = article_service.list_articles_for_feed(feed.id)
    assert len(articles_after_scheduled) == 1
    assert articles_after_scheduled[0].id == articles_after_manual[0].id
