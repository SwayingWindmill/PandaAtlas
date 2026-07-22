from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from app.acquisition.adapters import DEFAULT_ADAPTER_REGISTRY
from app.acquisition.contracts import AcquisitionMode
from app.acquisition.runner import (
    AdapterRunRequest,
    AdapterRunStopped,
    run_adapter,
)
from app.acquisition.wikimedia_commons import ADAPTER_ID, SOURCE_ID


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Run one registry-controlled acquisition adapter and write a review-only "
            "candidate bundle below .acquisition/bundles."
        )
    )
    parser.add_argument(
        "--source-id",
        default=SOURCE_ID,
        help="Reviewed source registry ID.",
    )
    parser.add_argument(
        "--adapter-id",
        default=ADAPTER_ID,
        help="Source-specific adapter ID allowlisted by the reviewed source.",
    )
    parser.add_argument(
        "--mode",
        choices=[AcquisitionMode.FIXTURE.value, AcquisitionMode.LIVE.value],
        default=AcquisitionMode.FIXTURE.value,
        help="Use an offline fixture or execute the source's reviewed live request policy.",
    )
    parser.add_argument(
        "--live",
        action="store_const",
        const=AcquisitionMode.LIVE.value,
        dest="mode",
        help="Compatibility alias for --mode live.",
    )
    parser.add_argument(
        "--cohort",
        help="Optional source-oriented cohort label; adapter default is used when omitted.",
    )
    parser.add_argument(
        "--fixture",
        type=Path,
        help=(
            "Offline response file, or a v1 fixture manifest for multi-request adapters. "
            "The adapter default is used when omitted."
        ),
    )
    parser.add_argument(
        "--output-bundle",
        "--output",
        dest="output_bundle",
        type=Path,
        help="JSON output path below .acquisition/bundles; defaults to the generated run ID.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Replace an existing local bundle at the requested output path.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    request = AdapterRunRequest(
        source_id=args.source_id,
        adapter_id=args.adapter_id,
        mode=AcquisitionMode(args.mode),
        cohort=args.cohort,
        fixture=args.fixture,
        output_bundle=args.output_bundle,
        overwrite=args.overwrite,
    )
    try:
        result = run_adapter(
            request,
            adapter_registry=DEFAULT_ADAPTER_REGISTRY,
        )
    except AdapterRunStopped as error:
        print(
            json.dumps(
                _summary(error.result, outcome="stopped", message=str(error)),
                ensure_ascii=False,
                indent=2,
            ),
            file=sys.stderr,
        )
        raise SystemExit(2) from error
    except (FileExistsError, FileNotFoundError, KeyError, ValueError) as error:
        print(
            json.dumps(
                {
                    "outcome": "rejected",
                    "message": str(error),
                    "source_id": request.source_id,
                    "adapter_id": request.adapter_id,
                    "mode": request.mode.value,
                    "trusted_write_targets": [],
                    "publication_write_targets": [],
                },
                ensure_ascii=False,
                indent=2,
            ),
            file=sys.stderr,
        )
        raise SystemExit(2) from error

    print(
        json.dumps(
            _summary(result, outcome="completed"),
            ensure_ascii=False,
            indent=2,
        )
    )


def _summary(result, *, outcome: str, message: str | None = None) -> dict:
    bundle = result.bundle
    return {
        "outcome": outcome,
        "message": message,
        "schema_version": bundle.schema_version,
        "bundle_id": bundle.bundle_id,
        "run_id": bundle.run.run_id,
        "run_state": bundle.run.state.value,
        "source_id": bundle.run.source_id,
        "adapter_id": bundle.run.adapter_id,
        "cohort": bundle.run.cohort,
        "mode": bundle.run.mode.value,
        "request_count": result.request_count,
        "evidence_snapshot_count": len(bundle.evidence_snapshots),
        "candidate_count": len(bundle.candidates),
        "output_bundle": str(result.output_path),
        "trusted_write_targets": [],
        "publication_write_targets": [],
    }


if __name__ == "__main__":
    main()
