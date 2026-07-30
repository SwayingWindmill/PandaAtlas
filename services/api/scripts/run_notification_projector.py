from __future__ import annotations

import argparse
import json
from uuid import UUID

from sqlalchemy import text

from app.core.config import Settings
from app.db.session import configure_database, session_scope
from app.notification.repository import NotificationRepository

_SOURCE_EVENT_TYPES = (
    "activity.item.published",
    "activity.item.corrected",
    "activity.item.retracted",
    "submission.status.changed",
    "contribution.submission_status.changed",
    "contribution.incorporated",
    "submission.incorporated",
    "identity.security.changed",
    "identity.role.assigned",
    "identity.role.revoked",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Project Notification source events")
    parser.add_argument("--event-id", type=UUID)
    parser.add_argument("--limit", type=int, default=100)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.limit < 1 or args.limit > 1000:
        raise SystemExit("--limit must be between 1 and 1000")

    settings = Settings()
    if not settings.notification_enabled:
        raise SystemExit("NOTIFICATION_ENABLED must be true")
    if not settings.database_url:
        raise SystemExit("DATABASE_URL is required")

    configure_database(settings.database_url)
    with session_scope() as session:
        if session is None:
            raise SystemExit("Database session is unavailable")
        repository = NotificationRepository(
            session,
            cursor_signing_key=settings.notification_cursor_signing_key,
        )
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
                        left join notification.source_receipts receipt
                          on receipt.source_event_id = source.event_id
                        where source.event_type = any(:event_types)
                          and receipt.source_event_id is null
                        order by source.occurred_at, source.created_at, source.event_id
                        limit :limit
                        """
                    ),
                    {"event_types": list(_SOURCE_EVENT_TYPES), "limit": args.limit},
                ).scalars()
            ]
        results = [repository.project_outbox_event(event_id) for event_id in event_ids]
        print(json.dumps(results, sort_keys=True, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
