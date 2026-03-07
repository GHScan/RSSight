from __future__ import annotations

import logging
from datetime import datetime, timezone
from http import HTTPStatus
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.models.articles import ArticleRead, CustomArticleCreate
from app.models.feeds import FeedCreate, FeedRead, FeedUpdate, VirtualFeedCreate
from app.services.articles import ArticleNotFoundError, ArticleService
from app.services.feeds import FeedNotFoundError, FeedService
from app.services.url_autofill import fetch_and_parse_url


class FavoriteUpdate(BaseModel):
    favorite: bool


class ExtractUrlRequest(BaseModel):
    url: str


class ExtractUrlResponse(BaseModel):
    title: str | None = None
    description: str | None = None
    published_at: str | None = None  # ISO datetime string for frontend


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


FeedListDomain = Literal["rss", "favorites"]


@router.get("", response_model=List[FeedRead])
def list_feeds(
    domain: Optional[FeedListDomain] = Query(None, description="Filter: rss or favorites"),
    service: FeedService = Depends(get_feed_service),
) -> List[FeedRead]:
    feeds = service.list_feeds()
    if domain == "rss":
        feeds = [f for f in feeds if f.feed_type == "rss"]
    elif domain == "favorites":
        feeds = [f for f in feeds if f.feed_type == "virtual"]
    return [FeedRead.model_validate(feed.model_dump()) for feed in feeds]


@router.post("", response_model=FeedRead, status_code=HTTPStatus.CREATED)
def create_feed(payload: FeedCreate, service: FeedService = Depends(get_feed_service)) -> FeedRead:
    created = service.create_feed(payload)
    return FeedRead.model_validate(created.model_dump())


@router.post("/virtual", response_model=FeedRead, status_code=HTTPStatus.CREATED)
def create_virtual_feed(
    payload: VirtualFeedCreate,
    service: FeedService = Depends(get_feed_service),
) -> FeedRead:
    """Create a virtual feed (e.g. article favorites collection) with name only; no URL."""
    created = service.create_virtual_feed(payload.name)
    return FeedRead.model_validate(created.model_dump())


@router.post("/extract-url", response_model=ExtractUrlResponse)
def extract_url_metadata(payload: ExtractUrlRequest) -> ExtractUrlResponse:
    """Extract title, description, published_at from a URL for form prefill. Does not create any article."""
    url = (payload.url or "").strip()
    if not url:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail={
                "code": "MISSING_URL",
                "message": "URL is required.",
            },
        )
    try:
        parsed = fetch_and_parse_url(url)
    except OSError as exc:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail={
                "code": "AUTOFILL_FAILED",
                "message": "Could not fetch or parse URL for autofill.",
                "details": {"reason": str(exc)},
            },
        ) from exc
    title = (parsed.get("title") or "").strip() or None
    description = (parsed.get("description") or "").strip() or None
    pub_dt = parsed.get("published_at")
    published_at = pub_dt.isoformat() if isinstance(pub_dt, datetime) else None
    return ExtractUrlResponse(title=title, description=description, published_at=published_at)


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


@router.get("/{feed_id}", response_model=FeedRead)
def get_feed(
    feed_id: str,
    service: FeedService = Depends(get_feed_service),
) -> FeedRead:
    """Return a single feed by id; 404 if not found."""
    try:
        feed = service.get_feed(feed_id)
    except FeedNotFoundError as exc:
        raise HTTPException(
            status_code=HTTPStatus.NOT_FOUND,
            detail={
                "code": "FEED_NOT_FOUND",
                "message": "Feed not found.",
                "details": {"feedId": exc.feed_id},
            },
        ) from exc
    return FeedRead.model_validate(feed.model_dump())


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
    pairs = article_service.list_articles_for_feed_with_favorites(feed_id)
    return [
        ArticleRead(
            id=a.id,
            title=a.title,
            link=a.link,
            published=a.published_at.isoformat(),
            title_trans=a.title_trans,
            favorite=favorited_at is not None,
            favorited_at=favorited_at.isoformat() if favorited_at else None,
            source=a.source,
        )
        for a, favorited_at in pairs
    ]


def _resolve_custom_article_payload(payload: CustomArticleCreate) -> tuple[str, str, str, datetime]:
    """
    Resolve title, link, description, published_at from payload; when link is provided
    and fields are missing, run URL autofill and merge (S029). Never overwrite user values.
    No-URL path (S031): title and description (content) are mandatory; published_at
    defaults to now when absent. Returns (title, link, description, published_at).
    Raises HTTPException on failure.
    """
    link = (payload.link or "").strip()
    title = (payload.title or "").strip()
    description = (payload.description or "").strip()
    published_at: datetime | None = payload.published_at

    if link and (not title or not description or published_at is None):
        try:
            parsed = fetch_and_parse_url(link)
        except OSError as exc:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail={
                    "code": "AUTOFILL_FAILED",
                    "message": "Could not fetch or parse URL for autofill.",
                    "details": {"reason": str(exc)},
                },
            ) from exc
        if not title and parsed.get("title"):
            title = (parsed["title"] or "").strip()
        if not description and parsed.get("description"):
            description = (parsed["description"] or "").strip()
        if published_at is None and parsed.get("published_at"):
            published_at = parsed["published_at"]

    # No-URL path (S031): title and content (description) are mandatory.
    if not link:
        missing_no_url: List[str] = []
        if not title:
            missing_no_url.append("title")
        if not description:
            missing_no_url.append("description")
        if missing_no_url:
            raise HTTPException(
                status_code=HTTPStatus.BAD_REQUEST,
                detail={
                    "code": "MISSING_REQUIRED_FIELDS",
                    "message": "Title and content are required when URL is not provided.",
                    "details": {"missing": missing_no_url},
                },
            )
        if published_at is None:
            published_at = datetime.now(timezone.utc)
        return title, link, description, published_at

    # URL path (S043): one-shot extraction already ran above. If title or description
    # remain empty after extraction, reject creation; do not default.
    missing_url: List[str] = []
    if not title:
        missing_url.append("title")
    if not description:
        missing_url.append("description")
    if missing_url:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail={
                "code": "MISSING_REQUIRED_FIELDS",
                "message": "Title and content are required; URL extraction did not provide them.",
                "details": {"missing": missing_url},
            },
        )
    if published_at is None:
        published_at = datetime.now(timezone.utc)
    return title, link, description, published_at


@router.post("/{feed_id}/articles", response_model=ArticleRead, status_code=HTTPStatus.CREATED)
def create_custom_article(
    feed_id: str,
    payload: CustomArticleCreate,
    feed_service: FeedService = Depends(get_feed_service),
    article_service: ArticleService = Depends(get_article_service),
) -> ArticleRead:
    """Create custom article under virtual feed (S027/S028). URL autofill (S029)."""
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
    title, link, description, published_at = _resolve_custom_article_payload(payload)
    try:
        created = article_service.create_custom_article(
            feed_id,
            title=title,
            link=link,
            description=description,
            published_at=published_at,
            source=payload.source,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail={
                "code": "NOT_VIRTUAL_FEED",
                "message": str(exc),
                "details": {"feedId": feed_id},
            },
        ) from exc
    return ArticleRead(
        id=created.id,
        title=created.title,
        link=created.link,
        published=created.published_at.isoformat(),
        title_trans=created.title_trans,
        favorite=False,
        favorited_at=None,
        source=created.source,
    )


@router.delete("/{feed_id}/articles/{article_id}", status_code=HTTPStatus.NO_CONTENT)
def delete_article(
    feed_id: str,
    article_id: str,
    feed_service: FeedService = Depends(get_feed_service),
    article_service: ArticleService = Depends(get_article_service),
) -> None:
    """Delete an article from a favorites (virtual) feed. Idempotent. Returns 400 for RSS feeds."""
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
    try:
        article_service.delete_article(feed_id, article_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail={
                "code": "NOT_VIRTUAL_FEED",
                "message": str(exc),
                "details": {"feedId": feed_id},
            },
        ) from exc


@router.put("/{feed_id}/articles/{article_id}/favorite", status_code=HTTPStatus.NO_CONTENT)
def set_article_favorite(
    feed_id: str,
    article_id: str,
    payload: FavoriteUpdate,
    feed_service: FeedService = Depends(get_feed_service),
    article_service: ArticleService = Depends(get_article_service),
) -> None:
    """Set or clear the favorite state for an article (marker file in article folder)."""
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
    try:
        article_service.set_article_favorite(feed_id, article_id, payload.favorite)
    except ArticleNotFoundError as exc:
        raise HTTPException(
            status_code=HTTPStatus.NOT_FOUND,
            detail={
                "code": "ARTICLE_NOT_FOUND",
                "message": "Article not found.",
                "details": {"feedId": exc.feed_id, "articleId": exc.article_id},
            },
        ) from exc
