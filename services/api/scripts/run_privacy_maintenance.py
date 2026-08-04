from __future__ import annotations

import argparse
import json
from uuid import UUID, uuid4

from app.core.config import settings
from app.db.session import configure_database, session_scope
from app.privacy_operations.maintenance import PrivacyMaintenanceService


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Purge expired Privacy data and optionally reapply deletion tombstones "
            "after a backup restore."
        )
    )
    parser.add_argument("--database-url", default=settings.database_url)
    parser.add_argument("--actor-account-id", type=UUID, required=True)
    parser.add_argument("--idempotency-key", default=None)
    parser.add_argument("--max-scan-attempts", type=int, default=3)
    parser.add_argument("--tombstone-account-limit", type=int, default=100)
    parser.add_argument("--replay-tombstones-after-restore", action="store_true")
    args = parser.parse_args()
    if not args.database_url:
        parser.error("--database-url or DATABASE_URL is required")
    if not 1 <= args.max_scan_attempts <= 10:
        parser.error("--max-scan-attempts must be between 1 and 10")
    if not 1 <= args.tombstone_account_limit <= 1000:
        parser.error("--tombstone-account-limit must be between 1 and 1000")

    configure_database(args.database_url)
    try:
        with session_scope() as session:
            if session is None:
                raise RuntimeError("database is unavailable")
            result = PrivacyMaintenanceService(session).run(
                actor_account_id=args.actor_account_id,
                replay_tombstones_after_restore=(
                    args.replay_tombstones_after_restore
                ),
                tombstone_account_limit=args.tombstone_account_limit,
                max_scan_attempts=args.max_scan_attempts,
                idempotency_key=(
                    args.idempotency_key
                    or f"privacy-maintenance-{uuid4()}"
                ),
                correlation_id=uuid4(),
            )
        print(json.dumps(result.model_dump(mode="json"), sort_keys=True))
        return 0
    finally:
        configure_database(None)


if __name__ == "__main__":
    raise SystemExit(main())
