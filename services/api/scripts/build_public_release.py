from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

from app.projection.public_release import PublicReleaseInput, build_public_release


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build an immutable PandaAtlas public release")
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--publication-batch-id", required=True)
    parser.add_argument("--projection-code-version", required=True)
    parser.add_argument("--database-migration-version", required=True)
    parser.add_argument("--released-at", required=True, help="Timezone-aware ISO-8601 timestamp")
    return parser.parse_args()


def main() -> int:
    args = _arguments()
    source_state = json.loads(args.source.read_text(encoding="utf-8"))
    release = build_public_release(
        PublicReleaseInput(
            source_state=source_state,
            publication_batch_id=args.publication_batch_id,
            projection_code_version=args.projection_code_version,
            database_migration_version=args.database_migration_version,
            released_at=datetime.fromisoformat(args.released_at.replace("Z", "+00:00")),
        )
    )
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
