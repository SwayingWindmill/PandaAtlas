from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from app.acquisition.curation import (
    export_curation_patch,
    load_acquisition_bundle,
    load_decision_log,
)
from app.enrichment import apply_chengdu_collection_patches

_REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
_DEFAULT_CURATION_DIR = _REPOSITORY_ROOT / "data" / "curation" / "pandas"
_DEFAULT_IDENTITY_LINKS = _REPOSITORY_ROOT / "data" / "acquisition-sources" / "identity-links.json"
_REPORT_ROOT = _REPOSITORY_ROOT / ".acquisition" / "application-reports"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Validate and optionally atomically apply accepted Chengdu collection decisions to "
            "curation CSVs and identity-links.json. Default behavior is a dry run."
        )
    )
    parser.add_argument("--bundle", action="append", required=True)
    parser.add_argument("--decisions", action="append", required=True)
    parser.add_argument("--curation-dir", type=Path, default=_DEFAULT_CURATION_DIR)
    parser.add_argument("--identity-links", type=Path, default=_DEFAULT_IDENTITY_LINKS)
    parser.add_argument("--applied-at", type=_parse_datetime)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--report", type=Path)
    parser.add_argument("--overwrite-report", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if len(args.bundle) != len(args.decisions):
        raise SystemExit("--bundle and --decisions must be repeated the same number of times")
    applied_at = args.applied_at or datetime.now(UTC)
    try:
        patches = []
        for bundle_value, decision_value in zip(args.bundle, args.decisions, strict=True):
            bundle = load_acquisition_bundle(bundle_value)
            decisions = load_decision_log(decision_value)
            patches.append(export_curation_patch(bundle, decisions, created_at=applied_at))
        result = apply_chengdu_collection_patches(
            patches,
            curation_dir=args.curation_dir,
            identity_links_path=args.identity_links,
            applied_at=applied_at,
            apply=args.apply,
        )
        payload = {
            "outcome": "applied" if args.apply else "dry-run",
            **result.to_dict(),
            "curation_dir": str(args.curation_dir),
            "identity_links": str(args.identity_links),
            "trusted_write_targets": [],
            "publication_write_targets": [],
        }
        report_path = None
        if args.report is not None:
            report_path = _write_report(
                args.report,
                payload,
                overwrite=args.overwrite_report,
            )
            payload["report"] = str(report_path)
        print(json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False))
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


def _write_report(
    value: Path,
    payload: dict[str, object],
    *,
    overwrite: bool,
) -> Path:
    root = _REPORT_ROOT.resolve()
    requested = value
    if requested.is_absolute():
        path = requested.resolve()
    else:
        repository_candidate = (_REPOSITORY_ROOT / requested).resolve()
        try:
            repository_candidate.relative_to(root)
        except ValueError:
            path = (root / requested).resolve()
        else:
            path = repository_candidate
    try:
        path.relative_to(root)
    except ValueError as error:
        raise ValueError(f"application report must stay below {root}") from error
    if path.suffix != ".json":
        raise ValueError("application report must use the .json suffix")
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and not overwrite:
        raise FileExistsError(path)
    temporary = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    try:
        temporary.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
            encoding="utf-8",
            newline="",
        )
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)
    return path


def _parse_datetime(value: str) -> datetime:
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as error:
        raise argparse.ArgumentTypeError("applied-at must be an ISO timestamp") from error
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise argparse.ArgumentTypeError("applied-at must include a timezone")
    return parsed


if __name__ == "__main__":
    raise SystemExit(main())
