from __future__ import annotations

import json
import shutil
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List

from app.models.feeds import Feed, FeedCreate, FeedUpdate


@dataclass(frozen=True)
class FeedNotFoundError(Exception):
    feed_id: str


class FeedService:
    """
    Service responsible for managing feeds and their file storage.

    It maintains an index file at data/feeds.json and ensures that
    each feed has a corresponding directory at data/feeds/{feedId}.
    """

    def __init__(self, data_root: Path) -> None:
        self._data_root = data_root
        self._feeds_index_path = self._data_root / "feeds.json"
        self._feeds_dir = self._data_root / "feeds"

    def list_feeds(self) -> List[Feed]:
        return list(self._load_feeds().values())

    def get_feed(self, feed_id: str) -> Feed:
        """Return the feed by id; raise FeedNotFoundError if not found."""
        feeds = self._load_feeds()
        if feed_id not in feeds:
            raise FeedNotFoundError(feed_id)
        return feeds[feed_id]

    def create_feed(self, payload: FeedCreate) -> Feed:
        feeds = self._load_feeds()
        feed_id = uuid.uuid4().hex
        feed = Feed(id=feed_id, title=payload.title, url=payload.url)
        feeds[feed_id] = feed
        self._save_feeds(feeds)

        # Ensure the feed directory exists.
        feed_dir = self._feeds_dir / feed_id
        feed_dir.mkdir(parents=True, exist_ok=True)

        return feed

    def create_virtual_feed(self, name: str) -> Feed:
        """Create a virtual feed (e.g. article favorites collection) with no URL."""
        feeds = self._load_feeds()
        feed_id = uuid.uuid4().hex
        feed = Feed(
            id=feed_id,
            title=name,
            url=None,
            feed_type="virtual",
        )
        feeds[feed_id] = feed
        self._save_feeds(feeds)

        feed_dir = self._feeds_dir / feed_id
        feed_dir.mkdir(parents=True, exist_ok=True)

        return feed

    def update_feed(self, feed_id: str, payload: FeedUpdate) -> Feed:
        feeds = self._load_feeds()
        if feed_id not in feeds:
            raise FeedNotFoundError(feed_id)

        existing = feeds[feed_id]
        updated = existing.model_copy(
            update={
                "title": payload.title if payload.title is not None else existing.title,
                "url": payload.url if payload.url is not None else existing.url,
            }
        )
        feeds[feed_id] = updated
        self._save_feeds(feeds)
        return updated

    def delete_feed(self, feed_id: str) -> None:
        feeds = self._load_feeds()
        if feed_id not in feeds:
            raise FeedNotFoundError(feed_id)

        # Remove from index first, then persist.
        feeds.pop(feed_id)
        self._save_feeds(feeds)

        # Then delete the feed directory subtree, if it exists.
        feed_dir = self._feeds_dir / feed_id
        if feed_dir.exists():
            shutil.rmtree(feed_dir)

    def _load_feeds(self) -> Dict[str, Feed]:
        if not self._feeds_index_path.exists():
            return {}

        raw = json.loads(self._feeds_index_path.read_text(encoding="utf-8"))
        # The index is stored as a dict mapping id -> feed dict.
        return {feed_id: Feed.model_validate(feed_data) for feed_id, feed_data in raw.items()}

    def _save_feeds(self, feeds: Dict[str, Feed]) -> None:
        self._data_root.mkdir(parents=True, exist_ok=True)
        self._feeds_dir.mkdir(parents=True, exist_ok=True)
        serialisable = {feed_id: feed.model_dump(mode="json") for feed_id, feed in feeds.items()}
        self._feeds_index_path.write_text(
            json.dumps(serialisable, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
