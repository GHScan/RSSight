"""
API routes for read-later collection (S060, S061).

GET    /api/read-later/check?feed_id=&article_id= -> { in_read_later: bool }
POST   /api/read-later (body: feed_id, article_id)
DELETE /api/read-later/{feed_id}/{article_id}
"""

from __future__ import annotations

from http import HTTPStatus

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.services.read_later import ReadLaterService

router = APIRouter(prefix="/api/read-later", tags=["read-later"])


class ReadLaterAddBody(BaseModel):
    """Body for add: feed_id and article_id."""

    feed_id: str
    article_id: str


def get_read_later_service() -> ReadLaterService:
    """Dependency that provides ReadLaterService bound to the current data root."""
    from app import main as app_main

    return ReadLaterService(app_main.get_data_root())


@router.get("/check")
def check_read_later(
    feed_id: str = Query(..., description="Feed id"),
    article_id: str = Query(..., description="Article id"),
    service: ReadLaterService = Depends(get_read_later_service),
) -> dict[str, bool]:
    """Return whether the article is in the read-later collection."""
    in_read_later = service.contains(feed_id=feed_id, article_id=article_id)
    return {"in_read_later": in_read_later}


@router.post("", status_code=HTTPStatus.NO_CONTENT)
def add_read_later(
    body: ReadLaterAddBody,
    service: ReadLaterService = Depends(get_read_later_service),
) -> None:
    """Add an article to read-later (or move to top if already present)."""
    service.add(feed_id=body.feed_id, article_id=body.article_id)


@router.delete("/{feed_id}/{article_id}", status_code=HTTPStatus.NO_CONTENT)
def remove_read_later(
    feed_id: str,
    article_id: str,
    service: ReadLaterService = Depends(get_read_later_service),
) -> None:
    """Remove an article from read-later. Idempotent if not present."""
    service.remove(feed_id=feed_id, article_id=article_id)
