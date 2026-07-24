from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path

from app.acquisition.backfill import (
    DEFAULT_QUEUE_PATH,
    DEFAULT_TARGET_ASSESSMENT_PATH,
    build_breadth_first_report,
    load_target_assessments,
    load_work_queue,
    snapshot_input,
    write_backfill_report,
)
from app.acquisition.curation.io import (
    load_acquisition_bundle,
    resolve_acquisition_bundle_path,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Build a deterministic breadth-first disposition report for every panda in the "
            "acquisition work queue. This command never writes curation, trusted, D1, media, "
            "or public-release data."
        )
    )
    parser.add_argument("--queue", type=Path, default=DEFAULT_QUEUE_PATH)
    parser.add_argument(
        "--target-assessments",
        type=Path,
        default=DEFAULT_TARGET_ASSESSMENT_PATH,
    )
    parser.add_argument(
        "--bundle",
        action="append",
        default=[],
        help="Completed acquisition bundle name or path below .acquisition/bundles; repeatable.",
    )
    parser.add_argument("--output", type=Path)
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument(
        "--generated-at",
        type=_parse_datetime,
        help="Explicit timezone-aware ISO timestamp for reproducible report generation.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        queue_path = args.queue.resolve()
        assessment_path = args.target_assessments.resolve()
        queue, queue_snapshot = load_work_queue(queue_path)
        assessments, assessment_snapshot = load_target_assessments(assessment_path)
        bundle_paths = [resolve_acquisition_bundle_path(value) for value in args.bundle]
        bundles = [load_acquisition_bundle(path) for path in bundle_paths]
        report = build_breadth_first_report(
            queue=queue,
            assessments=assessments,
            bundles=bundles,
            generated_at=args.generated_at or datetime.now(UTC),
            inputs=(
                queue_snapshot,
                assessment_snapshot,
                *(snapshot_input(path) for path in bundle_paths),
            ),
        )
        output_path = write_backfill_report(
            report,
            args.output,
            overwrite=args.overwrite,
        )
        payload = report.to_dict()
        print(
            json.dumps(
                {
                    "outcome": "completed",
                    "report_id": report.report_id,
                    "output": str(output_path),
                    **payload["summary"],
                    "trusted_write_targets": [],
                    "publication_write_targets": [],
                },
                ensure_ascii=False,
                indent=2,
                allow_nan=False,
            )
        )
        return 0
    except (FileExistsError, FileNotFoundError, KeyError, ValueError) as error:
        print(
            json.dumps(
                {"outcome": "refused", "message": str(error)},
                ensure_ascii=False,
                indent=2,
            )
        )
        return 2


def _parse_datetime(value: str) -> datetime:
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as error:
        raise argparse.ArgumentTypeError("generated-at must be an ISO timestamp") from error
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise argparse.ArgumentTypeError("generated-at must include a timezone")
    return parsed


if __name__ == "__main__":
    raise SystemExit(main())
