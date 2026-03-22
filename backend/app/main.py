import logging
import os
import traceback
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncGenerator

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from app.api.feeds import router as feeds_router
from app.api.profiles import router as profiles_router
from app.api.read_later import router as read_later_router
from app.api.summaries import router as summaries_router
from app.services.articles import ArticleService
from app.services.data_sync import DataRepoSyncService
from app.services.profiles import SummaryProfileService
from app.services.scheduler import FeedFetchScheduler
from app.services.summary import make_openai_call_ai
from app.services.translation import run_translation_pass


def get_data_root() -> Path:
    """
    Return the root directory for all business data.

    By default this points to the project-level ``data`` directory.
    """

    # backend/app/main.py -> backend/app -> backend -> project root
    return Path(__file__).resolve().parents[2] / "data"


# Default interval for scheduled feed fetch (seconds).
FEED_FETCH_INTERVAL_SECONDS = 300.0
# Default interval for title translation background pass (seconds).
TRANSLATION_PASS_INTERVAL_SECONDS = 600.0


def _run_startup_data_sync(data_root: Path, log: logging.Logger) -> None:
    """
    Run one data repository sync cycle at startup.

    This function is resilient to failures: errors are logged but do not crash the app.
    """
    try:
        sync_service = DataRepoSyncService(data_root=data_root)
        result = sync_service.sync()
        if result.success:
            log.info("Startup data sync completed: %s", result.message)
        else:
            log.warning("Startup data sync failed (non-fatal): %s", result.message)
    except Exception:
        # Catch any unexpected exceptions to ensure app still starts
        log.exception("Startup data sync raised unexpected exception (non-fatal)")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:  # noqa: ARG001
    """Start the feed fetch and translation schedulers on startup; stop them on shutdown."""
    # Ensure app loggers (e.g. translation pass) emit INFO to stderr for background jobs
    app_log = logging.getLogger("app")
    app_log.setLevel(logging.INFO)
    if not app_log.handlers:
        _h = logging.StreamHandler()
        _h.setFormatter(logging.Formatter("%(levelname)s %(name)s: %(message)s"))
        app_log.addHandler(_h)
    data_root = get_data_root()
    log = logging.getLogger(__name__)

    # Run data repo sync once at startup (resilient to failures)
    _run_startup_data_sync(data_root, log)

    article_service = ArticleService(data_root=data_root, logger=log)
    scheduler = FeedFetchScheduler(
        fetch_all=article_service.fetch_and_persist_all_feeds,
        interval_seconds=FEED_FETCH_INTERVAL_SECONDS,
    )
    scheduler.start()

    def _translation_job() -> None:
        profile_service = SummaryProfileService(data_root)
        call_ai = make_openai_call_ai(profile_service)
        while (
            run_translation_pass(
                data_root,
                call_ai,
                article_service=article_service,
                logger=log,
            )
            > 0
        ):
            pass  # continue until no untranslated titles left, then sleep

    translation_scheduler = FeedFetchScheduler(
        fetch_all=_translation_job,
        interval_seconds=TRANSLATION_PASS_INTERVAL_SECONDS,
    )
    translation_scheduler.start()

    yield
    translation_scheduler.stop()
    scheduler.stop()


app = FastAPI(title="RSSight API", version="0.1.0", lifespan=lifespan)

_LOG = logging.getLogger(__name__)


def _debug_mode() -> bool:
    """Return True when WEBRSS_DEBUG is set (e.g. 1, true, yes) for richer error responses."""
    return os.environ.get("WEBRSS_DEBUG", "").strip().lower() in ("1", "true", "yes")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Return 500 with message and optional traceback. HTTPException is passed through as-is."""
    if isinstance(exc, HTTPException):
        content = {"message": exc.detail} if isinstance(exc.detail, str) else exc.detail
        return JSONResponse(status_code=exc.status_code, content=content)
    tb = traceback.format_exc()
    _LOG.exception("Unhandled exception: %s", exc)
    body: dict[str, Any] = {
        "message": str(exc) or "Internal Server Error",
        "type": type(exc).__name__,
    }
    if _debug_mode():
        body["detail"] = tb
    return JSONResponse(status_code=500, content=body)


app.include_router(feeds_router)
app.include_router(profiles_router)
app.include_router(read_later_router)
app.include_router(summaries_router, prefix="/api/feeds")


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
