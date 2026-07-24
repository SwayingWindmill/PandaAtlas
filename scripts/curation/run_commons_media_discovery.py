from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import shutil
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
API_ROOT = REPO_ROOT / "services" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.acquisition.models import ResponseEnvelope  # noqa: E402
from app.acquisition.source_registry import load_source_registry  # noqa: E402
from app.acquisition.wikimedia_media_discovery import (  # noqa: E402
    CommonsSearchTask,
    fetch_search,
    parse_search_response,
)

DEFAULT_COHORT = (
    REPO_ROOT / "data" / "media-library" / "discovery" / "commons-first-public-five.json"
)
DEFAULT_FIXTURE_DIR = (
    REPO_ROOT
    / "services"
    / "api"
    / "tests"
    / "acquisition"
    / "fixtures"
    / "commons-media-discovery"
)
DEFAULT_OUTPUT = (
    REPO_ROOT
    / "data"
    / "media-library"
    / "discovery"
    / "commons-first-public-five-results.json"
)
DEFAULT_MANIFEST_OUTPUT = (
    REPO_ROOT
    / "data"
    / "media-library"
    / "discovery"
    / "commons-first-public-five-results-manifest.json"
)
SOURCE_REGISTRY = REPO_ROOT / "data" / "acquisition-sources" / "registry.json"


class DiscoveryRunError(RuntimeError):
    pass


def pretty_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n"


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def file_descriptor(path: Path) -> dict[str, Any]:
    payload = path.read_bytes()
    try:
        display_path = path.resolve().relative_to(REPO_ROOT).as_posix()
    except ValueError:
        display_path = path.resolve().as_posix()
    return {
        "path": display_path,
        "bytes": len(payload),
        "sha256": sha256_bytes(payload),
    }


def fixture_path(directory: Path, task: CommonsSearchTask) -> Path:
    return directory / f"{task.panda_slug}.json"


def envelope_to_fixture(response: ResponseEnvelope) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "requested_url": response.requested_url,
        "final_url": response.final_url,
        "status": response.status,
        "headers": dict(sorted(response.headers.items(), key=lambda item: item[0].lower())),
        "body_base64": base64.b64encode(response.body).decode("ascii"),
    }


def fixture_to_envelope(payload: dict[str, Any]) -> ResponseEnvelope:
    if payload.get("schema_version") != 1:
        raise DiscoveryRunError("Commons media discovery fixture must use schema_version 1")
    return ResponseEnvelope(
        requested_url=str(payload["requested_url"]),
        final_url=str(payload["final_url"]),
        status=int(payload["status"]),
        headers={str(key): str(value) for key, value in payload["headers"].items()},
        body=base64.b64decode(payload["body_base64"], validate=True),
    )


def load_cohort(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("schema_version") != 1:
        raise DiscoveryRunError("Commons media discovery cohort must use schema_version 1")
    tasks = payload.get("tasks")
    if not isinstance(tasks, list) or not tasks:
        raise DiscoveryRunError("Commons media discovery cohort requires tasks")
    if payload.get("task_count") != len(tasks):
        raise DiscoveryRunError("Commons media discovery cohort task_count drifted")
    if payload.get("publication_write_targets") != []:
        raise DiscoveryRunError("Commons media discovery cohort cannot declare publication writes")
    return payload


def install_atomically(output: Path, payload: dict[str, Any]) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary_dir = Path(tempfile.mkdtemp(prefix=f".{output.stem}-", dir=output.parent))
    temporary = temporary_dir / output.name
    try:
        temporary.write_text(pretty_json(payload), encoding="utf-8", newline="")
        os.replace(temporary, output)
    finally:
        shutil.rmtree(temporary_dir, ignore_errors=True)


def build_result_manifest(
    cohort_path: Path,
    cohort: dict[str, Any],
    fixture_dir: Path,
    output: Path,
    result: dict[str, Any],
) -> dict[str, Any]:
    fixtures = []
    for raw_task in cohort["tasks"]:
        task = CommonsSearchTask.from_dict(raw_task)
        path = fixture_path(fixture_dir, task)
        if not path.exists():
            raise DiscoveryRunError(f"Missing Commons discovery fixture: {path}")
        fixtures.append({"panda_slug": task.panda_slug, **file_descriptor(path)})

    result_text = pretty_json(result).encode("utf-8")
    try:
        result_path = output.resolve().relative_to(REPO_ROOT).as_posix()
    except ValueError:
        result_path = output.resolve().as_posix()
    return {
        "schema_version": 1,
        "operation": "wikimedia-commons-media-discovery-result-manifest",
        "dataset_release_version": cohort["dataset_release_version"],
        "generated_at": cohort["generated_at"],
        "inputs": {
            "cohort": file_descriptor(cohort_path),
            "source_registry": file_descriptor(SOURCE_REGISTRY),
            "fixtures": fixtures,
        },
        "result": {
            "path": result_path,
            "bytes": len(result_text),
            "sha256": sha256_bytes(result_text),
            "task_count": result["task_count"],
            "candidate_count": result["candidate_count"],
            "review_ready_candidate_count": result["review_ready_candidate_count"],
        },
        "publication_write_targets": [],
    }


def build_result(
    cohort: dict[str, Any],
    *,
    fixture_dir: Path,
    live: bool,
    record_fixtures: bool,
) -> dict[str, Any]:
    registry = load_source_registry()
    interval = int(cohort["minimum_request_interval_seconds"])
    task_results: list[dict[str, Any]] = []
    candidates: list[dict[str, Any]] = []

    for index, raw_task in enumerate(cohort["tasks"]):
        task = CommonsSearchTask.from_dict(raw_task)
        if live:
            request_url, response = fetch_search(registry, task)
            if record_fixtures:
                fixture_dir.mkdir(parents=True, exist_ok=True)
                fixture_path(fixture_dir, task).write_text(
                    pretty_json(envelope_to_fixture(response)),
                    encoding="utf-8",
                    newline="",
                )
        else:
            path = fixture_path(fixture_dir, task)
            if not path.exists():
                raise DiscoveryRunError(f"Missing Commons discovery fixture: {path}")
            response = fixture_to_envelope(json.loads(path.read_text(encoding="utf-8")))
            request_url = response.requested_url

        parsed = parse_search_response(
            registry,
            task,
            response,
            request_url=request_url,
        )
        result = parsed.to_dict()
        task_results.append(result)
        candidates.extend(result["candidates"])
        if live and index + 1 < len(cohort["tasks"]):
            time.sleep(interval)

    candidates.sort(
        key=lambda item: (
            item["panda_slug"],
            -item["identity_confidence"],
            item["search_rank"],
            item["candidate_id"],
        )
    )
    candidate_ids = [item["candidate_id"] for item in candidates]
    if len(candidate_ids) != len(set(candidate_ids)):
        raise DiscoveryRunError("Commons discovery produced duplicate candidate IDs")

    return {
        "schema_version": 1,
        "operation": "wikimedia-commons-media-discovery-cohort",
        "outcome": "passed",
        "mode": "live" if live else "fixture",
        "cohort_id": cohort["cohort_id"],
        "dataset_release_version": cohort["dataset_release_version"],
        "generated_at": cohort["generated_at"],
        "task_count": len(task_results),
        "candidate_count": len(candidates),
        "high_identity_candidate_count": sum(
            item["identity_confidence"] >= 0.85 for item in candidates
        ),
        "open_rights_candidate_count": sum(
            item["rights_state"] in {"open_license", "public_domain"}
            for item in candidates
        ),
        "profile_image_candidate_count": sum(
            item["profile_image_eligible"] for item in candidates
        ),
        "review_ready_candidate_count": sum(
            item["identity_confidence"] >= 0.85
            and item["rights_state"] in {"open_license", "public_domain"}
            and item["profile_image_eligible"]
            for item in candidates
        ),
        "tasks": task_results,
        "candidates": candidates,
        "publication_write_targets": [],
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run bounded Wikimedia Commons media metadata discovery"
    )
    parser.add_argument("--cohort", type=Path, default=DEFAULT_COHORT)
    parser.add_argument("--fixture-dir", type=Path, default=DEFAULT_FIXTURE_DIR)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--manifest-output", type=Path, default=DEFAULT_MANIFEST_OUTPUT)
    parser.add_argument("--live", action="store_true")
    parser.add_argument("--record-fixtures", action="store_true")
    parser.add_argument("--check", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.record_fixtures and not args.live:
        raise DiscoveryRunError("--record-fixtures requires --live")
    cohort = load_cohort(args.cohort)
    result = build_result(
        cohort,
        fixture_dir=args.fixture_dir,
        live=args.live,
        record_fixtures=args.record_fixtures,
    )
    manifest = build_result_manifest(
        args.cohort,
        cohort,
        args.fixture_dir,
        args.output,
        result,
    )
    if args.check:
        if args.live:
            raise DiscoveryRunError("--check cannot use live network mode")
        output_matches = (
            args.output.exists()
            and args.output.read_text(encoding="utf-8") == pretty_json(result)
        )
        if not output_matches:
            raise DiscoveryRunError("Commons media discovery fixture result drifted")
        manifest_matches = (
            args.manifest_output.exists()
            and args.manifest_output.read_text(encoding="utf-8") == pretty_json(manifest)
        )
        if not manifest_matches:
            raise DiscoveryRunError("Commons media discovery result manifest drifted")
        print("OK: Commons media discovery fixture result is reproducible")
        return 0
    install_atomically(args.output, result)
    install_atomically(args.manifest_output, manifest)
    print(
        json.dumps(
            {
                "outcome": result["outcome"],
                "mode": result["mode"],
                "task_count": result["task_count"],
                "candidate_count": result["candidate_count"],
                "review_ready_candidate_count": result["review_ready_candidate_count"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
