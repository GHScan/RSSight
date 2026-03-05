from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Callable, Iterable, List, cast
from urllib.request import urlopen
from xml.etree import ElementTree as ET

from app.models.articles import Article
from app.services.feeds import FeedService

FetchRssCallable = Callable[[str], str]


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

    def list_articles_for_feed(self, feed_id: str) -> List[Article]:
        """
        Load all articles for a feed and return them in reverse
        chronological order by published_at.
        """

        articles_dir = self._feeds_dir / feed_id / "articles"
        if not articles_dir.exists():
            return []

        articles: list[Article] = []
        for entry in articles_dir.iterdir():
            if not entry.is_dir():
                continue
            article_json = entry / "article.json"
            if not article_json.exists():
                continue
            raw = json.loads(article_json.read_text(encoding="utf-8"))
            articles.append(Article.model_validate(raw))

        articles.sort(key=lambda a: a.published_at, reverse=True)
        return articles

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

    @staticmethod
    def _default_fetch_rss(url: str) -> str:
        with urlopen(url) as response:
            data = cast(bytes, response.read())
        return data.decode("utf-8")

    @staticmethod
    def _parse_rss(xml: str) -> Iterable[ParsedRssItem]:
        root = ET.fromstring(xml)
        for item in root.findall(".//item"):
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            description = item.findtext("description") or ""
            guid = item.findtext("guid")
            pubdate_text = item.findtext("pubDate") or item.findtext("pubdate")

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
