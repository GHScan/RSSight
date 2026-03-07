"""
API tests for article summary generation and retrieval (S004).

Tests cover POST generate and GET summary endpoints with mocked AI.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.models.articles import Article
from app.models.feeds import FeedCreate
from app.models.profiles import SummaryProfileCreate
from app.services.feeds import FeedService
from app.services.profiles import SummaryProfileService
from app.services.summary import SummaryService


def _setup_feed_article_profile(tmp_path: Path) -> tuple[str, str, str]:
    """Create one feed, one article, one profile; return (feed_id, article_id, profile_name)."""
    feed_svc = FeedService(tmp_path)
    feed = feed_svc.create_feed(FeedCreate(title="Test Feed", url="https://example.com/feed.xml"))
    article = Article(
        id="art-1",
        feed_id=feed.id,
        title="My Article",
        link="https://example.com/1",
        description="Article content.",
        guid="g1",
        published_at=datetime.now(timezone.utc),
    )
    article_dir = tmp_path / "feeds" / feed.id / "articles" / article.id
    article_dir.mkdir(parents=True, exist_ok=True)
    article_dir.joinpath("article.json").write_text(
        json.dumps(article.model_dump(mode="json"), indent=2),
        encoding="utf-8",
    )
    profile_svc = SummaryProfileService(tmp_path)
    profile_svc.create_profile(
        SummaryProfileCreate(
            name="default",
            base_url="https://api.openai.com/v1",
            key="key",
            model="gpt-4",
            fields=["title", "description"],
            prompt_template="Summarize: {title}",
        )
    )
    return feed.id, article.id, "default"


def test_post_generate_returns_summary_and_writes_md(tmp_path: Path) -> None:
    """POST .../summaries/{profile_name}/generate triggers AI and returns markdown."""
    from app.api.summaries import get_summary_service

    summary_svc = SummaryService(tmp_path, call_ai=lambda p, n: "# Summary\n\nDone.")
    app.dependency_overrides[get_summary_service] = lambda: summary_svc
    try:
        feed_id, article_id, profile_name = _setup_feed_article_profile(tmp_path)
        client = TestClient(app)
        resp = client.post(
            f"/api/feeds/{feed_id}/articles/{article_id}/summaries/{profile_name}/generate"
        )
        assert resp.status_code == 201
        assert "# Summary" in resp.text
        assert "Done." in resp.text
        md_path = (
            tmp_path
            / "feeds"
            / feed_id
            / "articles"
            / article_id
            / "summaries"
            / f"{profile_name}.md"
        )
        assert md_path.exists()
        assert md_path.read_text(encoding="utf-8") == "# Summary\n\nDone."
    finally:
        app.dependency_overrides.pop(get_summary_service, None)


def test_get_summary_returns_existing_markdown(tmp_path: Path) -> None:
    """GET .../summaries/{profile_name} returns existing summary body."""
    from app.api.summaries import get_summary_service

    app.dependency_overrides[get_summary_service] = lambda: SummaryService(tmp_path)
    try:
        feed_id, article_id, profile_name = _setup_feed_article_profile(tmp_path)
        summary_dir = tmp_path / "feeds" / feed_id / "articles" / article_id / "summaries"
        summary_dir.mkdir(parents=True, exist_ok=True)
        summary_dir.joinpath(f"{profile_name}.md").write_text("Existing summary.", encoding="utf-8")
        client = TestClient(app)
        resp = client.get(f"/api/feeds/{feed_id}/articles/{article_id}/summaries/{profile_name}")
        assert resp.status_code == 200
        assert resp.text == "Existing summary."
    finally:
        app.dependency_overrides.pop(get_summary_service, None)


def test_get_summary_not_found_returns_404(tmp_path: Path) -> None:
    """GET summary when file does not exist returns 404."""
    from app.api.summaries import get_summary_service

    app.dependency_overrides[get_summary_service] = lambda: SummaryService(tmp_path)
    try:
        feed_id, article_id, profile_name = _setup_feed_article_profile(tmp_path)
        client = TestClient(app)
        resp = client.get(f"/api/feeds/{feed_id}/articles/{article_id}/summaries/{profile_name}")
        assert resp.status_code == 404
        data = resp.json()
        assert data["detail"]["code"] == "SUMMARY_NOT_FOUND"
    finally:
        app.dependency_overrides.pop(get_summary_service, None)


def test_delete_summary_returns_204(tmp_path: Path) -> None:
    """DELETE summary returns 204; subsequent GET returns 404."""
    from app.api.summaries import get_summary_service

    summary_svc = SummaryService(tmp_path, call_ai=lambda p, n: "x")
    app.dependency_overrides[get_summary_service] = lambda: summary_svc
    try:
        feed_id, article_id, profile_name = _setup_feed_article_profile(tmp_path)
        summary_svc.generate_summary(
            feed_id=feed_id, article_id=article_id, profile_name=profile_name
        )
        client = TestClient(app)
        resp = client.delete(f"/api/feeds/{feed_id}/articles/{article_id}/summaries/{profile_name}")
        assert resp.status_code == 204
        get_resp = client.get(
            f"/api/feeds/{feed_id}/articles/{article_id}/summaries/{profile_name}"
        )
        assert get_resp.status_code == 404
    finally:
        app.dependency_overrides.pop(get_summary_service, None)


def test_list_summaries_meta_returns_200_and_list(tmp_path: Path) -> None:
    """GET .../summaries (no profile) returns list of { profile_name, generated_at }."""
    from app.api.summaries import get_summary_service

    summary_svc = SummaryService(tmp_path, call_ai=lambda p, n: "# Summary\n\nDone.")
    app.dependency_overrides[get_summary_service] = lambda: summary_svc
    try:
        feed_id, article_id, profile_name = _setup_feed_article_profile(tmp_path)
        client = TestClient(app)
        list_resp = client.get(f"/api/feeds/{feed_id}/articles/{article_id}/summaries")
        assert list_resp.status_code == 200
        assert list_resp.json() == []

        client.post(
            f"/api/feeds/{feed_id}/articles/{article_id}/summaries/{profile_name}/generate"
        )
        list_resp2 = client.get(f"/api/feeds/{feed_id}/articles/{article_id}/summaries")
        assert list_resp2.status_code == 200
        data = list_resp2.json()
        assert len(data) == 1
        assert data[0]["profile_name"] == profile_name
        assert "generated_at" in data[0]
    finally:
        app.dependency_overrides.pop(get_summary_service, None)


def test_post_generate_ai_not_configured_returns_503(tmp_path: Path) -> None:
    """POST generate when no AI callable is injected returns 503 with clear message."""
    from app.api.summaries import get_summary_service

    app.dependency_overrides[get_summary_service] = lambda: SummaryService(tmp_path)
    try:
        feed_id, article_id, profile_name = _setup_feed_article_profile(tmp_path)
        client = TestClient(app)
        resp = client.post(
            f"/api/feeds/{feed_id}/articles/{article_id}/summaries/{profile_name}/generate"
        )
        assert resp.status_code == 503
        data = resp.json()
        assert data["detail"]["code"] == "AI_NOT_CONFIGURED"
        assert "message" in data["detail"]
    finally:
        app.dependency_overrides.pop(get_summary_service, None)
