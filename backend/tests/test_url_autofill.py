"""
S034: Backend tests for URL-branch autofill (custom article creation).

Covers fetch_and_parse_url success, failure, and incomplete-field scenarios
via mocked HTTP.
"""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.services.url_autofill import fetch_and_parse_url


def test_fetch_and_parse_url_success_returns_title_description_published(
    monkeypatch,
) -> None:
    """S034: URL autofill success - HTML with title, description, published_at parsed."""
    html = """<!DOCTYPE html>
<html>
<head>
  <title>Page Title Here</title>
  <meta name="description" content="Page description from meta." />
  <meta property="article:published_time" content="2025-03-05T14:00:00Z" />
</head>
<body></body>
</html>"""
    mock_response = MagicMock()
    mock_response.read.return_value = html.encode("utf-8")
    mock_response.__enter__ = MagicMock(return_value=mock_response)
    mock_response.__exit__ = MagicMock(return_value=False)

    with patch("app.services.url_autofill.urlopen", return_value=mock_response):
        result = fetch_and_parse_url("https://example.com/page")

    assert result["title"] == "Page Title Here"
    assert result["description"] == "Page description from meta."
    assert result["published_at"] == datetime(2025, 3, 5, 14, 0, 0, tzinfo=timezone.utc)


def test_fetch_and_parse_url_og_meta_fallback(monkeypatch) -> None:
    """S034: Parser uses og:title and og:description when present."""
    html = """<!DOCTYPE html>
<html><head>
  <meta property="og:title" content="OG Title" />
  <meta property="og:description" content="OG description text." />
</head><body></body></html>"""
    mock_response = MagicMock()
    mock_response.read.return_value = html.encode("utf-8")
    mock_response.__enter__ = MagicMock(return_value=mock_response)
    mock_response.__exit__ = MagicMock(return_value=False)

    with patch("app.services.url_autofill.urlopen", return_value=mock_response):
        result = fetch_and_parse_url("https://example.com/og")

    assert result["title"] == "OG Title"
    assert result["description"] == "OG description text."
    assert result["published_at"] is None


def test_fetch_and_parse_url_failure_raises_os_error(monkeypatch) -> None:
    """S034: URL autofill failure - fetch raises OSError."""
    with patch("app.services.url_autofill.urlopen", side_effect=OSError("Connection refused")):
        with pytest.raises(OSError, match="Connection refused"):
            fetch_and_parse_url("https://example.com/unreachable")


def test_fetch_and_parse_url_incomplete_returns_none_for_missing(monkeypatch) -> None:
    """S034: Incomplete HTML - missing title/description returns None for those keys."""
    html = """<!DOCTYPE html><html><head></head><body></body></html>"""
    mock_response = MagicMock()
    mock_response.read.return_value = html.encode("utf-8")
    mock_response.__enter__ = MagicMock(return_value=mock_response)
    mock_response.__exit__ = MagicMock(return_value=False)

    with patch("app.services.url_autofill.urlopen", return_value=mock_response):
        result = fetch_and_parse_url("https://example.com/empty")

    assert result["title"] is None
    assert result["description"] is None
    assert result["published_at"] is None
