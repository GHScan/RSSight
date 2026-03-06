from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, HttpUrl


class SummaryProfile(BaseModel):
    """
    Domain model for an AI summary profile as stored in the config index.

    Each profile has a unique name and defines how to call an OpenAI-compatible
    API for generating article summaries.
    """

    name: str
    base_url: HttpUrl
    key: str
    model: str
    fields: List[str]
    prompt_template: str
    # e.g. "low" | "medium" | "high" for APIs that support reasoning.effort
    reasoning_effort: Optional[str] = None
    last_used_at: Optional[datetime] = None  # 最后使用时间，用于按使用顺序排序


class SummaryProfileCreate(BaseModel):
    """Payload for creating a new summary profile."""

    name: str
    base_url: HttpUrl
    key: str
    model: str
    fields: List[str]
    prompt_template: str
    reasoning_effort: Optional[str] = None


class SummaryProfileUpdate(BaseModel):
    """
    Payload for updating an existing summary profile.

    Fields are optional to allow partial updates.
    Optional name allows renaming; when changed, summaries for the old name are cleaned up.
    """

    name: Optional[str] = None
    base_url: Optional[HttpUrl] = None
    key: Optional[str] = None
    model: Optional[str] = None
    fields: Optional[List[str]] = None
    prompt_template: Optional[str] = None
    reasoning_effort: Optional[str] = None


class SummaryProfileRead(SummaryProfile):
    """Response model used by the API."""

    pass
