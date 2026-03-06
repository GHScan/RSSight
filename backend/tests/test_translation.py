"""
Tests for title translation (S019): translation profile, parsing, persistence, background pass.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from app.models.articles import Article
from app.models.feeds import FeedCreate
from app.models.profiles import SummaryProfileCreate
from app.services.articles import ArticleService
from app.services.feeds import FeedService
from app.services.profiles import ProfileNotFoundError, SummaryProfileService
from app.services.summary import make_openai_call_ai
from app.services.translation import (
    TRANSLATION_PROFILE_NAME,
    parse_translation_response,
    run_translation_pass,
    translate_article_title,
)

# 项目 data 目录（backend/tests -> backend -> 项目根 -> data）
_REAL_DATA_ROOT = Path(__file__).resolve().parents[2] / "data"


def test_parse_translation_response_last_non_empty_segment() -> None:
    """Parse: split by ASCII double quote, last non-empty segment is title_trans."""
    assert parse_translation_response('foo " bar " baz') == "baz"
    assert parse_translation_response('"only one"') == "only one"
    assert parse_translation_response('a " b " c " d') == "d"
    assert parse_translation_response("no quotes") == "no quotes"
    assert parse_translation_response('" " "" trailing') == "trailing"


def test_parse_translation_response_empty_returns_none() -> None:
    """When no non-empty segment, return None."""
    assert parse_translation_response("") is None
    assert parse_translation_response('  "  "  ') is None


def test_parse_translation_response_english_to_chinese() -> None:
    """Typical translation API response: 'english' => '英语' parses to 英语."""
    # 无引号时整段即译文
    assert parse_translation_response("英语") == "英语"
    # 带引号的模板式回复，取最后一对引号内的内容
    assert parse_translation_response('翻译成中文："english"=>"英语"') == "英语"
    assert parse_translation_response('prefix " 英语 "') == "英语"


@pytest.mark.integration
def test_translation_profile_english_to_chinese_with_real_profile(tmp_path: Path) -> None:
    """
    使用 data 目录下真实的 translation profile 和真实 API 测翻译：
    标题 "english" 的翻译结果应为 "英语"。
    仅在手选时跑（pytest -m integration），且需 RUN_TRANSLATION_INTEGRATION=1；
    若 data 中无 translation profile 则跳过。
    """
    if os.environ.get("RUN_TRANSLATION_INTEGRATION") != "1":
        pytest.skip("需要 RUN_TRANSLATION_INTEGRATION=1 才执行真实 API 翻译测试")

    profile_service = SummaryProfileService(_REAL_DATA_ROOT)
    try:
        profile_service.get_profile(TRANSLATION_PROFILE_NAME)
    except ProfileNotFoundError:
        pytest.skip(f"data 中未找到 profile {TRANSLATION_PROFILE_NAME!r}")

    feed_svc = FeedService(tmp_path)
    feed = feed_svc.create_feed(FeedCreate(title="F", url="https://example.com/feed.xml"))
    article = Article(
        id="art-1",
        feed_id=feed.id,
        title="english",
        link="https://example.com/1",
        description="",
        guid="g1",
        published_at=datetime.now(timezone.utc),
    )
    article_dir = tmp_path / "feeds" / feed.id / "articles" / article.id
    article_dir.mkdir(parents=True)
    article_dir.joinpath("article.json").write_text(
        json.dumps(article.model_dump(mode="json"), indent=2),
        encoding="utf-8",
    )

    call_ai = make_openai_call_ai(profile_service)
    art_svc = ArticleService(tmp_path)
    result = translate_article_title(
        call_ai, art_svc, feed.id, article.id, "english", TRANSLATION_PROFILE_NAME,
        profile_service=profile_service,
    )
    assert result is True, "翻译应成功并写入 title_trans"

    loaded = art_svc.get_article(feed.id, article.id)
    assert loaded.title_trans == "英语", (
        f'使用 data 中真实 translation profile 时，"english" 的翻译结果应为 "英语"，实际为 {loaded.title_trans!r}'
    )


def test_translate_article_title_persists_title_trans(tmp_path: Path) -> None:
    """Happy path: call_ai returns response; title_trans is parsed and persisted."""
    feed_svc = FeedService(tmp_path)
    feed = feed_svc.create_feed(FeedCreate(title="F", url="https://example.com/feed.xml"))
    article = Article(
        id="art-1",
        feed_id=feed.id,
        title="Hello World",
        link="https://example.com/1",
        description="",
        guid="g1",
        published_at=datetime.now(timezone.utc),
    )
    article_dir = tmp_path / "feeds" / feed.id / "articles" / article.id
    article_dir.mkdir(parents=True)
    article_dir.joinpath("article.json").write_text(
        json.dumps(article.model_dump(mode="json"), indent=2),
        encoding="utf-8",
    )

    def fake_call_ai(prompt: str, profile_name: str) -> str:
        assert profile_name == TRANSLATION_PROFILE_NAME
        assert prompt == "Hello World"
        return 'something " 你好世界 "'

    art_svc = ArticleService(tmp_path)
    result = translate_article_title(fake_call_ai, art_svc, feed.id, article.id, article.title)
    assert result is True

    loaded = art_svc.get_article(feed.id, article.id)
    assert loaded.title_trans == "你好世界"


def test_translate_article_title_skips_when_profile_missing(tmp_path: Path) -> None:
    """When translation profile does not exist, translate_article_title returns False."""
    feed_svc = FeedService(tmp_path)
    feed = feed_svc.create_feed(FeedCreate(title="F", url="https://example.com/feed.xml"))
    article = Article(
        id="art-1",
        feed_id=feed.id,
        title="Hello",
        link="https://example.com/1",
        description="",
        guid="g1",
        published_at=datetime.now(timezone.utc),
    )
    article_dir = tmp_path / "feeds" / feed.id / "articles" / article.id
    article_dir.mkdir(parents=True)
    article_dir.joinpath("article.json").write_text(
        json.dumps(article.model_dump(mode="json"), indent=2),
        encoding="utf-8",
    )

    def failing_call_ai(_prompt: str, _profile_name: str) -> str:
        raise ProfileNotFoundError(TRANSLATION_PROFILE_NAME)

    art_svc = ArticleService(tmp_path)
    result = translate_article_title(failing_call_ai, art_svc, feed.id, article.id, article.title)
    assert result is False
    loaded = art_svc.get_article(feed.id, article.id)
    assert loaded.title_trans is None


def test_run_translation_pass_skips_when_no_translation_profile(tmp_path: Path) -> None:
    """When translation profile is not configured, pass does nothing and does not raise."""
    feed_svc = FeedService(tmp_path)
    feed = feed_svc.create_feed(FeedCreate(title="F", url="https://example.com/feed.xml"))
    article = Article(
        id="art-1",
        feed_id=feed.id,
        title="Hello",
        link="https://example.com/1",
        description="",
        guid="g1",
        published_at=datetime.now(timezone.utc),
    )
    article_dir = tmp_path / "feeds" / feed.id / "articles" / article.id
    article_dir.mkdir(parents=True)
    article_dir.joinpath("article.json").write_text(
        json.dumps(article.model_dump(mode="json"), indent=2),
        encoding="utf-8",
    )

    call_ai = MagicMock()
    run_translation_pass(tmp_path, call_ai)
    call_ai.assert_not_called()


def test_run_translation_pass_populates_title_trans_when_profile_exists(tmp_path: Path) -> None:
    """When translation profile exists, articles without title_trans get translated."""
    feed_svc = FeedService(tmp_path)
    feed = feed_svc.create_feed(FeedCreate(title="F", url="https://example.com/feed.xml"))
    article = Article(
        id="art-1",
        feed_id=feed.id,
        title="Original Title",
        link="https://example.com/1",
        description="",
        guid="g1",
        published_at=datetime.now(timezone.utc),
    )
    article_dir = tmp_path / "feeds" / feed.id / "articles" / article.id
    article_dir.mkdir(parents=True)
    article_dir.joinpath("article.json").write_text(
        json.dumps(article.model_dump(mode="json"), indent=2),
        encoding="utf-8",
    )

    profile_svc = SummaryProfileService(tmp_path)
    profile_svc.create_profile(
        SummaryProfileCreate(
            name=TRANSLATION_PROFILE_NAME,
            base_url="https://api.example.com",
            key="key",
            model="model",
            fields=[],
            prompt_template="{title}",
        )
    )
    profile_svc.touch_profile = MagicMock()  # 后台翻译不得更新 last_used_at

    def fake_call_ai(prompt: str, profile_name: str) -> str:
        assert profile_name == TRANSLATION_PROFILE_NAME
        return f'ignored " translated:{prompt} "'

    art_svc = ArticleService(tmp_path)
    run_translation_pass(
        tmp_path,
        fake_call_ai,
        article_service=art_svc,
        profile_service=profile_svc,
    )
    loaded = art_svc.get_article(feed.id, article.id)
    assert loaded.title_trans == "translated:Original Title"
    profile_svc.touch_profile.assert_not_called()


def test_article_persist_preserves_title_trans_on_refetch(tmp_path: Path) -> None:
    """Regression: when re-persisting an article (e.g. fetch), existing title_trans is preserved."""
    import uuid

    from app.services.articles import ArticleService, ParsedRssItem
    from app.services.feeds import FeedService

    feed_svc = FeedService(tmp_path)
    feed = feed_svc.create_feed(FeedCreate(title="F", url="https://example.com/feed.xml"))
    art_svc = ArticleService(tmp_path)
    # Use same article_id as _persist_article would derive from guid
    article_id = uuid.uuid5(uuid.NAMESPACE_URL, f"{feed.id}:guid-1").hex
    article_dir = tmp_path / "feeds" / feed.id / "articles" / article_id
    article_dir.mkdir(parents=True)
    article = Article(
        id=article_id,
        feed_id=feed.id,
        title="Title",
        link="https://example.com/1",
        description="Desc",
        guid="guid-1",
        published_at=datetime.now(timezone.utc),
        title_trans="翻译标题",
    )
    article_dir.joinpath("article.json").write_text(
        json.dumps(article.model_dump(mode="json"), indent=2),
        encoding="utf-8",
    )

    item = ParsedRssItem(
        title="Title",
        link="https://example.com/1",
        description="Desc",
        guid="guid-1",
        published_at=datetime.now(timezone.utc),
    )
    art_svc._persist_article(feed_id=feed.id, item=item)
    loaded = art_svc.get_article(feed.id, article_id)
    assert loaded.title_trans == "翻译标题"
