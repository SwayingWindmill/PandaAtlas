from __future__ import annotations

import argparse
import json
from uuid import UUID, uuid4

from app.core.config import Settings
from app.db.session import configure_database, session_scope
from app.notification.delivery import NotificationDeliveryRepository


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Requeue one failed Notification delivery")
    parser.add_argument("--delivery-id", type=UUID, required=True)
    parser.add_argument("--correlation-id", type=UUID, default=None)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    settings = Settings()
    if not settings.notification_enabled:
        raise SystemExit("NOTIFICATION_ENABLED must be true")
    if not settings.database_url:
        raise SystemExit("DATABASE_URL is required")
    configure_database(settings.database_url)
    correlation_id = args.correlation_id or uuid4()
    with session_scope() as session:
        if session is None:
            raise SystemExit("Database session is unavailable")
        message_id = NotificationDeliveryRepository(session).requeue_delivery(
            args.delivery_id,
            correlation_id=correlation_id,
        )
    print(
        json.dumps(
            {
                "delivery_id": str(args.delivery_id),
                "queue_message_id": message_id,
                "correlation_id": str(correlation_id),
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
