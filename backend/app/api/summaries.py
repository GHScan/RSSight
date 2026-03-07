"""
API routes for article summary generation and retrieval (S004).

GET    /api/feeds/{feed_id}/articles/{article_id}/summaries/{profile_name}
POST   /api/feeds/{feed_id}/articles/{article_id}/summaries/{profile_name}/generate
DELETE /api/feeds/{feed_id}/articles/{article_id}/summaries/{profile_name}
"""

from __future__ import annotations

from http import HTTPStatus

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse

from app.services.articles import ArticleNotFoundError
from app.services.profiles import ProfileNotFoundError, SummaryProfileService
from app.services.summary import SummaryService, make_openai_call_ai

router = APIRouter(tags=["summaries"])


def get_summary_service() -> SummaryService:
    """Dependency that provides SummaryService with OpenAI-compatible AI caller from profile."""
    from app import main as app_main

    data_root = app_main.get_data_root()
    profile_service = SummaryProfileService(data_root)
    call_ai = make_openai_call_ai(profile_service)
    return SummaryService(data_root, call_ai=call_ai)


@router.get("/{feed_id}/articles/{article_id}/summaries")
def list_summaries_meta(
    feed_id: str,
    article_id: str,
    service: SummaryService = Depends(get_summary_service),
) -> list[dict[str, str]]:
    """
    Return list of { profile_name, generated_at } for each profile that has
    a summary for this article. generated_at is the summary file mtime (ISO UTC).
    """
    return service.list_summaries_meta(feed_id=feed_id, article_id=article_id)


@router.get(
    "/{feed_id}/articles/{article_id}/summaries/{profile_name}",
    response_class=PlainTextResponse,
)
def get_summary(
    feed_id: str,
    article_id: str,
    profile_name: str,
    service: SummaryService = Depends(get_summary_service),
) -> str | None:
    """
    Return the existing summary markdown for an article and profile, or 404 if not generated.
    """
    content = service.get_summary(feed_id=feed_id, article_id=article_id, profile_name=profile_name)
    if content is None:
        raise HTTPException(
            status_code=HTTPStatus.NOT_FOUND,
            detail={
                "code": "SUMMARY_NOT_FOUND",
                "message": "Summary not found for this article and profile.",
                "details": {
                    "feedId": feed_id,
                    "articleId": article_id,
                    "profileName": profile_name,
                },
            },
        )
    return content


@router.delete(
    "/{feed_id}/articles/{article_id}/summaries/{profile_name}",
    status_code=HTTPStatus.NO_CONTENT,
)
def delete_summary(
    feed_id: str,
    article_id: str,
    profile_name: str,
    service: SummaryService = Depends(get_summary_service),
) -> None:
    """
    Delete the summary for the given article and profile. No-op if not present.
    """
    service.delete_summary(feed_id=feed_id, article_id=article_id, profile_name=profile_name)


@router.post(
    "/{feed_id}/articles/{article_id}/summaries/{profile_name}/generate",
    response_class=PlainTextResponse,
    status_code=HTTPStatus.CREATED,
)
def generate_summary(
    feed_id: str,
    article_id: str,
    profile_name: str,
    service: SummaryService = Depends(get_summary_service),
) -> str:
    """
    Trigger AI summary generation for the given article and profile; returns the summary body.
    """
    try:
        return service.generate_summary(
            feed_id=feed_id,
            article_id=article_id,
            profile_name=profile_name,
        )
    except ArticleNotFoundError as exc:
        raise HTTPException(
            status_code=HTTPStatus.NOT_FOUND,
            detail={
                "code": "ARTICLE_NOT_FOUND",
                "message": "Article not found.",
                "details": {"feedId": exc.feed_id, "articleId": exc.article_id},
            },
        ) from exc
    except ProfileNotFoundError as exc:
        raise HTTPException(
            status_code=HTTPStatus.NOT_FOUND,
            detail={
                "code": "PROFILE_NOT_FOUND",
                "message": "Summary profile not found.",
                "details": {"profileName": exc.profile_name},
            },
        ) from exc
    except NotImplementedError:
        raise HTTPException(
            status_code=HTTPStatus.SERVICE_UNAVAILABLE,
            detail={
                "code": "AI_NOT_CONFIGURED",
                "message": (
                    "AI summary is not configured. "
                    "Configure an OpenAI-compatible API key in the summary profile."
                ),
            },
        ) from None
    except ValueError as exc:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail={
                "code": "GENERATION_FAILED",
                "message": str(exc),
            },
        ) from exc
