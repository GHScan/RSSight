"""
Service for generating and reading article AI summaries.

Supports template variables (e.g. title, content). Summary bodies are written
to Markdown files under data/feeds/{feedId}/articles/{articleId}/summaries/{profileName}.md.
AI calls are injectable for testing; production uses OpenAI-compatible API via profile.

When RSS only provides title/short description (e.g. description same as title),
article content is fetched from the article link so the summary has real body text.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import TYPE_CHECKING, Callable
from urllib.request import Request, urlopen

from app.services.articles import ArticleNotFoundError, ArticleService
from app.services.profiles import ProfileNotFoundError, SummaryProfileService
from app.services.translation import TRANSLATION_PROFILE_NAME, translate_article_title

if TYPE_CHECKING:
    from app.models.articles import Article

CallAiCallable = Callable[[str, str], str]


def _is_volcengine(base_url: str) -> bool:
    """True if base_url is Volcengine/Ark (火山引擎)."""
    url = base_url.lower()
    return "volces.com" in url or "volcengine" in url


def _call_ai_volcengine(client, profile, prompt: str) -> str:
    """
    Volcengine Ark Responses API (参见火山引擎示例):
    client.responses.create(model=..., input=prompt, stream=True, extra_body={"thinking": {"type": "enabled"}})
    流式消费 response.output_text.delta 的 event.delta 作为最终回复正文。
    """
    kwargs = {
        "model": profile.model,
        "input": prompt,
        "stream": True,
        "extra_body": {"thinking": {"type": "enabled"}},
    }
    response = client.responses.create(**kwargs)
    parts = []
    for event in response:
        if event.type == "response.output_text.delta":
            delta = getattr(event, "delta", None)
            if delta is not None:
                parts.append(delta)
    return "".join(parts).strip()


def _call_ai_chat_completions(client, profile, prompt: str) -> str:
    """OpenAI-compatible Chat Completions API: stream and collect content."""
    kwargs = {
        "model": profile.model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": True,
    }
    if profile.reasoning_effort:
        kwargs["extra_body"] = {"reasoning": {"effort": profile.reasoning_effort}}
    stream = client.chat.completions.create(**kwargs)
    parts = []
    for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content is not None:
            parts.append(chunk.choices[0].delta.content)
    return "".join(parts).strip()


def make_openai_call_ai(profile_service: SummaryProfileService) -> CallAiCallable:
    """
    Build a call_ai that uses the profile's base_url, key, and model
    to call an OpenAI-compatible API (e.g. OpenAI, DeepSeek) or
    Volcengine Ark (火山引擎) Responses API.

    Uses streaming to avoid timeouts with deep-thinking models; the full
    response is accumulated and returned.
    """

    def call_ai(prompt: str, profile_name: str) -> str:
        from openai import OpenAI

        profile = profile_service.get_profile(profile_name)
        client = OpenAI(api_key=profile.key, base_url=str(profile.base_url))
        base_url_str = str(profile.base_url)
        if _is_volcengine(base_url_str):
            return _call_ai_volcengine(client, profile, prompt)
        return _call_ai_chat_completions(client, profile, prompt)

    return call_ai


class SummaryService:
    """
    Service responsible for triggering AI summaries for articles and
    persisting results as Markdown under
    data/feeds/{feedId}/articles/{articleId}/summaries/{profileName}.md.

    The AI call is injected so that tests can mock it without real API calls.
    """

    def __init__(
        self,
        data_root: Path,
        call_ai: CallAiCallable | None = None,
        article_service: ArticleService | None = None,
        profile_service: SummaryProfileService | None = None,
    ) -> None:
        self._data_root = data_root
        self._feeds_dir = data_root / "feeds"
        self._call_ai: CallAiCallable = call_ai or _default_call_ai
        self._article_service = article_service or ArticleService(data_root)
        self._profile_service = profile_service or SummaryProfileService(data_root)

    def generate_summary(
        self,
        feed_id: str,
        article_id: str,
        profile_name: str,
    ) -> str:
        """
        Load article and profile, build prompt from template (with title/content
        variables), call the AI, and write the result to a .md file.
        For profile "title_translation", updates article.title_trans instead and returns it.
        Returns the generated summary body.
        """
        try:
            article = self._article_service.get_article(feed_id, article_id)
        except ArticleNotFoundError:
            raise
        try:
            profile = self._profile_service.get_profile(profile_name)
        except ProfileNotFoundError:
            raise

        if profile_name == TRANSLATION_PROFILE_NAME:
            ok = translate_article_title(
                self._call_ai,
                self._article_service,
                feed_id,
                article_id,
                article.title,
                profile_name=profile_name,
                profile_service=self._profile_service,
            )
            if not ok:
                raise ValueError("Translation failed or profile not configured.")
            self._profile_service.touch_profile(profile_name)
            updated = self._article_service.get_article(feed_id, article_id)
            assert updated.title_trans is not None
            return updated.title_trans

        # 若 RSS 只有标题/短描述（如 description 与 title 相同），从文章链接抓取正文
        content_override = None
        desc = (article.description or "").strip()
        if not desc or desc == article.title or len(desc) < 200:
            content_override = _fetch_article_text(article.link)
        prompt = _render_prompt(profile.prompt_template, article, content_override=content_override)
        summary_body = self._call_ai(prompt, profile_name)

        summary_dir = self._feeds_dir / feed_id / "articles" / article_id / "summaries"
        summary_dir.mkdir(parents=True, exist_ok=True)
        md_path = summary_dir / f"{profile_name}.md"
        md_path.write_text(summary_body, encoding="utf-8")
        self._profile_service.touch_profile(profile_name)

        return summary_body

    def get_summary(
        self,
        feed_id: str,
        article_id: str,
        profile_name: str,
    ) -> str | None:
        """
        Return the content of an existing summary .md file, or None if it
        does not exist. For profile "title_translation", returns article.title_trans.
        """
        if profile_name == TRANSLATION_PROFILE_NAME:
            try:
                article = self._article_service.get_article(feed_id, article_id)
            except ArticleNotFoundError:
                return None
            return article.title_trans if article.title_trans else None

        md_path = (
            self._feeds_dir / feed_id / "articles" / article_id / "summaries" / f"{profile_name}.md"
        )
        if not md_path.exists():
            return None
        return md_path.read_text(encoding="utf-8")

    def delete_summary(
        self,
        feed_id: str,
        article_id: str,
        profile_name: str,
    ) -> None:
        """
        Remove the summary for the given article and profile (.md and .meta.json if present).
        For profile "title_translation", clears article.title_trans.
        No-op if the summary does not exist.
        """
        if profile_name == TRANSLATION_PROFILE_NAME:
            try:
                self._article_service.clear_article_title_trans(feed_id, article_id)
            except ArticleNotFoundError:
                pass
            return
        summary_dir = self._feeds_dir / feed_id / "articles" / article_id / "summaries"
        for name in (f"{profile_name}.md", f"{profile_name}.meta.json"):
            path = summary_dir / name
            if path.exists():
                path.unlink()


def _strip_html_to_text(html: str) -> str:
    """Remove script/style, strip tags, normalize whitespace. Stdlib-only."""
    text = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<style[^>]*>.*?</style>", " ", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _extract_main_content(html: str) -> str | None:
    """
    Extract inner HTML of first <article> or <main> so we don't include nav/footer.
    Handles nested tags by counting. Returns None if no article/main found.
    """
    # Find first opening <article> or <main>
    open_re = re.compile(r"<(article|main)(?:\s[^>]*)?>", re.IGNORECASE)
    close_re = re.compile(r"</(article|main)\s*>", re.IGNORECASE)
    open_match = open_re.search(html)
    if not open_match:
        return None
    want = open_match.group(1).lower()
    start = open_match.start()
    depth = 1
    pos = open_match.end()
    while depth > 0:
        next_open = open_re.search(html, pos)
        next_close = close_re.search(html, pos)
        if not next_close:
            return None
        if next_open and next_open.start() < next_close.start():
            if next_open.group(1).lower() == want:
                depth += 1
            pos = next_open.end()
        else:
            if next_close.group(1).lower() == want:
                depth -= 1
            if depth == 0:
                return html[start : next_close.end()]
            pos = next_close.end()
    return None


def _fetch_article_text(link: str) -> str | None:
    """
    Fetch article URL and return plain text body, or None on failure.
    Prefers content inside <article> or <main> to avoid nav/header/footer.
    """
    try:
        req = Request(link, headers={"User-Agent": "RSSight/1.0"})
        with urlopen(req, timeout=15) as resp:
            raw = resp.read()
        charset = resp.headers.get_content_charset() or "utf-8"
        html = raw.decode(charset, errors="replace")
        main_html = _extract_main_content(html)
        html_to_strip = main_html if main_html else html
        text = _strip_html_to_text(html_to_strip)
        return text if len(text) > 100 else None
    except Exception:
        return None


def _render_prompt(template: str, article: "Article", content_override: str | None = None) -> str:
    """
    Fill the prompt template with article fields.

    Supported variables: title, content, description, link.
    When content_override is set (e.g. fetched from article link), use it for content/description.
    """
    content = content_override if content_override is not None else article.description
    context = {
        "title": article.title,
        "content": content,
        "description": content,
        "link": article.link,
    }
    return template.format(**context)


def _default_call_ai(prompt: str, profile_name: str) -> str:
    """Placeholder when no AI callable is injected (e.g. production will use real client)."""
    raise NotImplementedError(
        "No AI callable injected; use an OpenAI-compatible client in production."
    )
