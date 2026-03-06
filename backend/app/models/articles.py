from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class Article(BaseModel):
    """
    Domain model for a single RSS article as stored on disk.
    """

    id: str
    feed_id: str
    title: str
    link: str
    description: str
    guid: str | None = None
    published_at: datetime
    title_trans: str | None = None


class ArticleRead(BaseModel):
    """Response model for article list (id, title, link, published, title_trans, favorite)."""

    id: str
    title: str
    link: str
    published: str
    title_trans: str | None = None
    favorite: bool = False
    favorited_at: str | None = None  # ISO datetime when favorited, for sort/display
