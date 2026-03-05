import logging
import os
import traceback
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from app.api.feeds import router as feeds_router
from app.api.profiles import router as profiles_router
from app.api.summaries import router as summaries_router
from app.services.articles import ArticleService
from app.services.scheduler import FeedFetchScheduler


def get_data_root() -> Path:
    """
    Return the root directory for all business data.

    By default this points to the project-level ``data`` directory.
    """

    # backend/app/main.py -> backend/app -> backend -> project root
    return Path(__file__).resolve().parents[2] / "data"


# Default interval for scheduled feed fetch (seconds).
FEED_FETCH_INTERVAL_SECONDS = 300.0


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:  # noqa: ARG001
    """Start the feed fetch scheduler on startup; stop it on shutdown."""
    data_root = get_data_root()
    article_service = ArticleService(
        data_root=data_root,
        logger=logging.getLogger(__name__),
    )
    scheduler = FeedFetchScheduler(
        fetch_all=article_service.fetch_and_persist_all_feeds,
        interval_seconds=FEED_FETCH_INTERVAL_SECONDS,
    )
    scheduler.start()
    yield
    scheduler.stop()


app = FastAPI(title="WebRSSReader API", version="0.1.0", lifespan=lifespan)

_LOG = logging.getLogger(__name__)


def _debug_mode() -> bool:
    """Return True when WEBRSS_DEBUG is set (e.g. 1, true, yes) for richer error responses."""
    return os.environ.get("WEBRSS_DEBUG", "").strip().lower() in ("1", "true", "yes")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Return 500 with message and optional traceback. HTTPException is passed through as-is."""
    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"message": exc.detail} if isinstance(exc.detail, str) else exc.detail)
    tb = traceback.format_exc()
    _LOG.exception("Unhandled exception: %s", exc)
    body: dict = {
        "message": str(exc) or "Internal Server Error",
        "type": type(exc).__name__,
    }
    if _debug_mode():
        body["detail"] = tb
    return JSONResponse(status_code=500, content=body)


app.include_router(feeds_router)
app.include_router(profiles_router)
app.include_router(summaries_router, prefix="/api/feeds")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
