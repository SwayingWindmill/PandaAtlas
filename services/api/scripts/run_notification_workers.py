from __future__ import annotations

import argparse
import json
from typing import Never
from uuid import UUID

from app.core.config import Settings
from app.db.session import configure_database, session_scope
from app.notification.delivery import NotificationDeliveryRepository
from app.notification.templates import NotificationTemplateRenderer, RenderedEmail
from app.notification.transport import (
    NotificationEmailTransport,
    ResendTransport,
)


class PausedTransport:
    provider = "paused"

    def send(
        self,
        *,
        delivery_id: UUID,
        to_email: str,
        rendered: RenderedEmail,
    ) -> Never:
        raise AssertionError("paused Notification transport must not send email")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run one bounded Notification worker batch")
    parser.add_argument("mode", choices=("relay", "delivery", "webhooks"))
    parser.add_argument("--limit", type=int, default=50)
    return parser.parse_args()


def build_transport(settings: Settings) -> NotificationEmailTransport:
    if not settings.notification_email_enabled:
        return PausedTransport()
    assert settings.resend_api_key is not None
    assert settings.resend_from_email is not None
    return ResendTransport(
        api_url=settings.resend_api_url,
        api_key=settings.resend_api_key,
        from_email=settings.resend_from_email,
    )


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
        repository = NotificationDeliveryRepository(session)
        if args.mode == "relay":
            result: object = repository.relay_outbox(
                limit=args.limit,
                email_enabled=settings.notification_email_enabled,
            )
        elif args.mode == "delivery":
            result = repository.process_delivery_queue(
                transport=build_transport(settings),
                renderer=NotificationTemplateRenderer(
                    public_base_url=settings.notification_public_base_url
                ),
                email_enabled=settings.notification_email_enabled,
                visibility_timeout_seconds=(
                    settings.notification_worker_visibility_timeout_seconds
                ),
                max_attempts=settings.notification_worker_max_attempts,
                base_backoff_seconds=settings.notification_worker_base_backoff_seconds,
                limit=args.limit,
            )
        else:
            result = repository.process_webhook_queue(
                visibility_timeout_seconds=(
                    settings.notification_worker_visibility_timeout_seconds
                ),
                max_attempts=settings.notification_worker_max_attempts,
                base_backoff_seconds=settings.notification_worker_base_backoff_seconds,
                limit=args.limit,
            )
    if hasattr(result, "model_dump"):
        result = result.model_dump(mode="json")
    print(json.dumps(result, sort_keys=True, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
