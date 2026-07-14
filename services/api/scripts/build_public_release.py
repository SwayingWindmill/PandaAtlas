from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from uuid import UUID

from app.projection.postgres_source import load_reviewed_postgres_release
from app.projection.public_release import PublicReleaseInput, build_public_release


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build an immutable PandaAtlas public release")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--source", type=Path)
    source.add_argument("--database-url")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--publication-batch-id", required=True)
    parser.add_argument("--projection-code-version")
    parser.add_argument("--database-migration-version")
    parser.add_argument("--released-at", help="Timezone-aware ISO-8601 timestamp")
    return parser.parse_args()


def main() -> int:
    args = _arguments()
    if args.database_url:
        release_input = load_reviewed_postgres_release(
            database_url=args.database_url,
            publication_batch_id=UUID(args.publication_batch_id),
        )
    else:
        required_fixture_args = (
            args.projection_code_version,
            args.database_migration_version,
            args.released_at,
        )
        if not all(required_fixture_args):
            raise SystemExit(
                "Fixture builds require --projection-code-version, "
                "--database-migration-version, and --released-at"
            )
        source_state = json.loads(args.source.read_text(encoding="utf-8"))
        release_input = PublicReleaseInput(
            source_state=source_state,
            publication_batch_id=args.publication_batch_id,
            projection_code_version=args.projection_code_version,
            database_migration_version=args.database_migration_version,
            released_at=datetime.fromisoformat(args.released_at.replace("Z", "+00:00")),
        )
    release = build_public_release(release_input)
    release_directory = args.output / release.release_metadata["dataset_release_version"]
    release_directory.mkdir(parents=True, exist_ok=False)
    for filename, content in release.files.items():
        (release_directory / filename).write_text(content, encoding="utf-8", newline="")
    (release_directory / "manifest.json").write_text(
        json.dumps(release.manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="",
    )
    print(release_directory)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
