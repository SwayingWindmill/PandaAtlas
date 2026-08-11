from __future__ import annotations

import hashlib
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.admin_media.models import (
    AdminMediaUploadListRead,
    AdminMediaUploadRead,
    AdminMediaUploadReservation,
    AdminMediaUploadReservationRead,
)
from app.community_intake.storage import (
    PrivateAttachmentStorage,
    StorageReferenceError,
    StorageWriteError,
)
from app.identity.models import RequestIdentity


class AdminMediaUploadRepository:
    bucket = "admin-media-private"

    def __init__(self, session: Session, storage: PrivateAttachmentStorage) -> None:
        self.session = session
        self.storage = storage

    @staticmethod
    def _read(row: dict[str, Any]) -> AdminMediaUploadRead:
        return AdminMediaUploadRead(
            upload_id=UUID(str(row["upload_id"])),
            panda_id=UUID(str(row["panda_id"])),
            original_filename=str(row["original_filename"]),
            media_type=str(row["media_type"]),
            byte_size=int(row["byte_size"]),
            state=str(row["state"]),
            content_sha256=str(row["content_sha256"]) if row["content_sha256"] else None,
            uploaded_at=row["uploaded_at"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def reserve(
        self,
        command: AdminMediaUploadReservation,
        identity: RequestIdentity,
    ) -> AdminMediaUploadReservationRead:
        upload_id = uuid4()
        object_key = f"pandas/{command.panda_id}/{upload_id}/original"
        reference = self.storage.create_upload_reference(
            attachment_id=str(upload_id),
            media_type=command.content_type,
            byte_size=command.byte_size,
        )
        self.session.execute(
            text(
                """
                insert into admin_media.uploads (
                  upload_id, panda_id, original_filename, media_type, byte_size,
                  storage_bucket, storage_object_key, uploaded_by
                ) values (
                  :upload_id, :panda_id, :filename, :media_type, :byte_size,
                  :bucket, :object_key, :actor_id
                )
                """
            ),
            {
                "upload_id": upload_id,
                "panda_id": command.panda_id,
                "filename": command.filename.strip(),
                "media_type": command.content_type,
                "byte_size": command.byte_size,
                "bucket": self.bucket,
                "object_key": object_key,
                "actor_id": identity.account_id,
            },
        )
        self._audit("admin.media_upload.reserved", upload_id, identity)
        self.session.commit()
        return AdminMediaUploadReservationRead(
            upload_id=upload_id,
            upload_reference=reference.reference,
            expires_at=reference.expires_at,
            upload_path=f"/api/admin/media/uploads/{upload_id}",
        )

    def upload(
        self,
        upload_id: UUID,
        *,
        upload_reference: str,
        content: bytes,
        content_type: str,
        identity: RequestIdentity,
    ) -> AdminMediaUploadRead:
        row = self.session.execute(
            text(
                """
                select upload_id, panda_id, original_filename, media_type, byte_size,
                       state, storage_bucket, storage_object_key, content_sha256,
                       uploaded_at, created_at, updated_at
                from admin_media.uploads
                where upload_id = :upload_id
                for update
                """
            ),
            {"upload_id": upload_id},
        ).mappings().one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail={"code": "MEDIA_UPLOAD_NOT_FOUND"})
        if str(row["state"]) != "reserved":
            raise HTTPException(status_code=409, detail={"code": "MEDIA_UPLOAD_NOT_RESERVED"})
        if str(row["media_type"]) != content_type:
            raise HTTPException(
                status_code=422,
                detail={"code": "MEDIA_UPLOAD_CONTENT_TYPE_MISMATCH"},
            )
        expected_size = int(row["byte_size"])
        if len(content) != expected_size:
            raise HTTPException(status_code=422, detail={"code": "MEDIA_UPLOAD_SIZE_MISMATCH"})
        try:
            self.storage.verify_upload_reference(
                upload_reference,
                attachment_id=str(upload_id),
                media_type=content_type,
                byte_size=expected_size,
            )
            etag = self.storage.upload_content(
                bucket=str(row["storage_bucket"]),
                object_key=str(row["storage_object_key"]),
                content=content,
                media_type=content_type,
            )
        except StorageReferenceError as error:
            raise HTTPException(
                status_code=403,
                detail={"code": "MEDIA_UPLOAD_REFERENCE_INVALID"},
            ) from error
        except StorageWriteError as error:
            raise HTTPException(
                status_code=503,
                detail={"code": "MEDIA_STORAGE_UNAVAILABLE"},
            ) from error

        digest = hashlib.sha256(content).hexdigest()
        updated = self.session.execute(
            text(
                """
                update admin_media.uploads
                set state = 'uploaded', storage_etag = :etag,
                    content_sha256 = :sha256, uploaded_at = now(), updated_at = now()
                where upload_id = :upload_id
                returning upload_id, panda_id, original_filename, media_type, byte_size,
                          state, content_sha256, uploaded_at, created_at, updated_at
                """
            ),
            {"upload_id": upload_id, "etag": etag, "sha256": digest},
        ).mappings().one()
        self._audit("admin.media_upload.uploaded", upload_id, identity)
        self.session.commit()
        return self._read(dict(updated))

    def list_for_panda(self, panda_id: UUID) -> AdminMediaUploadListRead:
        rows = self.session.execute(
            text(
                """
                select upload_id, panda_id, original_filename, media_type, byte_size,
                       state, content_sha256, uploaded_at, created_at, updated_at
                from admin_media.uploads
                where panda_id = :panda_id
                order by created_at desc
                limit 100
                """
            ),
            {"panda_id": panda_id},
        ).mappings()
        return AdminMediaUploadListRead(items=[self._read(dict(row)) for row in rows])

    def _audit(self, event_type: str, upload_id: UUID, identity: RequestIdentity) -> None:
        self.session.execute(
            text(
                """
                insert into public.audit_events (
                  event_type, subject_type, subject_id, actor_id, reason, metadata
                ) values (
                  :event_type, 'admin_media_upload', :upload_id, :actor_id,
                  :reason, '{}'::jsonb
                )
                """
            ),
            {
                "event_type": event_type,
                "upload_id": str(upload_id),
                "actor_id": identity.account_id,
                "reason": event_type.replace("admin.media_upload.", "Admin media upload "),
            },
        )
