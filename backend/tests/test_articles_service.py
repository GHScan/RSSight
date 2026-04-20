from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from textwrap import dedent
from unittest.mock import MagicMock

import pytest

from app.models.articles import Article
from app.models.feeds import FeedCreate
from app.services.articles import FAVORITE_MARKER, ArticleService
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

# Atom feed: link is in <link href="..."/>, entries are <entry>
SAMPLE_ATOM = dedent("""\
    <?xml version='1.0' encoding='UTF-8'?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>Example Atom</title>
      <entry>
        <title>Atom Post</title>
        <link href="https://example.com/atom-post"/>
        <summary>Short summary</summary>
        <id>urn:uuid:atom-1</id>
        <updated>2026-03-03T00:00:00Z</updated>
      </entry>
    </feed>
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


def test_fetch_and_persist_feed_single_feed_happy_path(tmp_path: Path) -> None:
    """fetch_and_persist_feed for one RSS feed persists articles and lists them."""
    feed_service = _make_feed_service(tmp_path)
    feed = feed_service.create_feed(
        payload=FeedCreate(title="Claude Blog", url="https://example.com/feed.xml"),
    )
    article_service = _make_article_service(tmp_path)
    article_service.fetch_and_persist_feed(feed.id)
    articles = article_service.list_articles_for_feed(feed.id)
    assert len(articles) == 2
    assert articles[0].published_at >= articles[1].published_at


def test_fetch_and_persist_feed_parses_atom_link_href(tmp_path: Path) -> None:
    """Atom feed with <link href="..."/> is parsed and article has correct link."""
    feed_service = _make_feed_service(tmp_path)
    feed = feed_service.create_feed(
        payload=FeedCreate(title="Atom Feed", url="https://example.com/atom.xml"),
    )
    article_service = ArticleService(tmp_path, fetch_rss=lambda _: SAMPLE_ATOM)
    article_service.fetch_and_persist_feed(feed.id)
    articles = article_service.list_articles_for_feed(feed.id)
    assert len(articles) == 1
    assert articles[0].title == "Atom Post"
    assert articles[0].link == "https://example.com/atom-post"
    assert articles[0].description == "Short summary"


def test_fetch_and_persist_feed_rejects_virtual_feed(tmp_path: Path) -> None:
    """fetch_and_persist_feed for a virtual feed raises ValueError."""
    feed_service = _make_feed_service(tmp_path)
    virtual = feed_service.create_virtual_feed("Favorites")
    article_service = _make_article_service(tmp_path)
    with pytest.raises(ValueError, match="only supported for RSS"):
        article_service.fetch_and_persist_feed(virtual.id)


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


def test_feed_failure_is_logged_when_logger_provided(tmp_path: Path) -> None:
    """
    When a feed fails and a logger is provided, the failure is logged.

    Ensures error isolation and logging are clear (S006).
    """
    feed_service = FeedService(tmp_path)
    feed_service.create_feed(
        payload=FeedCreate(
            title="Failing Feed",
            url="https://example.com/fail-me",
        ),
    )
    feed_service.create_feed(
        payload=FeedCreate(
            title="Ok Feed",
            url="https://example.com/ok",
        ),
    )

    def _fake_fetch(url: str) -> str:
        if "fail-me" in url:
            raise RuntimeError("simulated fetch failure")
        return SAMPLE_RSS

    logger = MagicMock()
    article_service = ArticleService(
        data_root=tmp_path,
        fetch_rss=_fake_fetch,
        logger=logger,
    )
    article_service.fetch_and_persist_all_feeds()

    # Logger should have been called for the failing feed (e.g. warning or exception).
    assert logger.warning.called or logger.exception.called or logger.error.called


def test_set_article_favorite_creates_and_removes_marker(tmp_path: Path) -> None:
    """Favorite state is persisted via marker file; set False removes it."""
    feed_svc = FeedService(tmp_path)
    feed = feed_svc.create_feed(FeedCreate(title="F", url="https://example.com/feed.xml"))
    article = Article(
        id="art-1",
        feed_id=feed.id,
        title="T",
        link="https://example.com/1",
        description="",
        guid="g1",
        published_at=datetime.now(timezone.utc),
    )
    article_dir = tmp_path / "feeds" / feed.id / "articles" / article.id
    article_dir.mkdir(parents=True)
    article_dir.joinpath("article.json").write_text(
        json.dumps(article.model_dump(mode="json"), indent=2),
        encoding="utf-8",
    )
    art_svc = ArticleService(tmp_path)
    assert (article_dir / FAVORITE_MARKER).exists() is False
    art_svc.set_article_favorite(feed.id, article.id, True)
    assert (article_dir / FAVORITE_MARKER).exists() is True
    art_svc.set_article_favorite(feed.id, article.id, False)
    assert (article_dir / FAVORITE_MARKER).exists() is False


def test_list_articles_with_favorites_sort_order(tmp_path: Path) -> None:
    """List order: recently favorited first, then earlier favorited, then by published_at desc."""
    feed_svc = FeedService(tmp_path)
    feed = feed_svc.create_feed(FeedCreate(title="F", url="https://example.com/feed.xml"))
    base = datetime(2026, 3, 1, 12, 0, 0, tzinfo=timezone.utc)
    for i, (aid, pub) in enumerate(
        [("a1", base), ("a2", base.replace(day=2)), ("a3", base.replace(day=3))]
    ):
        article_dir = tmp_path / "feeds" / feed.id / "articles" / aid
        article_dir.mkdir(parents=True)
        art = Article(
            id=aid,
            feed_id=feed.id,
            title=f"Title {i}",
            link=f"https://example.com/{i}",
            description="",
            guid=aid,
            published_at=pub,
        )
        article_dir.joinpath("article.json").write_text(
            json.dumps(art.model_dump(mode="json"), indent=2),
            encoding="utf-8",
        )
    # a3 newest, a2, a1 oldest. Favorite a1 (oldest) so it should come first.
    (tmp_path / "feeds" / feed.id / "articles" / "a1" / FAVORITE_MARKER).touch()
    art_svc = ArticleService(tmp_path)
    pairs = art_svc.list_articles_for_feed_with_favorites(feed.id)
    ids = [a.id for a, _ in pairs]
    assert ids[0] == "a1"
    assert ids[1] == "a3"
    assert ids[2] == "a2"


# --- S027: Custom article schema and persistence for virtual feeds ---


def test_create_custom_article_persists_and_list_returns_it(tmp_path: Path) -> None:
    """
    S027 happy path: Create custom article for virtual feed; article is stored under
    data/feeds/{feedId}/articles/{articleId}/article.json and list/get return it.
    """
    feed_svc = FeedService(tmp_path)
    feed = feed_svc.create_virtual_feed("My Favorites")
    art_svc = ArticleService(tmp_path)
    published = datetime(2026, 3, 5, 10, 0, 0, tzinfo=timezone.utc)
    created = art_svc.create_custom_article(
        feed_id=feed.id,
        title="Custom note",
        link="",
        description="Note content here",
        published_at=published,
        source=None,
    )
    assert created.id
    assert created.feed_id == feed.id
    assert created.title == "Custom note"
    assert created.link == ""
    assert created.description == "Note content here"
    assert created.published_at == published
    article_dir = tmp_path / "feeds" / feed.id / "articles" / created.id
    assert article_dir.is_dir()
    article_json = article_dir / "article.json"
    assert article_json.exists()
    raw = json.loads(article_json.read_text(encoding="utf-8"))
    assert raw["title"] == "Custom note"
    assert raw["description"] == "Note content here"
    listed = art_svc.list_articles_for_feed(feed.id)
    assert len(listed) == 1
    assert listed[0].id == created.id
    assert listed[0].title == "Custom note"
    got = art_svc.get_article(feed.id, created.id)
    assert got.title == "Custom note"
    assert got.description == "Note content here"


def test_create_custom_article_with_optional_source_persists_and_loads(tmp_path: Path) -> None:
    """S027: Custom article with optional source metadata persists and loads."""
    feed_svc = FeedService(tmp_path)
    feed = feed_svc.create_virtual_feed("Collected")
    art_svc = ArticleService(tmp_path)
    created = art_svc.create_custom_article(
        feed_id=feed.id,
        title="From blog",
        link="https://example.com/post",
        description="Content",
        published_at=datetime(2026, 3, 6, 12, 0, 0, tzinfo=timezone.utc),
        source="Example Blog",
    )
    assert created.source == "Example Blog"
    got = art_svc.get_article(feed.id, created.id)
    assert got.source == "Example Blog"


def test_create_custom_article_rejects_non_virtual_feed(tmp_path: Path) -> None:
    """S027 boundary: create_custom_article for RSS feed raises."""
    feed_svc = FeedService(tmp_path)
    feed = feed_svc.create_feed(FeedCreate(title="RSS", url="https://example.com/feed.xml"))
    art_svc = ArticleService(tmp_path)
    with pytest.raises(ValueError, match="virtual"):
        art_svc.create_custom_article(
            feed_id=feed.id,
            title="Custom",
            link="",
            description="",
            published_at=datetime.now(timezone.utc),
        )


# --- S040: Favorites collection article delete ---


def test_delete_article_removes_directory_and_list_empty(tmp_path: Path) -> None:
    """S040 happy path: delete_article removes article dir; list no longer returns it."""
    feed_svc = FeedService(tmp_path)
    feed = feed_svc.create_virtual_feed("Favorites")
    art_svc = ArticleService(tmp_path)
    created = art_svc.create_custom_article(
        feed_id=feed.id,
        title="To Remove",
        link="",
        description="Content",
        published_at=datetime(2026, 3, 7, 10, 0, 0, tzinfo=timezone.utc),
    )
    article_dir = tmp_path / "feeds" / feed.id / "articles" / created.id
    assert article_dir.is_dir()
    art_svc.delete_article(feed.id, created.id)
    assert not article_dir.exists()
    listed = art_svc.list_articles_for_feed(feed.id)
    assert len(listed) == 0


def test_delete_article_rejects_non_virtual_feed(tmp_path: Path) -> None:
    """S040: delete_article for RSS feed raises ValueError."""
    feed_svc = FeedService(tmp_path)
    feed = feed_svc.create_feed(FeedCreate(title="RSS", url="https://example.com/feed.xml"))
    article_dir = tmp_path / "feeds" / feed.id / "articles" / "art1"
    article_dir.mkdir(parents=True)
    article = Article(
        id="art1",
        feed_id=feed.id,
        title="T",
        link="",
        description="",
        guid=None,
        published_at=datetime.now(timezone.utc),
    )
    article_dir.joinpath("article.json").write_text(
        json.dumps(article.model_dump(mode="json"), indent=2),
        encoding="utf-8",
    )
    art_svc = ArticleService(tmp_path)
    with pytest.raises(ValueError, match="virtual"):
        art_svc.delete_article(feed.id, "art1")


def test_delete_article_idempotent_when_already_gone(tmp_path: Path) -> None:
    """S040: delete_article when article dir does not exist is no-op (idempotent)."""
    feed_svc = FeedService(tmp_path)
    feed = feed_svc.create_virtual_feed("Favorites")
    art_svc = ArticleService(tmp_path)
    art_svc.delete_article(feed.id, "nonexistent-id")  # does not raise
    listed = art_svc.list_articles_for_feed(feed.id)
    assert len(listed) == 0


# --- S075: Move article between virtual feeds ---


def test_move_article_relocates_directory_and_updates_feed_id_in_json(tmp_path: Path) -> None:
    """S075 happy path: article dir moves; article.json feed_id matches destination."""
    feed_svc = FeedService(tmp_path)
    feed_a = feed_svc.create_virtual_feed("A")
    feed_b = feed_svc.create_virtual_feed("B")
    art_svc = ArticleService(tmp_path)
    created = art_svc.create_custom_article(
        feed_id=feed_a.id,
        title="Move me",
        link="",
        description="D",
        published_at=datetime(2026, 3, 7, 10, 0, 0, tzinfo=timezone.utc),
    )
    src = tmp_path / "feeds" / feed_a.id / "articles" / created.id
    assert src.is_dir()
    art_svc.move_article(feed_a.id, created.id, feed_b.id)
    assert not src.exists()
    dst_json = tmp_path / "feeds" / feed_b.id / "articles" / created.id / "article.json"
    assert dst_json.exists()
    raw = json.loads(dst_json.read_text(encoding="utf-8"))
    assert raw["feed_id"] == feed_b.id
    assert len(art_svc.list_articles_for_feed(feed_a.id)) == 0
    assert len(art_svc.list_articles_for_feed(feed_b.id)) == 1


def test_move_article_raises_when_target_has_same_article_id(tmp_path: Path) -> None:
    """S075 boundary: ArticleMoveTargetConflictError when destination article id exists."""
    import shutil

    from app.services.articles import ArticleMoveTargetConflictError

    feed_svc = FeedService(tmp_path)
    feed_a = feed_svc.create_virtual_feed("A")
    feed_b = feed_svc.create_virtual_feed("B")
    art_svc = ArticleService(tmp_path)
    created = art_svc.create_custom_article(
        feed_id=feed_a.id,
        title="One",
        link="",
        description="D",
        published_at=datetime(2026, 3, 7, 10, 0, 0, tzinfo=timezone.utc),
    )
    src = tmp_path / "feeds" / feed_a.id / "articles" / created.id
    dup = tmp_path / "feeds" / feed_b.id / "articles" / created.id
    dup.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(src, dup)
    with pytest.raises(ArticleMoveTargetConflictError):
        art_svc.move_article(feed_a.id, created.id, feed_b.id)
    assert src.is_dir()


RSS_SINGLE_ITEM_V1 = dedent("""\
    <?xml version='1.0' encoding='UTF-8'?>
    <rss version="2.0">
      <channel>
        <title>Test</title>
        <item>
          <title>Same Title</title>
          <link>https://example.com/post</link>
          <description>Same body</description>
          <guid>stable-guid</guid>
          <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
        </item>
      </channel>
    </rss>
    """)

RSS_SINGLE_ITEM_V2 = dedent("""\
    <?xml version='1.0' encoding='UTF-8'?>
    <rss version="2.0">
      <channel>
        <title>Test</title>
        <item>
          <title>Same Title</title>
          <link>https://example.com/post</link>
          <description>Same body</description>
          <guid>stable-guid</guid>
          <pubDate>Wed, 15 Jul 2030 12:00:00 GMT</pubDate>
        </item>
      </channel>
    </rss>
    """)


def test_rss_refetch_pubdate_only_does_not_touch_article_json(tmp_path: Path) -> None:
    """When RSS changes only pubDate, article.json on disk keeps the first published_at."""
    feed_service = FeedService(tmp_path)
    feed = feed_service.create_feed(
        payload=FeedCreate(title="Feed", url="https://example.com/feed.xml"),
    )
    rss_versions = {"xml": RSS_SINGLE_ITEM_V1}

    def _fetch(_url: str) -> str:
        return rss_versions["xml"]

    article_service = ArticleService(tmp_path, fetch_rss=_fetch)
    article_service.fetch_and_persist_feed(feed.id)
    articles = article_service.list_articles_for_feed(feed.id)
    assert len(articles) == 1
    article_id = articles[0].id
    path = tmp_path / "feeds" / feed.id / "articles" / article_id / "article.json"
    first_pub = json.loads(path.read_text(encoding="utf-8"))["published_at"]
    mtime_first = path.stat().st_mtime_ns

    rss_versions["xml"] = RSS_SINGLE_ITEM_V2
    article_service.fetch_and_persist_feed(feed.id)
    assert path.stat().st_mtime_ns == mtime_first
    assert json.loads(path.read_text(encoding="utf-8"))["published_at"] == first_pub
