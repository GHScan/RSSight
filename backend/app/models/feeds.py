from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, HttpUrl, model_validator

FeedType = Literal["rss", "virtual"]


class Feed(BaseModel):
    """
    Domain model for a feed as stored in the index.

    Supports normal RSS feeds (feed_type="rss", url required) and virtual feeds
    (feed_type="virtual", url empty/null) e.g. for article favorites collections.
    """

    id: str
    title: str
    url: Optional[HttpUrl] = None
    feed_type: FeedType = "rss"

    @model_validator(mode="after")
    def _validate_feed_type_and_url(self) -> "Feed":
        if self.feed_type == "rss" and self.url is None:
            raise ValueError("RSS feed must have a non-empty url")
        if self.feed_type == "virtual" and self.url is not None:
            raise ValueError("Virtual feed must have empty url")
        return self


class FeedCreate(BaseModel):
    """
    Payload for creating a new feed.
    """

    title: str
    url: HttpUrl


class VirtualFeedCreate(BaseModel):
    """
    Payload for creating a virtual feed (e.g. article favorites collection).
    Only name is required; URL is not used for virtual feeds.
    """

    name: str


class FeedUpdate(BaseModel):
    """
    Payload for updating an existing feed.

    Fields are optional to allow partial updates.
    """

    title: Optional[str] = None
    url: Optional[HttpUrl] = None


class FeedRead(Feed):
    """
    Response model used by the API.
    """

    pass
