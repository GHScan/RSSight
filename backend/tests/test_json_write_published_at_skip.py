"""Tests for skipping JSON disk writes when only ``published_at`` values change."""

from __future__ import annotations

import json
from pathlib import Path

from app.services.json_write_policy import write_json_skip_published_at_only_change


def test_skip_write_when_only_root_published_at_changes(tmp_path: Path) -> None:
    path = tmp_path / "doc.json"
    first = {"title": "Same", "published_at": "2020-01-01T00:00:00+00:00"}
    write_json_skip_published_at_only_change(path, first)
    mtime_after_first = path.stat().st_mtime_ns
    second = {"title": "Same", "published_at": "2025-06-01T12:00:00+00:00"}
    write_json_skip_published_at_only_change(path, second)
    assert path.stat().st_mtime_ns == mtime_after_first
    data = json.loads(path.read_text(encoding="utf-8"))
    assert data["published_at"] == "2020-01-01T00:00:00+00:00"


def test_writes_when_non_published_field_changes(tmp_path: Path) -> None:
    path = tmp_path / "doc.json"
    write_json_skip_published_at_only_change(
        path,
        {"title": "A", "published_at": "2020-01-01T00:00:00+00:00"},
    )
    write_json_skip_published_at_only_change(
        path,
        {"title": "B", "published_at": "2020-01-01T00:00:00+00:00"},
    )
    data = json.loads(path.read_text(encoding="utf-8"))
    assert data["title"] == "B"


def test_writes_new_file_even_if_only_published_at_in_payload(tmp_path: Path) -> None:
    path = tmp_path / "new.json"
    write_json_skip_published_at_only_change(
        path,
        {"published_at": "2021-01-01T00:00:00+00:00"},
    )
    assert path.exists()
    assert json.loads(path.read_text(encoding="utf-8"))["published_at"] == "2021-01-01T00:00:00+00:00"


def test_no_skip_when_payload_has_no_published_at_key(tmp_path: Path) -> None:
    path = tmp_path / "meta.json"
    write_json_skip_published_at_only_change(path, {"version": 1})
    mtime1 = path.stat().st_mtime_ns
    write_json_skip_published_at_only_change(path, {"version": 2})
    assert path.stat().st_mtime_ns != mtime1
    assert json.loads(path.read_text(encoding="utf-8"))["version"] == 2


def test_skip_when_only_nested_published_at_changes(tmp_path: Path) -> None:
    path = tmp_path / "nested.json"
    payload = {
        "items": [
            {"id": "1", "published_at": "2020-01-01T00:00:00+00:00", "title": "t"},
        ]
    }
    write_json_skip_published_at_only_change(path, payload)
    mtime1 = path.stat().st_mtime_ns
    payload2 = {
        "items": [
            {"id": "1", "published_at": "2030-01-01T00:00:00+00:00", "title": "t"},
        ]
    }
    write_json_skip_published_at_only_change(path, payload2)
    assert path.stat().st_mtime_ns == mtime1
    saved = json.loads(path.read_text(encoding="utf-8"))
    assert saved["items"][0]["published_at"] == "2020-01-01T00:00:00+00:00"


def test_overwrites_when_existing_json_is_invalid(tmp_path: Path) -> None:
    path = tmp_path / "broken.json"
    path.write_text("{not json", encoding="utf-8")
    write_json_skip_published_at_only_change(
        path,
        {"title": "ok", "published_at": "2020-01-01T00:00:00+00:00"},
    )
    data = json.loads(path.read_text(encoding="utf-8"))
    assert data["title"] == "ok"


def test_indent_none_writes_compact_json(tmp_path: Path) -> None:
    path = tmp_path / "out.json"
    write_json_skip_published_at_only_change(
        path, {"a": 1, "published_at": "x"}, indent=None, ensure_ascii=False
    )
    assert json.loads(path.read_text(encoding="utf-8")) == {"a": 1, "published_at": "x"}
