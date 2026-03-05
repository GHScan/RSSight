from __future__ import annotations

from pathlib import Path
from textwrap import dedent

from app.models.feeds import FeedCreate
from app.services.articles import ArticleService
from app.services.feeds import FeedService

SAMPLE_RSS = dedent("""\
    <?xml version='1.0' encoding='UTF-8'?>
    <rss version="2.0">
      <channel>
        <title>Claude Blog</title>
        <link>https://claude.com/blog</link>
        <description>Latest updates from Claude Blog</description>
        <item>
          <title>Most Recent Post</title>
          <link>https://claude.com/blog/most-recent</link>
          <description>Most recent post</description>
          <guid isPermaLink="false">most-recent-guid</guid>
          <pubDate>Tue, 03 Mar 2026 00:00:00 +0000</pubDate>
        </item>
        <item>
          <title>Older Post</title>
          <link>https://claude.com/blog/older</link>
          <description>Older post</description>
          <guid isPermaLink="false">older-guid</guid>
          <pubDate>Tue, 24 Feb 2026 00:00:00 +0000</pubDate>
        </item>
      </channel>
    </rss>
    """)


def _make_feed_service(tmp_path: Path) -> FeedService:
    return FeedService(tmp_path)


def _make_article_service(tmp_path: Path, should_fail_first: bool = False) -> ArticleService:
    """
    Helper to construct an ArticleService with a controllable RSS fetcher.
    """

    def _fake_fetch(url: str) -> str:
        # The URL is not used by the implementation for logic decisions in tests,
        # but we keep it in the signature to mirror the real fetcher.
        if should_fail_first and "fail-me" in url:
            raise RuntimeError("simulated fetch failure")
        return SAMPLE_RSS

    return ArticleService(data_root=tmp_path, fetch_rss=_fake_fetch)


def test_fetch_and_persist_articles_for_single_feed_happy_path(tmp_path: Path) -> None:
    """
    Happy path: fetching articles for a single feed should persist them under
    data/feeds/{feedId}/articles and list them in reverse chronological order.
    """

    feed_service = _make_feed_service(tmp_path)
    feed = feed_service.create_feed(
        payload=FeedCreate(
            title="Claude Blog",
            url="https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_claude.xml",
        )
    )

    article_service = _make_article_service(tmp_path)

    article_service.fetch_and_persist_all_feeds()

    articles = article_service.list_articles_for_feed(feed.id)
    assert len(articles) == 2
    assert articles[0].published_at >= articles[1].published_at


def test_fetch_is_idempotent_for_duplicate_items(tmp_path: Path) -> None:
    """
    Idempotency: running the fetch process twice for the same feed should not
    create duplicate persisted articles.
    """

    feed_service = _make_feed_service(tmp_path)
    feed = feed_service.create_feed(
        payload=FeedCreate(
            title="Claude Blog",
            url="https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_claude.xml",
        )
    )

    article_service = _make_article_service(tmp_path)

    article_service.fetch_and_persist_all_feeds()
    first_run_articles = article_service.list_articles_for_feed(feed.id)
    assert len(first_run_articles) == 2

    article_service.fetch_and_persist_all_feeds()
    second_run_articles = article_service.list_articles_for_feed(feed.id)
    assert len(second_run_articles) == 2


def test_failure_for_one_feed_does_not_block_others(tmp_path: Path) -> None:
    """
    Error isolation: a failure while fetching one feed must not prevent
    fetching articles for other feeds.
    """

    feed_service = _make_feed_service(tmp_path)

    failing_feed = feed_service.create_feed(
        payload=FeedCreate(
            title="Failing Feed",
            url="https://example.com/fail-me",
        )
    )
    successful_feed = feed_service.create_feed(
        payload=FeedCreate(
            title="Claude Blog",
            url="https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_claude.xml",
        )
    )

    article_service = _make_article_service(tmp_path, should_fail_first=True)

    article_service.fetch_and_persist_all_feeds()

    failing_articles = article_service.list_articles_for_feed(failing_feed.id)
    successful_articles = article_service.list_articles_for_feed(successful_feed.id)

    assert failing_articles == []
    assert len(successful_articles) == 2
