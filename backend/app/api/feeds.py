from __future__ import annotations

import logging
from http import HTTPStatus
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from app.models.articles import ArticleRead
from app.models.feeds import FeedCreate, FeedRead, FeedUpdate
from app.services.articles import ArticleService
from app.services.feeds import FeedNotFoundError, FeedService

router = APIRouter(prefix="/api/feeds", tags=["feeds"])


def get_feed_service() -> FeedService:
    """
    Dependency that provides a FeedService bound to the current data root.
    """

    # Import inside the function to avoid circular imports between
    # the application entrypoint and the API router.
    from app import main as app_main

    return FeedService(app_main.get_data_root())


def get_article_service() -> ArticleService:
    """Dependency that provides ArticleService bound to the current data root."""
    from app import main as app_main

    return ArticleService(
        data_root=app_main.get_data_root(),
        logger=logging.getLogger(__name__),
    )


@router.get("", response_model=List[FeedRead])
def list_feeds(service: FeedService = Depends(get_feed_service)) -> List[FeedRead]:
    return [FeedRead.model_validate(feed.model_dump()) for feed in service.list_feeds()]


@router.post("", response_model=FeedRead, status_code=HTTPStatus.CREATED)
def create_feed(payload: FeedCreate, service: FeedService = Depends(get_feed_service)) -> FeedRead:
    created = service.create_feed(payload)
    return FeedRead.model_validate(created.model_dump())


@router.put("/{feed_id}", response_model=FeedRead)
def update_feed(
    feed_id: str,
    payload: FeedUpdate,
    service: FeedService = Depends(get_feed_service),
) -> FeedRead | JSONResponse:
    try:
        updated = service.update_feed(feed_id, payload)
    except FeedNotFoundError as exc:
        return JSONResponse(
            status_code=HTTPStatus.NOT_FOUND,
            content={
                "code": "FEED_NOT_FOUND",
                "message": "Feed not found.",
                "details": {"feedId": exc.feed_id},
            },
        )
    return FeedRead.model_validate(updated.model_dump())


@router.delete("/{feed_id}", status_code=HTTPStatus.NO_CONTENT)
def delete_feed(feed_id: str, service: FeedService = Depends(get_feed_service)) -> None:
    try:
        service.delete_feed(feed_id)
    except FeedNotFoundError as exc:
        # For delete operations we keep the default 404 error structure,
        # which will be surfaced by FastAPI as a JSON body that matches
        # the general error contract used for updates.
        raise HTTPException(
            status_code=HTTPStatus.NOT_FOUND,
            detail={
                "code": "FEED_NOT_FOUND",
                "message": "Feed not found.",
                "details": {"feedId": exc.feed_id},
            },
        ) from exc


@router.get("/{feed_id}/articles", response_model=List[ArticleRead])
def list_articles(
    feed_id: str,
    feed_service: FeedService = Depends(get_feed_service),
    article_service: ArticleService = Depends(get_article_service),
) -> List[ArticleRead]:
    """
    List articles for a feed in reverse chronological order.
    Returns 404 if the feed does not exist.
    """
    try:
        feed_service.get_feed(feed_id)
    except FeedNotFoundError as exc:
        raise HTTPException(
            status_code=HTTPStatus.NOT_FOUND,
            detail={
                "code": "FEED_NOT_FOUND",
                "message": "Feed not found.",
                "details": {"feedId": exc.feed_id},
            },
        ) from exc
    articles = article_service.list_articles_for_feed(feed_id)
    return [
        ArticleRead(
            id=a.id,
            title=a.title,
            link=a.link,
            published=a.published_at.isoformat(),
            title_trans=a.title_trans,
        )
        for a in articles
    ]
