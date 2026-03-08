from __future__ import annotations

import json
import logging
import shutil
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Callable, Iterable, List, Tuple, cast
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

from app.models.articles import Article
from app.services.feeds import FeedService

FetchRssCallable = Callable[[str], str]

# Marker file in article directory to indicate favorite; mtime used as favorited_at.
FAVORITE_MARKER = ".favorite"


@dataclass(frozen=True)
class ArticleNotFoundError(Exception):
    feed_id: str
    article_id: str


@dataclass(frozen=True)
class ParsedRssItem:
    title: str
    link: str
    description: str
    guid: str | None
    published_at: datetime


class ArticleService:
    """
    Service responsible for fetching RSS articles for feeds and
    persisting them under data/feeds/{feedId}/articles/{articleId}/article.json.

    The RSS fetching function is injected so that tests can provide a
    fake implementation without performing real network I/O.
    """

    def __init__(
        self,
        data_root: Path,
        fetch_rss: FetchRssCallable | None = None,
        logger: logging.Logger | None = None,
    ) -> None:
        self._data_root = data_root
        self._feeds_dir = self._data_root / "feeds"
        self._fetch_rss: FetchRssCallable = fetch_rss or self._default_fetch_rss
        self._feed_service = FeedService(data_root)
        self._logger = logger

    def fetch_and_persist_all_feeds(self) -> None:
        """
        Fetch RSS for all known feeds and persist their articles.

        Failures for a single feed are isolated and must not prevent
        processing of other feeds.
        """

        feeds = self._feed_service.list_feeds()
        for feed in feeds:
            if feed.feed_type == "virtual" or feed.url is None:
                continue
            try:
                xml = self._fetch_rss(str(feed.url))
                items = self._parse_rss(xml)
                for item in items:
                    self._persist_article(feed_id=feed.id, item=item)
            except Exception as exc:  # noqa: BLE001
                if self._logger is not None:
                    self._logger.warning(
                        "Feed fetch failed for feed_id=%s url=%s: %s",
                        feed.id,
                        feed.url,
                        exc,
                        exc_info=True,
                    )
                continue

    def fetch_and_persist_feed(self, feed_id: str) -> None:
        """
        Fetch RSS for a single feed and persist its articles.

        Raises FeedNotFoundError if the feed does not exist.
        Raises ValueError if the feed is virtual or has no URL (not an RSS feed).
        Propagates network/parse errors so the caller can map to HTTP responses.
        """
        feed = self._feed_service.get_feed(feed_id)
        if feed.feed_type == "virtual" or feed.url is None:
            raise ValueError("Refresh is only supported for RSS feeds with a URL")
        xml = self._fetch_rss(str(feed.url))
        items = self._parse_rss(xml)
        for item in items:
            self._persist_article(feed_id=feed_id, item=item)

    def _get_favorited_at(self, article_dir: Path) -> datetime | None:
        """Return mtime of favorite marker if present, else None."""
        marker = article_dir / FAVORITE_MARKER
        if not marker.exists():
            return None
        try:
            return datetime.fromtimestamp(marker.stat().st_mtime, tz=timezone.utc)
        except OSError:
            return None

    def list_articles_for_feed(self, feed_id: str) -> List[Article]:
        """
        Load all articles for a feed and return them in reverse
        chronological order by published_at (legacy; no favorite sort).
        """
        pairs = self.list_articles_for_feed_with_favorites(feed_id)
        return [a for a, _ in pairs]

    def list_articles_for_feed_with_favorites(
        self, feed_id: str
    ) -> List[Tuple[Article, datetime | None]]:
        """
        Load all articles for a feed with favorite state. Sort order: most
        recently favorited first, then earlier favorited, then by published_at desc.
        """
        articles_dir = self._feeds_dir / feed_id / "articles"
        if not articles_dir.exists():
            return []

        pairs: list[Tuple[Article, datetime | None]] = []
        for entry in articles_dir.iterdir():
            if not entry.is_dir():
                continue
            article_json = entry / "article.json"
            if not article_json.exists():
                continue
            raw = json.loads(article_json.read_text(encoding="utf-8"))
            article = Article.model_validate(raw)
            favorited_at = self._get_favorited_at(entry)
            pairs.append((article, favorited_at))

        # Sort: favorited first (by favorited_at desc), then non-favorited by published_at desc.
        def sort_key(item: Tuple[Article, datetime | None]) -> Tuple[float, float, float]:
            art, fav_at = item
            # Favorited first: (False,) then (True, -ts); then non-fav: (True,) then -pub_ts
            if fav_at is not None:
                return (0, -fav_at.timestamp(), -art.published_at.timestamp())
            return (1, 0.0, -art.published_at.timestamp())

        pairs.sort(key=sort_key)
        return pairs

    def get_article(self, feed_id: str, article_id: str) -> Article:
        """
        Load a single article by feed id and article id.

        Raises ArticleNotFoundError if the article directory or article.json
        does not exist.
        """
        article_dir = self._feeds_dir / feed_id / "articles" / article_id
        article_json = article_dir / "article.json"
        if not article_json.exists():
            raise ArticleNotFoundError(feed_id=feed_id, article_id=article_id)
        raw = json.loads(article_json.read_text(encoding="utf-8"))
        return Article.model_validate(raw)

    def _persist_article(self, feed_id: str, item: ParsedRssItem) -> None:
        """
        Persist a single article in an idempotent way.

        The article ID is derived deterministically from the feed ID
        and the GUID (or link/title as a fallback), so running the
        fetch multiple times does not create duplicates.
        """

        unique_key = item.guid or item.link or item.title
        article_id = uuid.uuid5(uuid.NAMESPACE_URL, f"{feed_id}:{unique_key}").hex

        article = Article(
            id=article_id,
            feed_id=feed_id,
            title=item.title,
            link=item.link,
            description=item.description,
            guid=item.guid,
            published_at=item.published_at,
        )

        article_dir = self._feeds_dir / feed_id / "articles" / article_id
        article_dir.mkdir(parents=True, exist_ok=True)
        article_json_path = article_dir / "article.json"
        if article_json_path.exists():
            try:
                existing = json.loads(article_json_path.read_text(encoding="utf-8"))
                title_trans = existing.get("title_trans")
                if title_trans is not None:
                    article = article.model_copy(update={"title_trans": title_trans})
            except (json.JSONDecodeError, KeyError):
                pass
        payload = article.model_dump(mode="json")
        article_json_path.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    def update_article_title_trans(self, feed_id: str, article_id: str, title_trans: str) -> None:
        """
        Update the title_trans field of an article and persist to disk.
        Raises ArticleNotFoundError if the article does not exist.
        """
        article = self.get_article(feed_id, article_id)
        updated = article.model_copy(update={"title_trans": title_trans})
        article_dir = self._feeds_dir / feed_id / "articles" / article_id
        payload = updated.model_dump(mode="json")
        (article_dir / "article.json").write_text(
            json.dumps(payload, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    def clear_article_title_trans(self, feed_id: str, article_id: str) -> None:
        """
        Clear the title_trans field of an article and persist to disk.
        Raises ArticleNotFoundError if the article does not exist.
        """
        article = self.get_article(feed_id, article_id)
        updated = article.model_copy(update={"title_trans": None})
        article_dir = self._feeds_dir / feed_id / "articles" / article_id
        payload = updated.model_dump(mode="json")
        (article_dir / "article.json").write_text(
            json.dumps(payload, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    def set_article_favorite(self, feed_id: str, article_id: str, favorite: bool) -> None:
        """
        Set or clear the favorite marker for an article. Raises ArticleNotFoundError
        if the article does not exist.
        """
        self.get_article(feed_id, article_id)  # raise if not found
        article_dir = self._feeds_dir / feed_id / "articles" / article_id
        marker = article_dir / FAVORITE_MARKER
        if favorite:
            marker.touch()
        elif marker.exists():
            marker.unlink()

    def create_custom_article(
        self,
        feed_id: str,
        *,
        title: str,
        link: str = "",
        description: str = "",
        published_at: datetime,
        source: str | None = None,
    ) -> Article:
        """
        Create a custom article under a virtual feed. Persists to
        data/feeds/{feedId}/articles/{articleId}/article.json using the same
        layout as RSS articles. Raises ValueError if the feed is not virtual.
        """
        feed = self._feed_service.get_feed(feed_id)
        if feed.feed_type != "virtual":
            raise ValueError("Custom articles can only be created for virtual feeds")
        article_id = uuid.uuid4().hex
        article = Article(
            id=article_id,
            feed_id=feed_id,
            title=title,
            link=link,
            description=description,
            guid=None,
            published_at=published_at,
            title_trans=None,
            source=source,
        )
        article_dir = self._feeds_dir / feed_id / "articles" / article_id
        article_dir.mkdir(parents=True, exist_ok=True)
        payload = article.model_dump(mode="json")
        (article_dir / "article.json").write_text(
            json.dumps(payload, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        return article

    def delete_article(self, feed_id: str, article_id: str) -> None:
        """
        Delete an article from a virtual (favorites) feed. Removes the article
        directory subtree. Idempotent: if the article dir does not exist, no-op.
        Raises ValueError if the feed is not virtual (RSS articles are not deletable via this API).
        """
        feed = self._feed_service.get_feed(feed_id)
        if feed.feed_type != "virtual":
            raise ValueError("Articles can only be deleted from virtual (favorites) feeds")
        article_dir = self._feeds_dir / feed_id / "articles" / article_id
        if not article_dir.exists():
            return
        shutil.rmtree(article_dir)

    @staticmethod
    def _default_fetch_rss(url: str) -> str:
        req = Request(url, headers={"User-Agent": "RSSight/1.0 (RSS feed fetch)"})
        with urlopen(req, timeout=30) as response:
            data = cast(bytes, response.read())
        return data.decode("utf-8")

    @staticmethod
    def _local_name(tag: str) -> str:
        """Return local part of tag (no namespace)."""
        return tag.split("}")[-1] if "}" in tag else tag

    @staticmethod
    def _elem_text(el: ET.Element | None) -> str:
        if el is None:
            return ""
        return (el.text or "").strip()

    @staticmethod
    def _get_link_from_item(item: ET.Element) -> str:
        """Get link from RSS <link>text</link> or Atom <link href="..."/> (any namespace)."""
        # RSS: <link>URL</link>
        link = (item.findtext("link") or "").strip()
        if link:
            return link
        for child in item:
            if ArticleService._local_name(child.tag) == "link":
                link = (child.text or "").strip() or (child.attrib.get("href") or "").strip()
                if link:
                    return link
        return ""

    @staticmethod
    def _get_text_from_item(item: ET.Element, *names: str) -> str:
        """Get first non-empty text from child elements (any of names, any namespace)."""
        for name in names:
            text = (item.findtext(name) or "").strip()
            if text:
                return text
            for child in item:
                if ArticleService._local_name(child.tag) == name:
                    text = "".join(child.itertext()).strip()
                    if text:
                        return text
        return ""

    @staticmethod
    def _parse_rss(xml: str) -> Iterable[ParsedRssItem]:
        root = ET.fromstring(xml)
        for item in root.iter():
            local = ArticleService._local_name(item.tag)
            if local not in ("item", "entry"):
                continue
            title = ArticleService._get_text_from_item(item, "title")
            link = ArticleService._get_link_from_item(item)
            description = ArticleService._get_text_from_item(
                item, "description", "content", "summary"
            )
            guid = item.findtext("guid") or item.findtext("id")
            if guid:
                guid = guid.strip() or None
            pubdate_text = (
                item.findtext("pubDate")
                or item.findtext("pubdate")
                or item.findtext("published")
                or item.findtext("updated")
            )
            if pubdate_text:
                try:
                    published_at = parsedate_to_datetime(pubdate_text.strip())
                except (TypeError, ValueError):
                    published_at = datetime.now(timezone.utc)
            else:
                published_at = datetime.now(timezone.utc)

            yield ParsedRssItem(
                title=title,
                link=link,
                description=description,
                guid=guid,
                published_at=published_at,
            )
