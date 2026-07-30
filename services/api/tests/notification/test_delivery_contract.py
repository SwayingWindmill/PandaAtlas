from __future__ import annotations

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]


def test_delivery_migration_creates_logged_queues_and_operational_evidence() -> None:
    migration = (
        REPO_ROOT / "infra/supabase/migrations/0015_notification_delivery_workers.sql"
    ).read_text(encoding="utf-8")

    for queue_name in (
        "notification_deliveries",
        "notification_deliveries_dlq",
        "notification_webhooks",
        "notification_webhooks_dlq",
    ):
        assert queue_name in migration
    for relation in (
        "notification.delivery_jobs",
        "notification.transport_attempts",
        "notification.provider_webhook_events",
        "notification.email_suppressions",
        "notification.worker_events",
    ):
        assert relation in migration
    assert "pgmq.create(queue_name)" in migration
    assert "protect_transport_attempt" in migration
    assert "account.state = 'deleting'" in migration
    assert "attempt_cycle_start" in migration
    assert "'submitted'" in migration


def test_worker_uses_visibility_timeout_and_never_destructive_pop() -> None:
    worker = (REPO_ROOT / "services/api/app/notification/delivery.py").read_text(encoding="utf-8")

    assert "pgmq.read" in worker
    assert "pgmq.set_vt" in worker
    assert "pgmq.archive" in worker
    assert "pgmq.send" in worker
    assert "pgmq.pop" not in worker
    assert "Idempotency-Key" in (
        REPO_ROOT / "services/api/app/notification/transport.py"
    ).read_text(encoding="utf-8")


def test_templates_and_operator_commands_are_repository_owned() -> None:
    for locale in ("zh-CN", "en"):
        for template in ("intent", "digest"):
            for suffix in ("html", "txt"):
                assert (
                    REPO_ROOT
                    / "services/api/app/notification/templates"
                    / locale
                    / f"{template}.{suffix}"
                ).is_file()

    package = json.loads((REPO_ROOT / "package.json").read_text(encoding="utf-8"))
    for command in (
        "notification:relay",
        "notification:deliver",
        "notification:webhooks",
        "notification:retry",
        "test:notification-delivery",
    ):
        assert command in package["scripts"]


def test_private_account_deletion_includes_transport_rows() -> None:
    repository = (REPO_ROOT / "services/api/app/engagement/repository.py").read_text(
        encoding="utf-8"
    )

    assert "delete from notification.transport_attempts" in repository
    assert "delete from notification.delivery_jobs" in repository
    assert "delete from notification.email_suppressions" in repository


def test_webhook_route_is_signed_and_minimizes_provider_payload() -> None:
    route = (REPO_ROOT / "services/api/app/api/v1/notification.py").read_text(encoding="utf-8")
    transport = (REPO_ROOT / "services/api/app/notification/transport.py").read_text(
        encoding="utf-8"
    )

    assert '"/webhooks/resend"' in route
    assert "verify_resend_webhook" in route
    assert 'Header(alias="svix-id"' in route
    assert 'Header(alias="svix-timestamp"' in route
    assert 'Header(alias="svix-signature"' in route
    assert "_MAX_RESEND_WEBHOOK_BYTES = 64 * 1024" in route
    assert "HTTP_413_CONTENT_TOO_LARGE" in route
    assert '"to"' not in transport.split("return {", 1)[1].split("}", 1)[0]
