from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

_SCRIPT_PARENT = Path(__file__).resolve().parent.parent
_REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
_DEFAULT_CURATION_DIR = _REPOSITORY_ROOT / "data" / "curation" / "pandas"
_REPORT_ROOT = _REPOSITORY_ROOT / ".acquisition" / "application-reports"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Rebuild the reviewed Smithsonian current-pair patch and validate or apply it "
            "transactionally to the repository curation CSV intake."
        )
    )
    parser.add_argument("--live-bundle", required=True)
    parser.add_argument("--decisions", required=True)
    parser.add_argument("--expected-patch-id", required=True)
    parser.add_argument(
        "--curation-dir",
        type=Path,
        default=_DEFAULT_CURATION_DIR,
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Commit the validated staged directory. The default is a zero-write dry-run.",
    )
    parser.add_argument(
        "--report-output",
        type=Path,
        help="Optional JSON report path below .acquisition/application-reports.",
    )
    parser.add_argument(
        "--overwrite-report",
        action="store_true",
        help="Replace an existing local application report.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    if str(_SCRIPT_PARENT) not in sys.path:
        sys.path.insert(0, str(_SCRIPT_PARENT))
    from app.acquisition.contracts import AcquisitionMode
    from app.acquisition.curation import load_acquisition_bundle, load_decision_log
    from app.enrichment import (
        apply_smithsonian_current_pair_curation_patch_to_csv,
        export_smithsonian_current_pair_curation_patch,
    )
    from scripts.check_smithsonian_current_pair_enrichment import (
        _build_cohort,
        _canonical_inputs,
    )

    args = build_parser().parse_args(argv)
    try:
        bundle = load_acquisition_bundle(args.live_bundle)
        if bundle.run.mode is not AcquisitionMode.LIVE:
            raise ValueError("--live-bundle must reference a live acquisition bundle")
        decision_log = load_decision_log(args.decisions)
        canonical_records, canonical_source = _canonical_inputs()
        completed_at = bundle.run.completed_at or bundle.run.started_at
        cohort = _build_cohort(
            bundle,
            canonical_records=canonical_records,
            canonical_source=canonical_source,
            created_at=completed_at,
            generated_at=completed_at + timedelta(minutes=5),
        )
        now = datetime.now(UTC)
        patch = export_smithsonian_current_pair_curation_patch(
            cohort,
            decision_log,
            created_at=max(now, decision_log.updated_at),
        )
        if patch.patch_id != args.expected_patch_id:
            raise ValueError("rebuilt Smithsonian patch ID does not match --expected-patch-id")
        result = apply_smithsonian_current_pair_curation_patch_to_csv(
            patch,
            curation_dir=args.curation_dir.resolve(),
            applied_at=now,
            apply=args.apply,
        )
        payload = {
            "outcome": "applied" if result.applied else "dry-run",
            **result.to_dict(),
            "curation_dir": str(args.curation_dir.resolve()),
        }
        if args.report_output is not None:
            report_path = _write_report(
                args.report_output,
                payload,
                overwrite=args.overwrite_report,
            )
            payload["report_output"] = str(report_path)
        print(json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False))
        return 0
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


def _write_report(
    output: Path,
    payload: dict[str, object],
    *,
    overwrite: bool,
) -> Path:
    root = _REPORT_ROOT.resolve()
    path = output.resolve() if output.is_absolute() else (root / output).resolve()
    try:
        path.relative_to(root)
    except ValueError as error:
        raise ValueError(f"application report must stay below {root}") from error
    if path.suffix != ".json":
        raise ValueError("application reports must use the .json suffix")
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and not overwrite:
        raise FileExistsError(f"application report already exists: {path}")
    body = json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    temporary = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    try:
        temporary.write_text(body, encoding="utf-8")
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)
    return path


if __name__ == "__main__":
    raise SystemExit(main())
