"""
Background title translation for articles (S019).

Uses a summary profile named "translation": the article title is sent as the
prompt; the API response is split by ASCII double quote (") and the last
non-empty segment is used as title_trans. title_trans is persisted on the
article and shown in the UI when present.

Note: Background translation must NOT update the profile's last_used_at; that
field is only updated when the user explicitly uses a profile (e.g. for summary).
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Callable

from app.services.articles import ArticleService
from app.services.profiles import ProfileNotFoundError, SummaryProfileService

# Callable: (prompt: str, profile_name: str) -> str
CallAiCallable = Callable[[str, str], str]

TRANSLATION_PROFILE_NAME = "translation"


def parse_translation_response(raw: str) -> str | None:
    """
    Split response by ASCII double quote (") and return the last non-empty segment.
    Returns None if no non-empty segment.
    """
    segments = raw.split('"')
    for i in range(len(segments) - 1, -1, -1):
        s = segments[i].strip()
        if s:
            return s
    return None


def _render_translation_prompt(template: str, title: str) -> str:
    """Fill prompt template with title; use empty string for content/description/link."""
    return template.format(title=title, content="", description="", link="")


def translate_article_title(
    call_ai: CallAiCallable,
    article_service: ArticleService,
    feed_id: str,
    article_id: str,
    title: str,
    profile_name: str = TRANSLATION_PROFILE_NAME,
    profile_service: SummaryProfileService | None = None,
) -> bool:
    """
    Translate an article title using the named profile and persist title_trans.
    When profile_service is given, the prompt is built from the profile's prompt_template;
    otherwise the raw title is sent as the prompt (for backward compatibility).
    Returns True if translation was applied, False if skipped (e.g. profile missing).
    Raises only on unexpected errors (e.g. article not found).
    """
    try:
        if profile_service is not None:
            profile = profile_service.get_profile(profile_name)
            prompt = _render_translation_prompt(profile.prompt_template, title)
        else:
            prompt = title
        response = call_ai(prompt, profile_name)
    except ProfileNotFoundError:
        return False
    title_trans = parse_translation_response(response)
    if not title_trans:
        return False
    article_service.update_article_title_trans(feed_id, article_id, title_trans)
    return True


def run_translation_pass(
    data_root: Path,
    call_ai: CallAiCallable,
    article_service: ArticleService | None = None,
    profile_service: SummaryProfileService | None = None,
    feed_service: "FeedService | None" = None,  # noqa: F821
    logger: logging.Logger | None = None,
) -> None:
    """
    One pass: for each feed, list articles; for each article without title_trans,
    try to translate via the "translation" profile. Failures for one article
    do not stop the pass. If the translation profile does not exist, the pass
    does nothing (no exception).
    """
    from app.services.feeds import FeedService

    profile_svc = profile_service or SummaryProfileService(data_root)
    try:
        profile_svc.get_profile(TRANSLATION_PROFILE_NAME)
    except ProfileNotFoundError:
        if logger:
            logger.debug(
                "Translation profile %r not found, skipping pass",
                TRANSLATION_PROFILE_NAME,
            )
        return

    feed_svc = feed_service or FeedService(data_root)
    art_svc = article_service or ArticleService(data_root)
    feeds = feed_svc.list_feeds()
    for feed in feeds:
        articles = art_svc.list_articles_for_feed(feed.id)
        for article in articles:
            if article.title_trans:
                continue
            try:
                translate_article_title(
                    call_ai, art_svc, feed.id, article.id, article.title,
                    profile_service=profile_svc,
                )
            except Exception:  # noqa: BLE001
                if logger:
                    logger.warning(
                        "Translation failed for feed_id=%s article_id=%s: %s",
                        feed.id,
                        article.id,
                        exc_info=True,
                    )
