from __future__ import annotations

from uuid import uuid4

import pytest

from app.community_intake.models import (
    AttachmentScanCommand,
    AttachmentState,
    PrepareAttachmentUploadCommand,
    SourceKind,
    SubmitRevisionCommand,
    SubmittedSourceInput,
)
from app.community_intake.storage import OpaqueStorageReferenceSigner


def test_attachment_contract_enforces_type_size_and_clean_preview() -> None:
    command = PrepareAttachmentUploadCommand(
        idempotency_key="upload-1",
        original_filename="C:\\fakepath\\evidence.webp",
        media_type="IMAGE/WEBP",
        byte_size=1024,
    )
    assert command.original_filename == "evidence.webp"
    assert command.media_type == "image/webp"

    with pytest.raises(ValueError):
        PrepareAttachmentUploadCommand(
            idempotency_key="upload-2",
            original_filename="evidence.exe",
            media_type="application/octet-stream",
            byte_size=1024,
        )
    with pytest.raises(ValueError):
        PrepareAttachmentUploadCommand(
            idempotency_key="upload-3",
            original_filename="large.pdf",
            media_type="application/pdf",
            byte_size=10 * 1024 * 1024 + 1,
        )
    with pytest.raises(ValueError):
        AttachmentScanCommand(
            idempotency_key="scan-1",
            outcome=AttachmentState.QUARANTINED,
            scanner_name="scanner",
            result_code="not-terminal",
        )


def test_formal_revision_requires_structured_content() -> None:
    with pytest.raises(ValueError):
        SubmitRevisionCommand(
            idempotency_key="submit-1",
            expected_version=1,
            content={},
            public_version_seen="release-1",
        )


def test_formal_revision_rejects_duplicate_source_locators() -> None:
    with pytest.raises(ValueError, match="unique locators"):
        SubmitRevisionCommand(
            idempotency_key="submit-duplicate-sources",
            expected_version=1,
            content={"field": "birth_date"},
            public_version_seen="release-1",
            sources=[
                SubmittedSourceInput(
                    source_kind=SourceKind.URL,
                    title="First source",
                    locator="https://example.invalid/record",
                ),
                SubmittedSourceInput(
                    source_kind=SourceKind.URL,
                    title="Duplicate source",
                    locator="  HTTPS://EXAMPLE.INVALID/RECORD  ",
                ),
            ],
        )


def test_signed_reference_contains_no_storage_path() -> None:
    attachment_id = str(uuid4())
    signer = OpaqueStorageReferenceSigner(
        signing_key="community-intake-test-signing-key-1234567890",
        ttl_seconds=120,
    )
    upload = signer.create_upload_reference(
        attachment_id=attachment_id,
        media_type="application/pdf",
        byte_size=1024,
    )
    payload = signer.verify(upload.reference, expected_action="upload")

    assert payload["attachment_id"] == attachment_id
    assert "bucket" not in payload
    assert "object_key" not in payload
    assert "subjects/" not in upload.reference
