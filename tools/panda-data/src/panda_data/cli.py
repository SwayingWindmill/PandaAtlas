from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from uuid import UUID

from panda_data.contracts import check_contracts
from panda_data.paths import repository_root
from panda_data.pipeline import build_artifact_manifest


def _json(value: object, *, stream=sys.stdout) -> None:
    print(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True), file=stream)


def _contracts_check(_: argparse.Namespace) -> int:
    checked = check_contracts()
    _json({"outcome": "ok", "draft": "2020-12", "contracts": list(checked)})
    return 0


def _source_run(args: argparse.Namespace) -> int:
    from panda_data.acquisition.adapters import DEFAULT_ADAPTER_REGISTRY
    from panda_data.acquisition.contracts import AcquisitionMode
    from panda_data.acquisition.runner import AdapterRunRequest, AdapterRunStopped, run_adapter

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
        result = run_adapter(request, adapter_registry=DEFAULT_ADAPTER_REGISTRY)
    except AdapterRunStopped as error:
        _json(
            _source_summary(error.result, outcome="stopped", message=str(error)),
            stream=sys.stderr,
        )
        return 2
    except (FileExistsError, FileNotFoundError, KeyError, ValueError) as error:
        _json(
            {
                "outcome": "rejected",
                "message": str(error),
                "sourceId": request.source_id,
                "adapterId": request.adapter_id,
                "mode": request.mode.value,
                "authoritativeWriteTargets": [],
            },
            stream=sys.stderr,
        )
        return 2

    _json(_source_summary(result, outcome="completed"))
    return 0


def _source_summary(
    result: object,
    *,
    outcome: str,
    message: str | None = None,
) -> dict[str, object]:
    bundle = result.bundle
    return {
        "outcome": outcome,
        "message": message,
        "schemaVersion": bundle.schema_version,
        "bundleId": bundle.bundle_id,
        "runId": bundle.run.run_id,
        "runState": bundle.run.state.value,
        "sourceId": bundle.run.source_id,
        "adapterId": bundle.run.adapter_id,
        "cohort": bundle.run.cohort,
        "mode": bundle.run.mode.value,
        "requestCount": result.request_count,
        "evidenceSnapshotCount": len(bundle.evidence_snapshots),
        "candidateCount": len(bundle.candidates),
        "identityStateCounts": dict(
            sorted(Counter(item.identity_match.state.value for item in bundle.candidates).items())
        ),
        "conflictStateCounts": dict(
            sorted(Counter(item.conflict_state.value for item in bundle.candidates).items())
        ),
        "outputBundle": str(result.output_path),
        "authoritativeWriteTargets": [],
    }


def _crawler_compare(args: argparse.Namespace) -> int:
    from panda_data.acquisition.poc import write_comparison_report

    report = write_comparison_report(
        args.output.resolve(),
        include_browser_lab=args.browser_lab or args.require_browser_lab,
        require_browser_lab=args.require_browser_lab,
    )
    _json(
        {
            "outcome": report["outcome"],
            "output": str(args.output.resolve()),
            "primaryOrchestrator": report["decision"]["primary_orchestrator"],
            "specializedAdapter": report["decision"]["specialized_adapter"],
        }
    )
    return 0


def _curation_validate(args: argparse.Namespace) -> int:
    from panda_data.curation import validate_curation

    errors, counts = validate_curation(args.curation_dir)
    if errors:
        _json({"outcome": "invalid", "errors": errors}, stream=sys.stderr)
        return 1
    _json({"outcome": "ok", "counts": counts})
    return 0


def _media_process(args: argparse.Namespace) -> int:
    from panda_data.media import MediaProcessingError, process_media

    try:
        manifest = process_media(
            args.curation_dir,
            args.output_dir,
            allow_network=args.allow_network,
            force=args.force,
            panda_slugs=set(args.panda_slug) or None,
        )
    except MediaProcessingError as error:
        _json({"outcome": "failed", "message": str(error)}, stream=sys.stderr)
        return 1
    _json(
        {
            "outcome": "ok",
            "recordCount": manifest["record_count"],
            "output": str(args.output_dir),
        }
    )
    return 0


def _artifact_manifest(args: argparse.Namespace) -> int:
    manifest = build_artifact_manifest(
        args.path,
        bucket=args.bucket,
        artifact_kind=args.artifact_kind,
        job_id=UUID(args.job_id),
        prefix=args.prefix,
        media_type=args.media_type,
        contract_schema_id=args.contract_schema_id,
    )
    payload = manifest.validated_wire()
    if args.output is not None:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
    _json(payload)
    return 0


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="panda-data",
        description=(
            "Independent PandaAtlas acquisition, enrichment, curation, and artifact runtime."
        ),
    )
    commands = parser.add_subparsers(dest="command", required=True)

    contracts = commands.add_parser("contracts", help="Validate canonical cross-runtime contracts.")
    contract_commands = contracts.add_subparsers(dest="contracts_command", required=True)
    contract_check = contract_commands.add_parser("check")
    contract_check.set_defaults(handler=_contracts_check)

    source = commands.add_parser("source", help="Run reviewed acquisition source adapters.")
    source_commands = source.add_subparsers(dest="source_command", required=True)
    source_run = source_commands.add_parser("run")
    source_run.add_argument("--source-id", default="wikimedia-commons-action-api")
    source_run.add_argument("--adapter-id", default="wikimedia-commons-xi-lun")
    source_run.add_argument("--mode", choices=["fixture", "live"], default="fixture")
    source_run.add_argument("--cohort")
    source_run.add_argument("--fixture", type=Path)
    source_run.add_argument("--output-bundle", type=Path)
    source_run.add_argument("--overwrite", action="store_true")
    source_run.set_defaults(handler=_source_run)

    crawler = commands.add_parser("crawler", help="Run the controlled crawler comparison lab.")
    crawler_commands = crawler.add_subparsers(dest="crawler_command", required=True)
    crawler_compare = crawler_commands.add_parser("compare")
    crawler_compare.add_argument(
        "--output",
        type=Path,
        default=repository_root() / ".release-gate" / "crawler-poc" / "report.json",
    )
    crawler_compare.add_argument("--browser-lab", action="store_true")
    crawler_compare.add_argument("--require-browser-lab", action="store_true")
    crawler_compare.set_defaults(handler=_crawler_compare)

    curation = commands.add_parser("curation", help="Validate reviewed curation inputs.")
    curation_commands = curation.add_subparsers(dest="curation_command", required=True)
    curation_validate = curation_commands.add_parser("validate")
    curation_validate.add_argument(
        "--curation-dir",
        type=Path,
        default=repository_root() / "data" / "curation" / "pandas",
    )
    curation_validate.set_defaults(handler=_curation_validate)

    media = commands.add_parser("media", help="Process reviewed collection media offline.")
    media_commands = media.add_subparsers(dest="media_command", required=True)
    media_process = media_commands.add_parser("process")
    media_process.add_argument(
        "--curation-dir",
        type=Path,
        default=repository_root() / "data" / "curation" / "pandas",
    )
    media_process.add_argument(
        "--output-dir",
        type=Path,
        default=repository_root() / ".media-work",
    )
    media_process.add_argument("--allow-network", action="store_true")
    media_process.add_argument("--force", action="store_true")
    media_process.add_argument("--panda-slug", action="append", default=[])
    media_process.set_defaults(handler=_media_process)

    artifact = commands.add_parser("artifact", help="Build immutable R2 artifact manifests.")
    artifact_commands = artifact.add_subparsers(dest="artifact_command", required=True)
    artifact_manifest = artifact_commands.add_parser("manifest")
    artifact_manifest.add_argument("path", type=Path)
    artifact_manifest.add_argument("--bucket", required=True)
    artifact_manifest.add_argument("--artifact-kind", required=True)
    artifact_manifest.add_argument("--job-id", required=True)
    artifact_manifest.add_argument("--prefix", default="panda-data")
    artifact_manifest.add_argument("--media-type")
    artifact_manifest.add_argument("--contract-schema-id")
    artifact_manifest.add_argument("--output", type=Path)
    artifact_manifest.set_defaults(handler=_artifact_manifest)

    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    return int(args.handler(args))


if __name__ == "__main__":
    raise SystemExit(main())
