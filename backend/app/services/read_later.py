"""
Read-later collection service (S060).

Stores reference-only records in data/read_later.json. No duplicated article or summary content.
Ordering: newest-added first. Add inserts a record; remove deletes it.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, List

from app.models.read_later import ReadLaterEntry


class ReadLaterService:
    """
    Service for read-later collection stored at data/read_later.json.

    Records are reference-only: feed_id, article_id, added_at. Newest-added first.
    """

    def __init__(self, data_root: Path) -> None:
        self._data_root = data_root
        self._path = self._data_root / "read_later.json"

    def list_entries(self) -> List[ReadLaterEntry]:
        """Return all read-later entries, newest-added first."""
        items = self._load()
        return [ReadLaterEntry.model_validate(x) for x in items]

    def add(self, feed_id: str, article_id: str) -> None:
        """Add an article to read-later (or move to top if already present)."""
        items = self._load()
        # Remove existing if present so we can re-insert at front
        items = [
            x for x in items if not (x["feed_id"] == feed_id and x["article_id"] == article_id)
        ]
        now = datetime.now(timezone.utc).isoformat()
        items.insert(0, {"feed_id": feed_id, "article_id": article_id, "added_at": now})
        self._save(items)

    def remove(self, feed_id: str, article_id: str) -> None:
        """Remove an article from read-later. Idempotent if not present."""
        items = self._load()
        items = [
            x for x in items if not (x["feed_id"] == feed_id and x["article_id"] == article_id)
        ]
        self._save(items)

    def contains(self, feed_id: str, article_id: str) -> bool:
        """Return True if the article is in read-later."""
        items = self._load()
        return any(x["feed_id"] == feed_id and x["article_id"] == article_id for x in items)

    def relocate_article_reference(
        self, from_feed_id: str, article_id: str, to_feed_id: str
    ) -> None:
        """Update read-later entries when an article is moved between feeds (same article_id)."""
        items = self._load()
        changed = False
        new_items: list[dict[str, Any]] = []
        for x in items:
            row = dict(x)
            if row["feed_id"] == from_feed_id and row["article_id"] == article_id:
                row["feed_id"] = to_feed_id
                changed = True
            new_items.append(row)
        if changed:
            self._save(new_items)

    def _load(self) -> list[dict[str, Any]]:
        if not self._path.exists():
            return []
        raw: dict[str, Any] = json.loads(self._path.read_text(encoding="utf-8"))
        return list(raw.get("items", []))

    def _save(self, items: list[dict[str, Any]]) -> None:
        self._data_root.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            json.dumps({"items": items}, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
