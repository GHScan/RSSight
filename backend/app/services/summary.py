"""
Service for generating and reading article AI summaries.

Supports template variables (e.g. title, content). Summary bodies are written
to Markdown files under data/feeds/{feedId}/articles/{articleId}/summaries/{profileName}.md.
AI calls are injectable for testing; production uses OpenAI-compatible API via profile.
"""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING, Callable

from app.services.articles import ArticleNotFoundError, ArticleService
from app.services.profiles import ProfileNotFoundError, SummaryProfileService

if TYPE_CHECKING:
    from app.models.articles import Article

CallAiCallable = Callable[[str, str], str]


def make_openai_call_ai(profile_service: SummaryProfileService) -> CallAiCallable:
    """
    Build a call_ai that uses the profile's base_url, key, and model
    to call an OpenAI-compatible API (e.g. OpenAI, DeepSeek).
    """

    def call_ai(prompt: str, profile_name: str) -> str:
        from openai import OpenAI

        profile = profile_service.get_profile(profile_name)
        client = OpenAI(api_key=profile.key, base_url=str(profile.base_url))
        response = client.chat.completions.create(
            model=profile.model,
            messages=[{"role": "user", "content": prompt}],
            stream=False,
        )
        content = response.choices[0].message.content if response.choices else None
        return (content or "").strip()

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

        prompt = _render_prompt(profile.prompt_template, article)
        summary_body = self._call_ai(prompt, profile_name)

        summary_dir = self._feeds_dir / feed_id / "articles" / article_id / "summaries"
        summary_dir.mkdir(parents=True, exist_ok=True)
        md_path = summary_dir / f"{profile_name}.md"
        md_path.write_text(summary_body, encoding="utf-8")

        return summary_body

    def get_summary(
        self,
        feed_id: str,
        article_id: str,
        profile_name: str,
    ) -> str | None:
        """
        Return the content of an existing summary .md file, or None if it
        does not exist.
        """
        md_path = (
            self._feeds_dir / feed_id / "articles" / article_id / "summaries" / f"{profile_name}.md"
        )
        if not md_path.exists():
            return None
        return md_path.read_text(encoding="utf-8")


def _render_prompt(template: str, article: "Article") -> str:
    """
    Fill the prompt template with article fields.

    Supported variables: title, content, description, link.
    """
    context = {
        "title": article.title,
        "content": article.description,
        "description": article.description,
        "link": article.link,
    }
    return template.format(**context)


def _default_call_ai(prompt: str, profile_name: str) -> str:
    """Placeholder when no AI callable is injected (e.g. production will use real client)."""
    raise NotImplementedError(
        "No AI callable injected; use an OpenAI-compatible client in production."
    )
