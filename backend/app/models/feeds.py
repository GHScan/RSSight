from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, HttpUrl


class Feed(BaseModel):
    """
    Domain model for a single RSS feed as stored in the index.
    """

    id: str
    title: str
    url: HttpUrl


class FeedCreate(BaseModel):
    """
    Payload for creating a new feed.
    """

    title: str
    url: HttpUrl


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
