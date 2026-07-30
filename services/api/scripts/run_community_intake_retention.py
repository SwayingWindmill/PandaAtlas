from __future__ import annotations

import argparse
import json
from uuid import uuid4

from app.community_intake.repository import CommunityIntakeRepository, default_storage
from app.core.config import settings
from app.db.session import configure_database, session_scope


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Expire Community Intake drafts, retry scans, and clean orphan uploads."
    )
    parser.add_argument("--database-url", default=settings.database_url)
    parser.add_argument(
        "--max-scan-attempts",
        type=int,
        default=settings.community_intake_max_scan_attempts,
    )
    args = parser.parse_args()
    if not args.database_url:
        parser.error("--database-url or DATABASE_URL is required")
    configure_database(args.database_url)
    try:
        with session_scope() as session:
            if session is None:
                raise RuntimeError("database is unavailable")
            result = CommunityIntakeRepository(
                session,
                storage=default_storage(
                    settings.community_intake_storage_signing_key,
                    settings.community_intake_storage_reference_ttl_seconds,
                ),
            ).expire_and_repair(
                correlation_id=uuid4(),
                max_scan_attempts=args.max_scan_attempts,
            )
        print(json.dumps(result.model_dump(mode="json"), sort_keys=True))
        return 0
    finally:
        configure_database(None)


if __name__ == "__main__":
    raise SystemExit(main())
