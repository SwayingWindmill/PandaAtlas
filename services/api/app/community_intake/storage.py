from __future__ import annotations

import base64
import hashlib
import hmac
import json
from datetime import UTC, datetime, timedelta
from typing import Protocol
from uuid import uuid4

import httpx

from app.community_intake.models import SignedStorageReference


class StorageReferenceError(ValueError):
    """Raised when an opaque Storage reference is invalid or expired."""


class StorageWriteError(RuntimeError):
    """Raised when private Storage cannot persist an attachment body."""


class PrivateAttachmentStorage(Protocol):
    def create_upload_reference(
        self,
        *,
        attachment_id: str,
        media_type: str,
        byte_size: int,
    ) -> SignedStorageReference: ...

    def verify_upload_reference(
        self,
        reference: str,
        *,
        attachment_id: str,
        media_type: str,
        byte_size: int,
    ) -> None: ...

    def create_download_reference(
        self,
        *,
        attachment_id: str,
        preview: bool,
    ) -> tuple[SignedStorageReference, str]: ...

    def upload_content(
        self,
        *,
        bucket: str,
        object_key: str,
        content: bytes,
        media_type: str,
    ) -> str: ...


class OpaqueStorageReferenceSigner:
    """Produces short-lived opaque references without exposing object paths."""

    def __init__(self, *, signing_key: str, ttl_seconds: int = 300) -> None:
        if len(signing_key) < 32:
            raise ValueError("storage reference signing key must be at least 32 characters")
        if ttl_seconds < 30 or ttl_seconds > 900:
            raise ValueError("storage reference TTL must be between 30 and 900 seconds")
        self._key = signing_key.encode()
        self._ttl_seconds = ttl_seconds

    def create_upload_reference(
        self,
        *,
        attachment_id: str,
        media_type: str,
        byte_size: int,
    ) -> SignedStorageReference:
        return self._sign(
            {
                "action": "upload",
                "attachment_id": attachment_id,
                "media_type": media_type,
                "byte_size": byte_size,
            }
        )[0]

    def verify_upload_reference(
        self,
        reference: str,
        *,
        attachment_id: str,
        media_type: str,
        byte_size: int,
    ) -> None:
        payload = self.verify(reference, expected_action="upload")
        if (
            payload.get("attachment_id") != attachment_id
            or payload.get("media_type") != media_type
            or int(payload.get("byte_size", -1)) != byte_size
        ):
            raise StorageReferenceError(
                "Storage reference does not match the attachment reservation"
            )

    def upload_content(
        self,
        *,
        bucket: str,
        object_key: str,
        content: bytes,
        media_type: str,
    ) -> str:
        raise StorageWriteError("private evidence Storage writer is not configured")

    def create_download_reference(
        self,
        *,
        attachment_id: str,
        preview: bool,
    ) -> tuple[SignedStorageReference, str]:
        reference, jti = self._sign(
            {
                "action": "download",
                "attachment_id": attachment_id,
                "preview": preview,
            }
        )
        return reference, jti

    def verify(self, reference: str, *, expected_action: str) -> dict[str, object]:
        try:
            encoded_payload, encoded_signature = reference.split(".", 1)
            payload_bytes = _urlsafe_decode(encoded_payload)
            signature = _urlsafe_decode(encoded_signature)
            expected = hmac.new(self._key, payload_bytes, hashlib.sha256).digest()
            if not hmac.compare_digest(signature, expected):
                raise StorageReferenceError("invalid Storage reference signature")
            payload = json.loads(payload_bytes)
        except (ValueError, json.JSONDecodeError) as error:
            if isinstance(error, StorageReferenceError):
                raise
            raise StorageReferenceError("invalid Storage reference") from error
        if payload.get("action") != expected_action:
            raise StorageReferenceError("Storage reference action does not match")
        expires_at = datetime.fromtimestamp(int(payload["exp"]), tz=UTC)
        if expires_at <= datetime.now(UTC):
            raise StorageReferenceError("Storage reference has expired")
        return payload

    def _sign(self, payload: dict[str, object]) -> tuple[SignedStorageReference, str]:
        now = datetime.now(UTC)
        expires_at = now + timedelta(seconds=self._ttl_seconds)
        jti = uuid4().hex
        material = {
            **payload,
            "iat": int(now.timestamp()),
            "exp": int(expires_at.timestamp()),
            "jti": jti,
        }
        payload_bytes = json.dumps(
            material,
            sort_keys=True,
            separators=(",", ":"),
        ).encode()
        signature = hmac.new(self._key, payload_bytes, hashlib.sha256).digest()
        token = f"{_urlsafe_encode(payload_bytes)}.{_urlsafe_encode(signature)}"
        return SignedStorageReference(reference=token, expires_at=expires_at), jti


class SupabasePrivateAttachmentStorage(OpaqueStorageReferenceSigner):
    """Writes private evidence through the backend without returning object paths."""

    def __init__(
        self,
        *,
        signing_key: str,
        ttl_seconds: int,
        supabase_url: str,
        service_role_key: str,
    ) -> None:
        super().__init__(signing_key=signing_key, ttl_seconds=ttl_seconds)
        self._supabase_url = supabase_url.rstrip("/")
        self._service_role_key = service_role_key

    def upload_content(
        self,
        *,
        bucket: str,
        object_key: str,
        content: bytes,
        media_type: str,
    ) -> str:
        try:
            response = httpx.post(
                f"{self._supabase_url}/storage/v1/object/{bucket}/{object_key}",
                headers={
                    "Authorization": f"Bearer {self._service_role_key}",
                    "apikey": self._service_role_key,
                    "Content-Type": media_type,
                    "x-upsert": "false",
                },
                content=content,
                timeout=30.0,
            )
        except httpx.HTTPError as error:
            raise StorageWriteError("private evidence Storage is unavailable") from error
        if response.status_code not in {200, 201}:
            raise StorageWriteError("private evidence Storage rejected the upload")
        return response.headers.get("etag", "").strip('"') or hashlib.sha256(content).hexdigest()


def hash_reference_jti(jti: str) -> str:
    return hashlib.sha256(f"community-intake-reference:{jti}".encode()).hexdigest()


def _urlsafe_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def _urlsafe_decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
