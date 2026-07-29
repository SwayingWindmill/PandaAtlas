from __future__ import annotations

from collections.abc import Iterable
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.activity.models import ActivityConflictError, ActivityContent


def validate_public_activity_dependencies(
    session: Session,
    contents: Iterable[ActivityContent],
) -> None:
    public_reference_ids = sorted(
        {
            reference_id
            for content in contents
            for reference_id in content.provenance.public_reference_ids
        }
    )
    if public_reference_ids:
        resolved_reference_ids = {
            str(value)
            for value in session.execute(
                text(
                    """
                    select id
                    from public.public_evidence_sources
                    where id = any(:reference_ids)
                    """
                ),
                {"reference_ids": public_reference_ids},
            ).scalars()
        }
        missing_reference_ids = sorted(set(public_reference_ids) - resolved_reference_ids)
        if missing_reference_ids:
            raise ActivityConflictError(
                "Activity references unpublished evidence sources: "
                + ", ".join(missing_reference_ids)
            )

    media_asset_ids = sorted(
        {
            content.media.asset_id
            for content in contents
            if content.media is not None
        },
        key=str,
    )
    if media_asset_ids:
        approved_asset_ids = {
            UUID(str(value))
            for value in session.execute(
                text(
                    """
                    select id
                    from public.media_assets
                    where id = any(:asset_ids)
                      and storage_bucket = 'public-media'
                      and storage_path ~* '^https?://'
                      and license is not null
                      and length(trim(license)) > 0
                    """
                ),
                {"asset_ids": media_asset_ids},
            ).scalars()
        }
        missing_asset_ids = sorted(set(media_asset_ids) - approved_asset_ids, key=str)
        if missing_asset_ids:
            raise ActivityConflictError(
                "Activity references media without public rights approval: "
                + ", ".join(str(asset_id) for asset_id in missing_asset_ids)
            )
