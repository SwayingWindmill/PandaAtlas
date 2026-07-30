from __future__ import annotations

import base64
import hashlib
import hmac
import json
from datetime import UTC, datetime, timedelta
from typing import Protocol
from uuid import uuid4

from app.community_intake.models import SignedStorageReference


class StorageReferenceError(ValueError):
    """Raised when an opaque Storage reference is invalid or expired."""


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


def hash_reference_jti(jti: str) -> str:
    return hashlib.sha256(f"community-intake-reference:{jti}".encode()).hexdigest()


def _urlsafe_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def _urlsafe_decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
