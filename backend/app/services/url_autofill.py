"""
URL-based autofill for custom article creation (S029).

Fetches a URL and parses HTML to extract title, description, and optional published time.
Used when the user provides a link but leaves title/description/published_at empty.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from typing import Any
from urllib.request import Request, urlopen


def fetch_and_parse_url(url: str, timeout_seconds: int = 10) -> dict[str, Any]:
    """
    Fetch the given URL and parse HTML for title, description, and published_at.

    Returns a dict with keys: title (str | None), description (str | None),
    published_at (datetime | None). Raises OSError on fetch failure.
    """
    req = Request(url, headers={"User-Agent": "RSSight/1.0 (custom article autofill)"})
    with urlopen(req, timeout=timeout_seconds) as response:
        raw = response.read()
    html = raw.decode("utf-8", errors="replace")
    return _parse_html_metadata(html)


def _parse_html_metadata(html: str) -> dict[str, Any]:
    """Extract title, description, and published_at from HTML using a simple parser."""
    extractor = _MetaExtractor()
    extractor.feed(html)
    return extractor.result


class _MetaExtractor(HTMLParser):
    """Extract <title>, meta name/property content, and optional published time."""

    def __init__(self) -> None:
        super().__init__()
        self.result: dict[str, Any] = {
            "title": None,
            "description": None,
            "published_at": None,
        }
        self._in_title = False
        self._title_chunks: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_d = dict((k, v or "") for k, v in attrs)
        if tag == "title":
            self._in_title = True
            self._title_chunks = []
            return
        if tag != "meta":
            return
        content = (attrs_d.get("content") or "").strip()
        if not content:
            return
        name = (attrs_d.get("name") or "").strip().lower()
        prop = (attrs_d.get("property") or "").strip().lower()
        if name == "description" and not self.result["description"]:
            self.result["description"] = content
        if prop == "og:title" and not self.result["title"]:
            self.result["title"] = content
        if prop == "og:description" and not self.result["description"]:
            self.result["description"] = content
        if prop == "article:published_time":
            self.result["published_at"] = _parse_published_time(content)

    def handle_endtag(self, tag: str) -> None:
        if tag == "title" and self._in_title:
            self._in_title = False
            if not self.result["title"] and self._title_chunks:
                self.result["title"] = " ".join(self._title_chunks).strip()

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self._title_chunks.append(data)

    def error(self, message: str) -> None:
        pass


def _parse_published_time(s: str) -> datetime | None:
    """Parse ISO-like datetime string; return None on failure."""
    s = (s or "").strip()
    if not s:
        return None
    s = re.sub(r"Z\s*$", "+00:00", s, flags=re.IGNORECASE)
    try:
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None
