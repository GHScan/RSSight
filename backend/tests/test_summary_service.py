"""
Tests for SummaryService: manual trigger of article AI summaries.

Templates support variables (e.g. title, content). Summary results are written
to .md files. AI calls are mockable.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from app.models.articles import Article
from app.models.feeds import FeedCreate
from app.models.profiles import SummaryProfileCreate
from app.services.articles import ArticleNotFoundError
from app.services.feeds import FeedService
from app.services.profiles import ProfileNotFoundError, SummaryProfileService
from app.services.summary import SummaryService
from app.services.translation import TRANSLATION_PROFILE_NAME


def _make_feed_and_article(tmp_path: Path) -> tuple[str, str]:
    """Create one feed and one article on disk; return (feed_id, article_id)."""
    feed_svc = FeedService(tmp_path)
    feed = feed_svc.create_feed(
        payload=FeedCreate(title="Test Feed", url="https://example.com/feed.xml")
    )
    article = Article(
        id="art-1",
        feed_id=feed.id,
        title="Test Article Title",
        link="https://example.com/post",
        description="Article body content here.",
        guid="guid-1",
        published_at=datetime.now(timezone.utc),
    )
    article_dir = tmp_path / "feeds" / feed.id / "articles" / article.id
    article_dir.mkdir(parents=True, exist_ok=True)
    article_dir.joinpath("article.json").write_text(
        json.dumps(article.model_dump(mode="json"), indent=2),
        encoding="utf-8",
    )
    return feed.id, article.id


def _make_profile_service_and_profile(tmp_path: Path) -> tuple[SummaryProfileService, str]:
    """Create one summary profile; return (profile_service, profile_name)."""
    profile_svc = SummaryProfileService(tmp_path)
    profile_svc.create_profile(
        SummaryProfileCreate(
            name="default",
            base_url="https://api.openai.com/v1",
            key="test-key",
            model="gpt-4",
            fields=["title", "description"],
            prompt_template="Summarize this: {title}\n\n{content}",
        )
    )
    return profile_svc, "default"


def test_generate_summary_writes_markdown_file(tmp_path: Path) -> None:
    """
    Happy path: triggering a summary calls the AI (mocked) and writes
    the result to data/feeds/{feedId}/articles/{articleId}/summaries/{profileName}.md.
    """
    feed_id, article_id = _make_feed_and_article(tmp_path)
    _make_profile_service_and_profile(tmp_path)

    def fake_ai(prompt: str, profile_name: str) -> str:
        return "# Summary\n\nMocked summary body."

    summary_svc = SummaryService(
        data_root=tmp_path,
        call_ai=fake_ai,
    )
    summary_svc.generate_summary(feed_id=feed_id, article_id=article_id, profile_name="default")

    md_path = tmp_path / "feeds" / feed_id / "articles" / article_id / "summaries" / "default.md"
    assert md_path.exists()
    assert md_path.read_text(encoding="utf-8") == "# Summary\n\nMocked summary body."


def test_template_supports_title_and_content_variables(tmp_path: Path) -> None:
    """
    The prompt template supports variables such as title and content;
    the service passes the article title and description into the template.
    """
    feed_id, article_id = _make_feed_and_article(tmp_path)
    _make_profile_service_and_profile(tmp_path)

    received_prompts: list[str] = []

    def capture_ai(prompt: str, profile_name: str) -> str:
        received_prompts.append(prompt)
        return "Done."

    summary_svc = SummaryService(tmp_path, call_ai=capture_ai)
    summary_svc.generate_summary(feed_id=feed_id, article_id=article_id, profile_name="default")

    assert len(received_prompts) == 1
    assert "Test Article Title" in received_prompts[0]
    assert "Article body content here." in received_prompts[0]


def test_generate_uses_mocked_ai(tmp_path: Path) -> None:
    """Generate uses the injected AI callable; no real network call."""
    feed_id, article_id = _make_feed_and_article(tmp_path)
    _make_profile_service_and_profile(tmp_path)

    def mock_ai(prompt: str, profile_name: str) -> str:
        return "Custom AI output for tests."

    summary_svc = SummaryService(tmp_path, call_ai=mock_ai)
    result = summary_svc.generate_summary(
        feed_id=feed_id, article_id=article_id, profile_name="default"
    )

    assert "Custom AI output for tests." in result
    md_path = tmp_path / "feeds" / feed_id / "articles" / article_id / "summaries" / "default.md"
    assert md_path.read_text(encoding="utf-8") == "Custom AI output for tests."


def test_generate_raises_when_article_not_found(tmp_path: Path) -> None:
    """When the article does not exist, generate raises ArticleNotFoundError."""
    _make_profile_service_and_profile(tmp_path)
    summary_svc = SummaryService(tmp_path, call_ai=lambda p, n: "x")

    with pytest.raises(ArticleNotFoundError) as exc_info:
        summary_svc.generate_summary(
            feed_id="nonexistent-feed",
            article_id="nonexistent-article",
            profile_name="default",
        )
    assert exc_info.value.feed_id == "nonexistent-feed"
    assert exc_info.value.article_id == "nonexistent-article"


def test_generate_raises_when_profile_not_found(tmp_path: Path) -> None:
    """When the profile does not exist, generate raises ProfileNotFoundError."""
    feed_id, article_id = _make_feed_and_article(tmp_path)
    summary_svc = SummaryService(tmp_path, call_ai=lambda p, n: "x")

    with pytest.raises(ProfileNotFoundError) as exc_info:
        summary_svc.generate_summary(
            feed_id=feed_id,
            article_id=article_id,
            profile_name="nonexistent-profile",
        )
    assert exc_info.value.profile_name == "nonexistent-profile"


def test_get_summary_returns_existing_markdown(tmp_path: Path) -> None:
    """GET summary returns the content of an existing .md file."""
    feed_id, article_id = _make_feed_and_article(tmp_path)
    _make_profile_service_and_profile(tmp_path)
    summary_dir = tmp_path / "feeds" / feed_id / "articles" / article_id / "summaries"
    summary_dir.mkdir(parents=True, exist_ok=True)
    summary_dir.joinpath("default.md").write_text("Existing summary.", encoding="utf-8")

    summary_svc = SummaryService(tmp_path, call_ai=lambda p, n: "ignored")
    content = summary_svc.get_summary(
        feed_id=feed_id, article_id=article_id, profile_name="default"
    )

    assert content == "Existing summary."


def test_get_summary_returns_none_when_not_generated(tmp_path: Path) -> None:
    """GET summary returns None when the summary file does not exist."""
    feed_id, article_id = _make_feed_and_article(tmp_path)
    _make_profile_service_and_profile(tmp_path)
    summary_svc = SummaryService(tmp_path, call_ai=lambda p, n: "x")

    content = summary_svc.get_summary(
        feed_id=feed_id, article_id=article_id, profile_name="default"
    )

    assert content is None


def test_delete_summary_removes_markdown_file(tmp_path: Path) -> None:
    """delete_summary removes the .md file; get_summary then returns None."""
    feed_id, article_id = _make_feed_and_article(tmp_path)
    _make_profile_service_and_profile(tmp_path)
    summary_svc = SummaryService(tmp_path, call_ai=lambda p, n: "body")
    summary_svc.generate_summary(feed_id=feed_id, article_id=article_id, profile_name="default")

    md_path = tmp_path / "feeds" / feed_id / "articles" / article_id / "summaries" / "default.md"
    assert md_path.exists()

    summary_svc.delete_summary(feed_id=feed_id, article_id=article_id, profile_name="default")
    assert not md_path.exists()
    assert (
        summary_svc.get_summary(feed_id=feed_id, article_id=article_id, profile_name="default")
        is None
    )


def test_list_summaries_meta_returns_profile_and_generated_at(tmp_path: Path) -> None:
    """list_summaries_meta returns profile_name and generated_at (mtime) for each .md."""
    feed_id, article_id = _make_feed_and_article(tmp_path)
    _make_profile_service_and_profile(tmp_path)
    summary_svc = SummaryService(tmp_path, call_ai=lambda p, n: "body")
    summary_svc.generate_summary(feed_id=feed_id, article_id=article_id, profile_name="default")

    meta = summary_svc.list_summaries_meta(feed_id=feed_id, article_id=article_id)
    assert len(meta) == 1
    assert meta[0]["profile_name"] == "default"
    assert "generated_at" in meta[0]
    assert meta[0]["generated_at"]  # ISO string

    meta_empty = summary_svc.list_summaries_meta(feed_id=feed_id, article_id="nonexistent")
    assert meta_empty == []


def test_translation_profile_get_summary_returns_title_trans(tmp_path: Path) -> None:
    """For profile 'translation', get_summary returns article.title_trans (or None)."""
    feed_id, article_id = _make_feed_and_article(tmp_path)
    profile_svc = SummaryProfileService(tmp_path)
    profile_svc.create_profile(
        SummaryProfileCreate(
            name=TRANSLATION_PROFILE_NAME,
            base_url="https://api.example.com",
            key="k",
            model="m",
            fields=["title"],
            prompt_template='翻译："{title}"=>"',
        )
    )
    summary_svc = SummaryService(tmp_path, call_ai=lambda p, n: "x")
    art_svc = summary_svc._article_service
    art_svc.update_article_title_trans(feed_id, article_id, "已译标题")
    assert (
        summary_svc.get_summary(
            feed_id=feed_id, article_id=article_id, profile_name=TRANSLATION_PROFILE_NAME
        )
        == "已译标题"
    )
    art_svc.clear_article_title_trans(feed_id, article_id)
    assert (
        summary_svc.get_summary(
            feed_id=feed_id, article_id=article_id, profile_name=TRANSLATION_PROFILE_NAME
        )
        is None
    )


def test_translation_profile_generate_updates_title_trans(tmp_path: Path) -> None:
    """translation profile: generate_summary uses translate_batch, updates title_trans."""
    feed_id, article_id = _make_feed_and_article(tmp_path)
    profile_svc = SummaryProfileService(tmp_path)
    profile_svc.create_profile(
        SummaryProfileCreate(
            name=TRANSLATION_PROFILE_NAME,
            base_url="https://api.example.com",
            key="k",
            model="m",
            fields=["title"],
            prompt_template="ignored",
        )
    )

    def fake_call_ai(prompt: str, profile_name: str) -> str:
        # Batch translation returns JSON: key -> 中文
        return json.dumps({"Test Article Title": "新译文"})

    summary_svc = SummaryService(tmp_path, call_ai=fake_call_ai, profile_service=profile_svc)
    result = summary_svc.generate_summary(
        feed_id=feed_id, article_id=article_id, profile_name=TRANSLATION_PROFILE_NAME
    )
    assert result == "新译文"
    article = summary_svc._article_service.get_article(feed_id, article_id)
    assert article.title_trans == "新译文"


def test_translation_profile_delete_clears_title_trans(tmp_path: Path) -> None:
    """For profile 'translation', delete_summary clears article.title_trans."""
    feed_id, article_id = _make_feed_and_article(tmp_path)
    profile_svc = SummaryProfileService(tmp_path)
    profile_svc.create_profile(
        SummaryProfileCreate(
            name=TRANSLATION_PROFILE_NAME,
            base_url="https://api.example.com",
            key="k",
            model="m",
            fields=["title"],
            prompt_template="{title}",
        )
    )
    summary_svc = SummaryService(tmp_path, call_ai=lambda p, n: "x")
    summary_svc._article_service.update_article_title_trans(feed_id, article_id, "待删除")
    assert (
        summary_svc.get_summary(
            feed_id=feed_id, article_id=article_id, profile_name=TRANSLATION_PROFILE_NAME
        )
        == "待删除"
    )
    summary_svc.delete_summary(
        feed_id=feed_id, article_id=article_id, profile_name=TRANSLATION_PROFILE_NAME
    )
    assert (
        summary_svc.get_summary(
            feed_id=feed_id, article_id=article_id, profile_name=TRANSLATION_PROFILE_NAME
        )
        is None
    )
    article = summary_svc._article_service.get_article(feed_id, article_id)
    assert article.title_trans is None
