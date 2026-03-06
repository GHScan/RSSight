from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class Article(BaseModel):
    """
    Domain model for a single RSS article as stored on disk.
    Also used for custom articles under virtual feeds (link/description may be empty;
    source is optional metadata for custom articles).
    """

    id: str
    feed_id: str
    title: str
    link: str
    description: str
    guid: str | None = None
    published_at: datetime
    title_trans: str | None = None
    source: str | None = None  # Optional; used for custom-article source metadata


class ArticleRead(BaseModel):
    """Response model for article list; includes optional source for custom articles."""

    id: str
    title: str
    link: str
    published: str
    title_trans: str | None = None
    favorite: bool = False
    favorited_at: str | None = None  # ISO datetime when favorited, for sort/display
    source: str | None = None  # Optional; custom article source metadata
