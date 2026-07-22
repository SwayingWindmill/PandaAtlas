from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime

from app.acquisition.curation import (
    DecisionAction,
    export_curation_patch,
    load_acquisition_bundle,
    load_decision_log,
    record_decision,
    render_summary_text,
    resolve_decision_path,
    summarize_candidates,
    write_curation_patch,
    write_decision_log,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Summarize acquisition candidates, append curator decisions, and export "
            "provenance-preserving curation patch proposals."
        )
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    summary = subparsers.add_parser(
        "summary",
        help="Group candidates by panda, source, fact kind, and conflict state.",
    )
    summary.add_argument("--bundle", required=True, help="Acquisition bundle JSON path or name.")
    summary.add_argument(
        "--decisions",
        help="Optional curator decision log JSON path or name.",
    )
    summary.add_argument(
        "--format",
        choices=("text", "json"),
        default="text",
        help="Summary output format.",
    )

    decide = subparsers.add_parser(
        "decide",
        help="Append one accept, reject, or defer decision to a versioned decision log.",
    )
    decide.add_argument("--bundle", required=True, help="Acquisition bundle JSON path or name.")
    decide.add_argument(
        "--decisions",
        required=True,
        help="Decision log JSON path or name below the local decision root.",
    )
    decide.add_argument("--candidate-id", required=True)
    decide.add_argument(
        "--decision",
        required=True,
        choices=tuple(action.value for action in DecisionAction),
    )
    decide.add_argument("--reviewer", required=True, help="Stable reviewer identity.")
    decide.add_argument(
        "--decided-at",
        help="ISO 8601 decision timestamp. Defaults to the current UTC time.",
    )
    decide.add_argument("--note", help="Optional curator note.")

    export = subparsers.add_parser(
        "export",
        help="Export effective accepted decisions as a curation patch proposal bundle.",
    )
    export.add_argument("--bundle", required=True, help="Acquisition bundle JSON path or name.")
    export.add_argument(
        "--decisions", required=True, help="Curator decision log JSON path or name."
    )
    export.add_argument(
        "--output",
        required=True,
        help="Patch JSON path or name below the local curation-patch root.",
    )
    export.add_argument(
        "--overwrite",
        action="store_true",
        help="Replace an existing local patch file.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        if args.command == "summary":
            return _summary(args)
        if args.command == "decide":
            return _decide(args)
        if args.command == "export":
            return _export(args)
        parser.error(f"unknown command {args.command}")
    except (FileExistsError, FileNotFoundError, ValueError) as error:
        print(
            json.dumps(
                {"outcome": "refused", "message": str(error)},
                ensure_ascii=False,
                indent=2,
            ),
            file=sys.stderr,
        )
        return 2
    return 2


def _summary(args: argparse.Namespace) -> int:
    bundle = load_acquisition_bundle(args.bundle)
    decisions = load_decision_log(args.decisions) if args.decisions else None
    summary = summarize_candidates(bundle, decisions)
    if args.format == "json":
        print(json.dumps(summary.to_dict(), ensure_ascii=False, indent=2))
    else:
        print(render_summary_text(summary))
    return 0


def _decide(args: argparse.Namespace) -> int:
    bundle = load_acquisition_bundle(args.bundle)
    decision_path = resolve_decision_path(args.decisions)
    existing = load_decision_log(decision_path) if decision_path.exists() else None
    recorded_at = datetime.now(UTC)
    decided_at = _parse_datetime(args.decided_at) if args.decided_at else recorded_at
    log, decision = record_decision(
        bundle,
        existing_log=existing,
        candidate_id=args.candidate_id,
        action=DecisionAction(args.decision),
        reviewer=args.reviewer,
        decided_at=decided_at,
        recorded_at=recorded_at,
        note=args.note,
    )
    output_path = write_decision_log(
        log,
        decision_path,
        overwrite=existing is not None,
    )
    print(
        json.dumps(
            {
                "outcome": "recorded",
                "decision_log_id": log.decision_log_id,
                "decision_id": decision.decision_id,
                "candidate_id": decision.candidate_id,
                "decision": decision.action.value,
                "reviewer": decision.reviewer,
                "decided_at": _format_datetime(decision.decided_at),
                "output": str(output_path),
                "canonical_curation_write_targets": [],
                "trusted_write_targets": [],
                "publication_write_targets": [],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


def _export(args: argparse.Namespace) -> int:
    bundle = load_acquisition_bundle(args.bundle)
    decisions = load_decision_log(args.decisions)
    patch = export_curation_patch(bundle, decisions)
    output_path = write_curation_patch(
        patch,
        args.output,
        overwrite=args.overwrite,
    )
    print(
        json.dumps(
            {
                "outcome": "exported",
                "patch_id": patch.patch_id,
                "acquisition_bundle_id": patch.acquisition_bundle_id,
                "decision_log_id": patch.decision_log_id,
                "proposal_counts": patch.proposal_counts(),
                "source_evidence_count": len(patch.sources),
                "output": str(output_path),
                "canonical_curation_write_targets": [],
                "trusted_write_targets": [],
                "publication_write_targets": [],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


def _parse_datetime(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("--decided-at must be an ISO 8601 datetime") from error
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError("--decided-at must include a timezone")
    return parsed


def _format_datetime(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


if __name__ == "__main__":
    raise SystemExit(main())
