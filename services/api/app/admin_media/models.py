from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

AdminMediaUploadState = Literal["reserved", "uploaded", "processing", "ready", "rejected"]
AdminImageMediaType = Literal["image/jpeg", "image/png", "image/webp"]


class AdminMediaUploadReservation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    panda_id: UUID
    filename: str = Field(min_length=1, max_length=255)
    content_type: AdminImageMediaType
    byte_size: int = Field(ge=1, le=20 * 1024 * 1024)


class AdminMediaUploadReservationRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    upload_id: UUID
    upload_reference: str
    expires_at: datetime
    upload_path: str
    state: Literal["reserved"] = "reserved"


class AdminMediaUploadRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    upload_id: UUID
    panda_id: UUID
    original_filename: str
    media_type: AdminImageMediaType
    byte_size: int
    state: AdminMediaUploadState
    content_sha256: str | None
    uploaded_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AdminMediaUploadListRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[AdminMediaUploadRead]
