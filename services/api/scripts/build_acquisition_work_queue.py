from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.acquisition.work_queue import (
    DEFAULT_CURATION_DIR,
    build_acquisition_work_queue,
    write_local_work_queue,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Build a deterministic, source-oriented acquisition work queue from the "
            "current panda curation inventory without network access."
        )
    )
    parser.add_argument(
        "--curation-dir",
        type=Path,
        default=DEFAULT_CURATION_DIR,
        help="Directory containing pandas.csv, sources.csv, events.csv, media.csv, and backlog.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Output path below .acquisition/work-queue; defaults to the v1 queue filename.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Replace an existing local queue artifact.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    queue = build_acquisition_work_queue(args.curation_dir.resolve())
    output = write_local_work_queue(
        queue,
        args.output,
        overwrite=args.overwrite,
    )
    summary = queue.to_dict()["summary"]
    print(
        json.dumps(
            {
                "schema_version": queue.schema_version,
                "queue_id": queue.queue_id,
                "output": str(output),
                "summary": summary,
                "network_access": False,
                "trusted_write_targets": [],
                "publication_write_targets": [],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
