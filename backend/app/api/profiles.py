from __future__ import annotations

from http import HTTPStatus
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from app.models.profiles import (
    SummaryProfileCreate,
    SummaryProfileRead,
    SummaryProfileUpdate,
)
from app.services.profiles import (
    ProfileNameExistsError,
    ProfileNotFoundError,
    SummaryProfileService,
)

router = APIRouter(prefix="/api/summary-profiles", tags=["summary-profiles"])


def get_profile_service() -> SummaryProfileService:
    """Dependency that provides SummaryProfileService bound to the current data root."""
    from app import main as app_main

    return SummaryProfileService(app_main.get_data_root())


@router.get("", response_model=List[SummaryProfileRead])
def list_profiles(
    service: SummaryProfileService = Depends(get_profile_service),
) -> List[SummaryProfileRead]:
    return [SummaryProfileRead.model_validate(p.model_dump()) for p in service.list_profiles()]


@router.get("/{profile_name}", response_model=SummaryProfileRead)
def get_profile(
    profile_name: str,
    service: SummaryProfileService = Depends(get_profile_service),
) -> SummaryProfileRead | JSONResponse:
    try:
        profile = service.get_profile(profile_name)
    except ProfileNotFoundError as exc:
        return JSONResponse(
            status_code=HTTPStatus.NOT_FOUND,
            content={
                "code": "PROFILE_NOT_FOUND",
                "message": "Summary profile not found.",
                "details": {"profileName": exc.profile_name},
            },
        )
    return SummaryProfileRead.model_validate(profile.model_dump())


@router.post("", response_model=SummaryProfileRead, status_code=HTTPStatus.CREATED)
def create_profile(
    payload: SummaryProfileCreate,
    service: SummaryProfileService = Depends(get_profile_service),
) -> SummaryProfileRead | JSONResponse:
    try:
        created = service.create_profile(payload)
    except ProfileNameExistsError as exc:
        return JSONResponse(
            status_code=HTTPStatus.CONFLICT,
            content={
                "code": "PROFILE_NAME_EXISTS",
                "message": "A profile with this name already exists.",
                "details": {"profileName": exc.profile_name},
            },
        )
    return SummaryProfileRead.model_validate(created.model_dump())


@router.put("/{profile_name}", response_model=SummaryProfileRead)
def update_profile(
    profile_name: str,
    payload: SummaryProfileUpdate,
    service: SummaryProfileService = Depends(get_profile_service),
) -> SummaryProfileRead | JSONResponse:
    try:
        updated = service.update_profile(profile_name, payload)
    except ProfileNotFoundError as exc:
        return JSONResponse(
            status_code=HTTPStatus.NOT_FOUND,
            content={
                "code": "PROFILE_NOT_FOUND",
                "message": "Summary profile not found.",
                "details": {"profileName": exc.profile_name},
            },
        )
    except ProfileNameExistsError as exc:
        return JSONResponse(
            status_code=HTTPStatus.CONFLICT,
            content={
                "code": "PROFILE_NAME_EXISTS",
                "message": "A profile with this name already exists.",
                "details": {"profileName": exc.profile_name},
            },
        )
    return SummaryProfileRead.model_validate(updated.model_dump())


@router.delete("/{profile_name}", status_code=HTTPStatus.NO_CONTENT)
def delete_profile(
    profile_name: str,
    service: SummaryProfileService = Depends(get_profile_service),
) -> None:
    try:
        service.delete_profile(profile_name)
    except ProfileNotFoundError as exc:
        raise HTTPException(
            status_code=HTTPStatus.NOT_FOUND,
            detail={
                "code": "PROFILE_NOT_FOUND",
                "message": "Summary profile not found.",
                "details": {"profileName": exc.profile_name},
            },
        ) from exc
