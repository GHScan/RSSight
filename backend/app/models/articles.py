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
    """
    Response model for article list API (id, title, link, published, optional title_trans).
    """

    id: str
    title: str
    link: str
    published: str
    title_trans: str | None = None
