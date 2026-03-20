"""
Tests for title translation (S019): batch API, fixed prompt, JSON response, run_translation_pass.
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
    run_translation_pass,
    translate_batch,
)

# 项目 data 目录（backend/tests -> backend -> 项目根 -> data）
_REAL_DATA_ROOT = Path(__file__).resolve().parents[2] / "data"


def test_translate_batch_empty_keys() -> None:
    """Empty keys returns empty dict and does not call AI."""
    call_ai = MagicMock()
    assert translate_batch([], call_ai) == {}
    call_ai.assert_not_called()


def test_translate_batch_returns_parsed_json() -> None:
    """AI response is parsed as JSON and returned as dict (only requested keys, string values)."""

    def call_ai(prompt: str, profile_name: str) -> str:
        assert profile_name == TRANSLATION_PROFILE_NAME
        assert "Hello World" in prompt
        return json.dumps({"Hello World": "你好世界"})

    result = translate_batch(["Hello World"], call_ai)
    assert result == {"Hello World": "你好世界"}


def test_translate_batch_multiple_keys() -> None:
    """Multiple keys: payload is JSON dict with empty values; response dict returned."""

    def call_ai(prompt: str, profile_name: str) -> str:
        assert profile_name == TRANSLATION_PROFILE_NAME
        assert "english" in prompt and "bus" in prompt and "china" in prompt
        return json.dumps({"english": "英语", "bus": "公交车", "china": "中国"})

    result = translate_batch(["english", "bus", "china"], call_ai)
    assert result == {"english": "英语", "bus": "公交车", "china": "中国"}


def test_translate_batch_uses_fixed_prompt() -> None:
    """Prompt contains fixed instruction and example, plus payload JSON."""

    def call_ai(prompt: str, profile_name: str) -> str:
        assert "将下面 json 中任意语种的 key 翻译成简体中文的 value" in prompt
        assert "america" in prompt and "美洲" in prompt
        assert '{"key":""}' in prompt or '"key": ""' in prompt
        return json.dumps({"key": "键"})

    result = translate_batch(["key"], call_ai)
    assert result == {"key": "键"}


def test_translate_batch_invalid_json_returns_empty() -> None:
    """When AI response is not valid JSON, return empty dict."""

    def call_ai(prompt: str, profile_name: str) -> str:
        return "not json at all"

    assert translate_batch(["x"], call_ai) == {}


def test_translate_batch_non_dict_json_returns_empty() -> None:
    """When parsed JSON is not a dict, return empty dict."""

    def call_ai(prompt: str, profile_name: str) -> str:
        return "[1, 2, 3]"

    assert translate_batch(["x"], call_ai) == {}


def test_translate_batch_only_includes_requested_keys_and_string_values() -> None:
    """Extra keys in response or non-string values are ignored for requested keys."""

    def call_ai(prompt: str, profile_name: str) -> str:
        return json.dumps({"a": "一", "b": 2, "c": "三", "extra": "x"})

    result = translate_batch(["a", "c"], call_ai)
    assert result == {"a": "一", "c": "三"}


@pytest.mark.integration
def test_translation_batch_with_real_profile(tmp_path: Path) -> None:
    """
    使用 data 目录下真实的 translation profile 和真实 API 测批量翻译。
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
    trans_map = translate_batch(["english"], call_ai)
    assert "english" in trans_map, "应返回 english 的翻译"
    title_trans = trans_map["english"]
    assert title_trans == "英语", f'期望 "英语"，实际 {title_trans!r}'

    art_svc = ArticleService(tmp_path)
    art_svc.update_article_title_trans(feed.id, article.id, title_trans)
    loaded = art_svc.get_article(feed.id, article.id)
    assert loaded.title_trans == "英语"


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
    """When profile exists, collect up to 64 unique titles, call batch once, apply to articles."""
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
    profile_svc.touch_profile = MagicMock()

    def fake_call_ai(prompt: str, profile_name: str) -> str:
        assert profile_name == TRANSLATION_PROFILE_NAME
        assert "Original Title" in prompt
        return json.dumps({"Original Title": "译文标题"})

    art_svc = ArticleService(tmp_path)
    run_translation_pass(
        tmp_path,
        fake_call_ai,
        article_service=art_svc,
        profile_service=profile_svc,
    )
    loaded = art_svc.get_article(feed.id, article.id)
    assert loaded.title_trans == "译文标题"
    profile_svc.touch_profile.assert_not_called()


def test_run_translation_pass_same_title_updates_all_articles(tmp_path: Path) -> None:
    """Multiple articles with same title get same translation from one batch call."""
    feed_svc = FeedService(tmp_path)
    feed = feed_svc.create_feed(FeedCreate(title="F", url="https://example.com/feed.xml"))
    for i, aid in enumerate(["art-1", "art-2"]):
        article = Article(
            id=aid,
            feed_id=feed.id,
            title="Same Title",
            link=f"https://example.com/{i}",
            description="",
            guid=f"g{i}",
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
            prompt_template="ignored",
        )
    )

    def fake_call_ai(prompt: str, profile_name: str) -> str:
        return json.dumps({"Same Title": "同一标题"})

    art_svc = ArticleService(tmp_path)
    run_translation_pass(
        tmp_path,
        fake_call_ai,
        article_service=art_svc,
        profile_service=profile_svc,
    )
    for aid in ["art-1", "art-2"]:
        loaded = art_svc.get_article(feed.id, aid)
        assert loaded.title_trans == "同一标题"


def test_run_translation_pass_caps_at_64_unique_titles(tmp_path: Path) -> None:
    """Only first 64 unique titles are sent in one batch."""
    feed_svc = FeedService(tmp_path)
    feed = feed_svc.create_feed(FeedCreate(title="F", url="https://example.com/feed.xml"))
    for i in range(70):
        article = Article(
            id=f"art-{i}",
            feed_id=feed.id,
            title=f"Title {i}",
            link=f"https://example.com/{i}",
            description="",
            guid=f"g{i}",
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
            prompt_template="ignored",
        )
    )

    payload_keys_count: list[int] = []

    def fake_call_ai(prompt: str, profile_name: str) -> str:
        # Payload is the last part of the fixed prompt (after the example)
        payload_str = prompt.split("\n\n")[-1].strip()
        payload = json.loads(payload_str)
        payload_keys_count.append(len(payload))
        return json.dumps({k: f"译文_{k}" for k in payload})

    art_svc = ArticleService(tmp_path)
    run_translation_pass(
        tmp_path,
        fake_call_ai,
        article_service=art_svc,
        profile_service=profile_svc,
    )
    assert payload_keys_count == [64], "batch should be called once with exactly 64 keys"


def test_article_persist_preserves_title_trans_on_refetch(tmp_path: Path) -> None:
    """Regression: when re-persisting an article (e.g. fetch), existing title_trans is preserved."""
    import uuid

    from app.services.articles import ArticleService, ParsedRssItem
    from app.services.feeds import FeedService

    feed_svc = FeedService(tmp_path)
    feed = feed_svc.create_feed(FeedCreate(title="F", url="https://example.com/feed.xml"))
    art_svc = ArticleService(tmp_path)
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
