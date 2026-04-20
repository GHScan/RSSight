"""
JSON persistence helpers.

When persisting JSON that includes ``published_at`` (any nesting depth), skip
writing if the on-disk file already matches except for ``published_at`` values.
This avoids noisy git diffs when RSS sources refresh only publication timestamps.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def _tree_contains_published_at_key(obj: Any) -> bool:
    if isinstance(obj, dict):
        if "published_at" in obj:
            return True
        return any(_tree_contains_published_at_key(v) for v in obj.values())
    if isinstance(obj, list):
        return any(_tree_contains_published_at_key(x) for x in obj)
    return False


def _strip_published_at_keys(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _strip_published_at_keys(v) for k, v in obj.items() if k != "published_at"}
    if isinstance(obj, list):
        return [_strip_published_at_keys(x) for x in obj]
    return obj


def write_json_skip_published_at_only_change(
    path: Path,
    data: Any,
    *,
    indent: int | None = 2,
    ensure_ascii: bool = False,
) -> None:
    """
    Write ``data`` as JSON to ``path``.

    If ``data`` contains any ``published_at`` key and ``path`` already exists with
    valid JSON that is identical after recursively removing every ``published_at``
    key from both trees, the file is left unchanged.
    """
    dump_kwargs: dict[str, Any] = {"ensure_ascii": ensure_ascii}
    if indent is not None:
        dump_kwargs["indent"] = indent

    def _dumps(obj: Any) -> str:
        return json.dumps(obj, **dump_kwargs)

    if not _tree_contains_published_at_key(data):
        path.write_text(_dumps(data), encoding="utf-8")
        return

    if path.exists():
        try:
            existing = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            path.write_text(_dumps(data), encoding="utf-8")
            return
        if _strip_published_at_keys(existing) == _strip_published_at_keys(data):
            return

    path.write_text(_dumps(data), encoding="utf-8")
