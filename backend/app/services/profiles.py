from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List

from app.models.profiles import (
    SummaryProfile,
    SummaryProfileCreate,
    SummaryProfileUpdate,
)


@dataclass(frozen=True)
class ProfileNotFoundError(Exception):
    profile_name: str


@dataclass(frozen=True)
class ProfileNameExistsError(Exception):
    profile_name: str


class SummaryProfileService:
    """
    Service responsible for managing summary profiles and their file storage.

    Maintains the config file at data/summary_profiles.json. Profile names
    are unique and used as the storage key.
    """

    def __init__(self, data_root: Path) -> None:
        self._data_root = data_root
        self._profiles_index_path = self._data_root / "summary_profiles.json"

    def list_profiles(self) -> List[SummaryProfile]:
        """Return profiles sorted by last_used_at descending (most recently used first)."""
        profiles = list(self._load_profiles().values())
        return sorted(
            profiles,
            key=lambda p: p.last_used_at or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )

    def touch_profile(self, name: str) -> None:
        """Update last_used_at for the given profile (e.g. after generating a summary)."""
        profiles = self._load_profiles()
        if name not in profiles:
            return
        existing = profiles[name]
        updated = existing.model_copy(update={"last_used_at": datetime.now(timezone.utc)})
        profiles[name] = updated
        self._save_profiles(profiles)

    def get_profile(self, name: str) -> SummaryProfile:
        profiles = self._load_profiles()
        if name not in profiles:
            raise ProfileNotFoundError(name)
        return profiles[name]

    def create_profile(self, payload: SummaryProfileCreate) -> SummaryProfile:
        profiles = self._load_profiles()
        if payload.name in profiles:
            raise ProfileNameExistsError(payload.name)

        profile = SummaryProfile(
            name=payload.name,
            base_url=payload.base_url,
            key=payload.key,
            model=payload.model,
            fields=payload.fields,
            prompt_template=payload.prompt_template,
            reasoning_effort=payload.reasoning_effort,
        )
        profiles[payload.name] = profile
        self._save_profiles(profiles)
        return profile

    def update_profile(self, name: str, payload: SummaryProfileUpdate) -> SummaryProfile:
        profiles = self._load_profiles()
        if name not in profiles:
            raise ProfileNotFoundError(name)

        existing = profiles[name]
        new_name = payload.name if payload.name is not None else existing.name
        if new_name in profiles and new_name != name:
            raise ProfileNameExistsError(new_name)

        base_url = payload.base_url if payload.base_url is not None else existing.base_url
        key = payload.key if payload.key is not None else existing.key
        model = payload.model if payload.model is not None else existing.model
        fields = payload.fields if payload.fields is not None else existing.fields
        prompt_template = (
            payload.prompt_template
            if payload.prompt_template is not None
            else existing.prompt_template
        )
        reasoning_effort = (
            payload.reasoning_effort if "reasoning_effort" in payload.model_fields_set else existing.reasoning_effort
        )
        if reasoning_effort == "":
            reasoning_effort = None
        updated = existing.model_copy(
            update={
                "name": new_name,
                "base_url": base_url,
                "key": key,
                "model": model,
                "fields": fields,
                "prompt_template": prompt_template,
                "reasoning_effort": reasoning_effort,
            }
        )
        if new_name != name:
            profiles.pop(name)
            profiles[new_name] = updated
            self._save_profiles(profiles)
            self._cleanup_summaries_for_profile(name)
            return updated
        profiles[name] = updated
        self._save_profiles(profiles)
        return updated

    def delete_profile(self, name: str) -> None:
        profiles = self._load_profiles()
        if name not in profiles:
            raise ProfileNotFoundError(name)
        profiles.pop(name)
        self._save_profiles(profiles)
        self._cleanup_summaries_for_profile(name)

    def _cleanup_summaries_for_profile(self, profile_name: str) -> None:
        """
        Remove all summary .md and .meta.json files for the given profile name
        under data/feeds/{feedId}/articles/{articleId}/summaries/.
        Tolerates missing files; failures for one path do not affect others.
        """
        feeds_dir = self._data_root / "feeds"
        if not feeds_dir.exists():
            return
        for feed_path in feeds_dir.iterdir():
            if not feed_path.is_dir():
                continue
            articles_dir = feed_path / "articles"
            if not articles_dir.exists():
                continue
            for article_path in articles_dir.iterdir():
                if not article_path.is_dir():
                    continue
                summaries_dir = article_path / "summaries"
                if not summaries_dir.exists():
                    continue
                for suffix in (".md", ".meta.json"):
                    path = summaries_dir / f"{profile_name}{suffix}"
                    if path.exists():
                        try:
                            path.unlink()
                        except OSError:
                            pass

    def _load_profiles(self) -> Dict[str, SummaryProfile]:
        if not self._profiles_index_path.exists():
            return {}
        raw = json.loads(self._profiles_index_path.read_text(encoding="utf-8"))
        return {name: SummaryProfile.model_validate(data) for name, data in raw.items()}

    def _save_profiles(self, profiles: Dict[str, SummaryProfile]) -> None:
        self._data_root.mkdir(parents=True, exist_ok=True)
        serialisable = {name: profile.model_dump(mode="json") for name, profile in profiles.items()}
        self._profiles_index_path.write_text(
            json.dumps(serialisable, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
