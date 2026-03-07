"""Domain model for read-later collection (reference-only records)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ReadLaterEntry(BaseModel):
    """A single read-later reference: feed_id, article_id, and added_at for ordering."""

    feed_id: str
    article_id: str
    added_at: datetime
