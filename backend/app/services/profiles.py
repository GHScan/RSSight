from __future__ import annotations

import json
from dataclasses import dataclass
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
        return list(self._load_profiles().values())

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
        )
        profiles[payload.name] = profile
        self._save_profiles(profiles)
        return profile

    def update_profile(self, name: str, payload: SummaryProfileUpdate) -> SummaryProfile:
        profiles = self._load_profiles()
        if name not in profiles:
            raise ProfileNotFoundError(name)

        existing = profiles[name]
        base_url = payload.base_url if payload.base_url is not None else existing.base_url
        key = payload.key if payload.key is not None else existing.key
        model = payload.model if payload.model is not None else existing.model
        fields = payload.fields if payload.fields is not None else existing.fields
        prompt_template = (
            payload.prompt_template
            if payload.prompt_template is not None
            else existing.prompt_template
        )
        updated = existing.model_copy(
            update={
                "base_url": base_url,
                "key": key,
                "model": model,
                "fields": fields,
                "prompt_template": prompt_template,
            }
        )
        profiles[name] = updated
        self._save_profiles(profiles)
        return updated

    def delete_profile(self, name: str) -> None:
        profiles = self._load_profiles()
        if name not in profiles:
            raise ProfileNotFoundError(name)
        profiles.pop(name)
        self._save_profiles(profiles)

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
