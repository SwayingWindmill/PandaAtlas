from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path

from app.acquisition.curation import (
    build_batch_review_plan,
    load_acquisition_bundle,
    resolve_acquisition_bundle_path,
    write_batch_review_plan,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Build a deterministic multi-bundle curator review plan. The plan groups semantic "
            "duplicates and routes candidates into review lanes without recording decisions or "
            "writing curation, trusted, or publication data."
        )
    )
    parser.add_argument(
        "--bundle",
        action="append",
        required=True,
        help="Acquisition bundle name or path below .acquisition/bundles; repeatable.",
    )
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument(
        "--generated-at",
        type=_parse_datetime,
        help="Explicit timezone-aware ISO timestamp for reproducible plan generation.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        bundle_paths = [resolve_acquisition_bundle_path(value) for value in args.bundle]
        bundles = [load_acquisition_bundle(path) for path in bundle_paths]
        plan = build_batch_review_plan(
            bundles,
            generated_at=args.generated_at or datetime.now(UTC),
        )
        output = write_batch_review_plan(
            plan,
            args.output,
            overwrite=args.overwrite,
        )
        payload = plan.to_dict()
        print(
            json.dumps(
                {
                    "outcome": "completed",
                    "plan_id": plan.plan_id,
                    "output": str(output),
                    **payload["summary"],
                    "canonical_curation_write_targets": [],
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
