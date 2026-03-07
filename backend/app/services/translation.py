"""
Background title translation for articles (S019).

Batch-only: accepts a list of keys (e.g. article titles), calls AI once with a
fixed prompt to fill JSON values in Chinese, parses the response as JSON and
returns a dict for lookup. The backend collects up to 64 untranslated titles
per pass and applies the returned translations to articles.

Uses profile "translation" only for API config (base_url, key, model);
the prompt is fixed and does not use the profile's prompt_template.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Callable

from app.services.articles import ArticleService
from app.services.feeds import FeedService
from app.services.profiles import ProfileNotFoundError, SummaryProfileService

# Callable: (prompt: str, profile_name: str) -> str
CallAiCallable = Callable[[str, str], str]

TRANSLATION_PROFILE_NAME = "translation"

FIXED_PROMPT = """用中文翻译补全下面json字段中的value，返回json

例子：
输入: {{"america":""}}  
输出: {{"america":"美洲"}}

{payload}"""


def _strip_json_code_block(raw: str) -> str:
    """Remove optional markdown code fence (e.g. ```json...) so response parses as JSON."""
    s = raw.strip()
    if s.startswith("```"):
        # Skip past first line (```json or ```)
        first_nl = s.find("\n")
        s = s[first_nl + 1 :] if first_nl != -1 else s[3:].lstrip()
        if s.endswith("```"):
            s = s[:-3].rstrip()
    return s


def _parse_translation_response(response: str) -> dict[str, Any] | None:
    """Parse AI response as JSON dict. Returns None on failure."""
    raw = _strip_json_code_block(response.strip())
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    return data


def translate_batch(
    keys: list[str],
    call_ai: CallAiCallable,
    logger: logging.Logger | None = None,
) -> dict[str, str]:
    """
    Translate a list of keys (e.g. article titles) to Chinese in one AI call.
    Uses a fixed prompt; ignores profile prompt_template. Returns a dict
    key -> translated value (only keys present in the response and with string values).
    """
    if not keys:
        return {}
    payload = json.dumps({k: "" for k in keys}, ensure_ascii=False)
    prompt = FIXED_PROMPT.format(payload=payload)
    response = call_ai(prompt, TRANSLATION_PROFILE_NAME)
    data = _parse_translation_response(response)
    if data is None:
        return {}
    return {k: str(v) for k, v in data.items() if isinstance(v, str) and k in keys}


def run_translation_pass(
    data_root: Path,
    call_ai: CallAiCallable,
    article_service: ArticleService | None = None,
    profile_service: SummaryProfileService | None = None,
    feed_service: FeedService | None = None,
    logger: logging.Logger | None = None,
) -> int:
    """
    One pass: collect up to 64 unique titles from articles without title_trans
    across all feeds, call translate_batch once, then update every such article
    whose title appears in the result. If the translation profile does not
    exist, the pass does nothing (no exception).
    Returns the number of articles updated this pass (0 if none or skipped).
    """
    from app.services.feeds import FeedService

    profile_svc = profile_service or SummaryProfileService(data_root)
    try:
        profile_svc.get_profile(TRANSLATION_PROFILE_NAME)
    except ProfileNotFoundError:
        if logger:
            logger.info(
                "Translation pass skipped: profile %r not found",
                TRANSLATION_PROFILE_NAME,
            )
        return 0

    feed_svc = feed_service or FeedService(data_root)
    art_svc = article_service or ArticleService(data_root)
    feeds = feed_svc.list_feeds()

    # Collect (feed_id, article_id, title) for articles without title_trans
    candidates: list[tuple[str, str, str]] = []
    seen_titles: set[str] = set()
    unique_titles: list[str] = []

    for feed in feeds:
        for article in art_svc.list_articles_for_feed(feed.id):
            if article.title_trans:
                continue
            candidates.append((feed.id, article.id, article.title))
            if article.title not in seen_titles and len(unique_titles) < 64:
                seen_titles.add(article.title)
                unique_titles.append(article.title)

    if not unique_titles:
        if logger:
            logger.info("Translation pass: no articles without title_trans")
        return 0

    if logger:
        logger.info(
            "Translation pass: %d articles without title_trans, translating %d unique titles",
            len(candidates),
            len(unique_titles),
        )
    try:
        trans_map = translate_batch(unique_titles, call_ai, logger=logger)
    except Exception:  # noqa: BLE001
        if logger:
            logger.warning("Translation batch failed", exc_info=True)
        return 0

    if not trans_map:
        if logger:
            logger.warning(
                "Translation pass: API returned no valid JSON translations "
                "(check model response format)"
            )
        return 0

    updated = 0
    for feed_id, article_id, title in candidates:
        if title not in trans_map:
            continue
        try:
            art_svc.update_article_title_trans(feed_id, article_id, trans_map[title])
            updated += 1
        except Exception:  # noqa: BLE001
            if logger:
                logger.warning(
                    "Failed to persist title_trans feed_id=%s article_id=%s",
                    feed_id,
                    article_id,
                    exc_info=True,
                )
    if logger:
        logger.info(
            "Translation pass done: updated %d articles with title_trans",
            updated,
        )
    return updated
