from __future__ import annotations

import argparse
from uuid import UUID

from sqlalchemy import text

from app.activity.repository import ActivityRepository
from app.core.config import Settings
from app.db.session import configure_database, session_scope

_SOURCE_EVENT_TYPES = (
    "archive.activity.published",
    "archive.activity.snapshot_updated",
    "archive.activity.corrected",
    "archive.activity.retracted",
    "editorial.activity.published",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Project public-safe Activity source events")
    parser.add_argument("--event-id", type=UUID)
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--rebuild", action="store_true")
    parser.add_argument("--mark-as-backfill", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.limit < 1 or args.limit > 1000:
        raise SystemExit("--limit must be between 1 and 1000")
    if args.event_id is not None and args.rebuild:
        raise SystemExit("--event-id and --rebuild are mutually exclusive")

    settings = Settings()
    if not settings.activity_enabled:
        raise SystemExit("ACTIVITY_ENABLED must be true")
    if not settings.database_url:
        raise SystemExit("DATABASE_URL is required")

    configure_database(settings.database_url)
    with session_scope() as session:
        if session is None:
            raise SystemExit("Database session is unavailable")
        repository = ActivityRepository(session)
        if args.rebuild:
            result = repository.rebuild(mark_as_backfill=args.mark_as_backfill)
            print(result.model_dump_json())
            return 0

        event_ids: list[UUID]
        if args.event_id is not None:
            event_ids = [args.event_id]
        else:
            event_ids = [
                UUID(str(value))
                for value in session.execute(
                    text(
                        """
                        select source.event_id
                        from integration.outbox_events source
                        left join activity.projection_receipts receipt
                          on receipt.source_event_id = source.event_id
                        where source.event_type = any(:event_types)
                          and receipt.source_event_id is null
                        order by
                          source.aggregate_type,
                          source.aggregate_id,
                          source.aggregate_version,
                          source.occurred_at,
                          source.created_at,
                          source.event_id
                        limit :limit
                        """
                    ),
                    {"event_types": list(_SOURCE_EVENT_TYPES), "limit": args.limit},
                ).scalars()
            ]
        results = [repository.project_outbox_event(event_id) for event_id in event_ids]
        print(
            "["
            + ",".join(result.model_dump_json() for result in results)
            + "]"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
