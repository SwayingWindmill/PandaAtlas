from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from uuid import UUID

API_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = Path(__file__).resolve().parents[3]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.core.config import settings  # noqa: E402
from app.db.session import configure_database, has_database, session_scope  # noqa: E402
from app.projection.approved_release_bootstrap import (  # noqa: E402
    APPROVED_RELEASE_VERSION,
    ApprovedReleaseBootstrapError,
    activate_public_projection,
    import_archive_release,
    load_approved_release,
    preflight_release,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Verify and bootstrap one repository-approved Public Release through "
            "the accountable Archive and Public Projection boundaries."
        )
    )
    parser.add_argument("--version", default=APPROVED_RELEASE_VERSION)
    parser.add_argument("--actor-account-id", type=UUID)
    parser.add_argument("--database-url")
    parser.add_argument("--environment", choices=("preview", "production"), default="preview")
    parser.add_argument("--allow-production", action="store_true")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--activate-public", action="store_true")
    parser.add_argument(
        "--reason",
        default="Bootstrap the immutable reviewed Public Release into managed PostgreSQL.",
    )
    return parser


def _print(payload: dict[str, object]) -> None:
    print(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True))


def main() -> int:
    args = _parser().parse_args()
    try:
        bundle = load_approved_release(REPO_ROOT, args.version)
        database_url = args.database_url or settings.database_url or os.getenv("POSTGRES_URL")
        configure_database(database_url)
        if not has_database():
            raise ApprovedReleaseBootstrapError(
                "DATABASE_URL or POSTGRES_URL is required for database preflight"
            )
        if args.environment == "production" and not args.allow_production:
            raise ApprovedReleaseBootstrapError(
                "production requires the explicit --allow-production authorization"
            )
        if args.apply and args.actor_account_id is None:
            raise ApprovedReleaseBootstrapError("--apply requires --actor-account-id")
        if args.activate_public and not args.apply:
            raise ApprovedReleaseBootstrapError("--activate-public requires --apply")

        with session_scope() as session:
            if session is None:
                raise ApprovedReleaseBootstrapError("database session is unavailable")
            preflight = preflight_release(session, bundle, args.actor_account_id)
            session.rollback()
        if not args.apply:
            _print({"outcome": "dry-run", "environment": args.environment, **preflight})
            return 0

        actor_account_id = args.actor_account_id
        assert actor_account_id is not None
        with session_scope() as session:
            if session is None:
                raise ApprovedReleaseBootstrapError("database session is unavailable")
            release_id = import_archive_release(
                session,
                bundle,
                actor_account_id,
                reason=args.reason,
            )
            session.commit()

        activated = False
        if args.activate_public:
            with session_scope() as session:
                if session is None:
                    raise ApprovedReleaseBootstrapError("database session is unavailable")
                activated = activate_public_projection(
                    session,
                    bundle,
                    release_id,
                    actor_account_id,
                    reason=args.reason,
                )
                session.commit()

        with session_scope() as session:
            if session is None:
                raise ApprovedReleaseBootstrapError("database session is unavailable")
            result = preflight_release(session, bundle, actor_account_id)
            session.rollback()
        _print(
            {
                "outcome": "applied",
                "environment": args.environment,
                "release_id": str(release_id),
                "public_projection_activated": activated,
                **result,
            }
        )
        return 0
    except ApprovedReleaseBootstrapError as error:
        _print({"outcome": "refused", "error": str(error)})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
