from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime

from app.acquisition.curation import (
    POLICY_ID,
    build_collection_decision_log,
    export_curation_patch,
    load_acquisition_bundle,
    write_curation_patch,
    write_decision_log,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Apply the deterministic private-collection review policy to one or more acquisition "
            "bundles, write append-only decision logs, and export provenance-preserving patch "
            "bundles. This command does not modify curation CSVs, trusted data, or publication "
            "data."
        )
    )
    parser.add_argument(
        "--bundle",
        action="append",
        required=True,
        help="Acquisition bundle path or name below .acquisition/bundles; repeatable.",
    )
    parser.add_argument(
        "--output-prefix",
        required=True,
        help="Filename prefix used below .acquisition/decisions and .acquisition/curation-patches.",
    )
    parser.add_argument("--reviewer", default=POLICY_ID)
    parser.add_argument(
        "--decided-at",
        type=_parse_datetime,
        help="Explicit timezone-aware ISO timestamp for reproducible decision logs.",
    )
    parser.add_argument("--overwrite", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    decided_at = args.decided_at or datetime.now(UTC)
    outputs: list[dict[str, object]] = []
    try:
        for bundle_value in args.bundle:
            bundle = load_acquisition_bundle(bundle_value)
            log, summary = build_collection_decision_log(
                bundle,
                decided_at=decided_at,
                reviewer=args.reviewer,
            )
            adapter_key = _filename_key(bundle.run.adapter_id)
            decision_name = f"{args.output_prefix}-{adapter_key}-decisions.json"
            patch_name = f"{args.output_prefix}-{adapter_key}-patch.json"
            decision_path = write_decision_log(
                log,
                decision_name,
                overwrite=args.overwrite,
            )
            patch = export_curation_patch(bundle, log, created_at=decided_at)
            patch_path = write_curation_patch(
                patch,
                patch_name,
                overwrite=args.overwrite,
            )
            outputs.append(
                {
                    "adapter_id": bundle.run.adapter_id,
                    "bundle_id": bundle.bundle_id,
                    "decision_log_id": log.decision_log_id,
                    "patch_id": patch.patch_id,
                    "proposal_counts": patch.proposal_counts(),
                    "decision_summary": summary.to_dict(),
                    "decision_output": str(decision_path),
                    "patch_output": str(patch_path),
                }
            )
        print(
            json.dumps(
                {
                    "outcome": "completed",
                    "policy_id": POLICY_ID,
                    "decided_at": decided_at.isoformat(),
                    "bundle_count": len(outputs),
                    "outputs": outputs,
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


def _filename_key(value: str) -> str:
    result = "".join(
        character if character.isalnum() or character in "-_" else "-" for character in value
    )
    normalized = result.strip("-")
    if not normalized:
        raise ValueError("adapter ID cannot produce an empty output key")
    return normalized


def _parse_datetime(value: str) -> datetime:
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as error:
        raise argparse.ArgumentTypeError("decided-at must be an ISO timestamp") from error
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise argparse.ArgumentTypeError("decided-at must include a timezone")
    return parsed


if __name__ == "__main__":
    raise SystemExit(main())
