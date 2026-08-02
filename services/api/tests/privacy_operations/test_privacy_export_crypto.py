import base64
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.privacy_operations.exports import (
    PrivacyExportCipher,
    PrivacyExportDecryptionError,
    PrivacyExportDownloadSigner,
    PrivacyExportReferenceError,
)


def test_privacy_export_cipher_round_trips_and_binds_identity() -> None:
    cipher = PrivacyExportCipher("test-privacy-export-master-key-at-least-32-characters")
    artifact_id = uuid4()
    request_id = uuid4()
    account_id = uuid4()
    plaintext = b'{"email":"private@example.test","follows":["panda-1"]}'

    encrypted = cipher.encrypt(
        artifact_id=artifact_id,
        request_id=request_id,
        account_id=account_id,
        plaintext=plaintext,
    )

    assert plaintext not in encrypted.ciphertext
    assert len(encrypted.nonce) == 12
    assert encrypted.plaintext_byte_size == len(plaintext)
    assert cipher.decrypt(
        artifact_id=artifact_id,
        request_id=request_id,
        account_id=account_id,
        nonce=encrypted.nonce,
        ciphertext=encrypted.ciphertext,
        schema_version=1,
        key_version=1,
    ) == plaintext

    with pytest.raises(PrivacyExportDecryptionError):
        cipher.decrypt(
            artifact_id=artifact_id,
            request_id=request_id,
            account_id=uuid4(),
            nonce=encrypted.nonce,
            ciphertext=encrypted.ciphertext,
            schema_version=1,
            key_version=1,
        )


def test_privacy_export_reference_is_short_lived_and_artifact_bounded() -> None:
    signer = PrivacyExportDownloadSigner(
        signing_key="test-privacy-export-signing-key-at-least-32-characters",
        ttl_seconds=300,
    )
    issued_at = datetime(2026, 8, 2, 10, 0, tzinfo=UTC)
    artifact_expires_at = issued_at + timedelta(seconds=90)
    artifact_id = uuid4()
    request_id = uuid4()
    account_id = uuid4()

    reference, expires_at, _ = signer.issue(
        artifact_id=artifact_id,
        request_id=request_id,
        account_id=account_id,
        artifact_expires_at=artifact_expires_at,
        now=issued_at,
    )

    assert expires_at == artifact_expires_at
    verified = signer.verify(reference, now=issued_at + timedelta(seconds=30))
    assert verified.artifact_id == artifact_id
    assert verified.request_id == request_id
    assert verified.account_subject_hash == signer.subject_hash(account_id)
    encoded_payload = reference.split(".", 1)[0]
    decoded_payload = base64.urlsafe_b64decode(
        encoded_payload + "=" * (-len(encoded_payload) % 4)
    ).decode()
    assert str(account_id) not in decoded_payload

    with pytest.raises(PrivacyExportReferenceError):
        signer.verify(reference, now=artifact_expires_at)

    tampered = reference[:-1] + ("A" if reference[-1] != "A" else "B")
    with pytest.raises(PrivacyExportReferenceError):
        signer.verify(tampered, now=issued_at + timedelta(seconds=30))


def test_privacy_export_keys_are_required_only_when_feature_is_enabled() -> None:
    shared_key = "shared-disabled-privacy-export-key-at-least-32-characters"

    disabled = Settings(
        _env_file=None,
        PRIVACY_OPERATIONS_ENABLED=False,
        PRIVACY_EXPORT_MASTER_KEY=shared_key,
        PRIVACY_EXPORT_DOWNLOAD_SIGNING_KEY=shared_key,
    )
    assert disabled.privacy_operations_enabled is False

    with pytest.raises(ValidationError, match="encryption and signing keys must differ"):
        Settings(
            _env_file=None,
            PRIVACY_OPERATIONS_ENABLED=True,
            PRIVACY_EXPORT_MASTER_KEY=shared_key,
            PRIVACY_EXPORT_DOWNLOAD_SIGNING_KEY=shared_key,
        )


def test_privacy_export_download_ttl_cannot_exceed_artifact_lifetime() -> None:
    with pytest.raises(ValidationError, match="download TTL cannot exceed artifact TTL"):
        Settings(
            _env_file=None,
            PRIVACY_EXPORT_ARTIFACT_TTL_SECONDS=300,
            PRIVACY_EXPORT_DOWNLOAD_TTL_SECONDS=301,
        )
