from __future__ import annotations

import argparse
import base64
import json
import sys
import time
from pathlib import Path
from typing import Any, BinaryIO, Callable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

REPO_ROOT = Path(__file__).resolve().parents[3]
API_ROOT = REPO_ROOT / "services" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.acquisition.models import ResponseEnvelope  # noqa: E402
from app.acquisition.source_registry import load_source_registry  # noqa: E402
from app.acquisition.wikimedia_media_discovery import (  # noqa: E402
    ADAPTER_ID,
    SOURCE_ID,
    CommonsSearchTask,
    build_search_url,
    parse_search_response,
)

DEFAULT_COHORT = (
    REPO_ROOT
    / "data"
    / "local-panda-research"
    / "media"
    / "discovery"
    / "commons-batch-001.json"
)
DEFAULT_OUTPUT = DEFAULT_COHORT.with_name("commons-batch-001-results.json")
DEFAULT_FIXTURE_DIR = DEFAULT_COHORT.parent / "fixtures" / "commons-batch-001"


class LocalCommonsDiscoveryError(RuntimeError):
    pass


def pretty_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n"


def load_cohort(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8-sig") as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict) or payload.get("schema_version") != 1:
        raise LocalCommonsDiscoveryError("Local Commons cohort must use schema_version 1")
    tasks = payload.get("tasks")
    if not isinstance(tasks, list) or not tasks:
        raise LocalCommonsDiscoveryError("Local Commons cohort must contain tasks")
    if payload.get("task_count") != len(tasks):
        raise LocalCommonsDiscoveryError("Local Commons cohort task_count drifted")
    if payload.get("publication_write_targets") != []:
        raise LocalCommonsDiscoveryError("Local Commons cohort cannot declare publication writes")
    return payload


def _open_url(request: Request, timeout: int) -> BinaryIO:
    return urlopen(request, timeout=timeout)  # type: ignore[return-value]


def fetch_with_urllib(
    task: CommonsSearchTask,
    *,
    opener: Callable[[Request, int], BinaryIO] = _open_url,
) -> tuple[str, ResponseEnvelope]:
    registry = load_source_registry()
    source = registry.get(SOURCE_ID)
    source.assert_live_fetch_allowed()
    source.assert_adapter_allowed(ADAPTER_ID)
    policy = source.request_policy
    if policy is None:
        raise LocalCommonsDiscoveryError("Wikimedia source has no reviewed request policy")

    request_url = build_search_url(source, task)
    source.validate_request_target(request_url, live=True)
    request = Request(
        request_url,
        headers={
            "User-Agent": policy.user_agent,
            "Accept": policy.accept,
        },
        method="GET",
    )
    with opener(request, policy.timeout_seconds) as response:
        body = response.read()
        final_url = str(response.geturl())
        status = int(getattr(response, "status", 200))
        headers = {str(key): str(value) for key, value in response.headers.items()}

    if final_url != request_url:
        raise LocalCommonsDiscoveryError("Wikimedia API redirected unexpectedly")
    if status == 429:
        raise LocalCommonsDiscoveryError("Wikimedia API rate limited the local batch")
    if status != 200:
        raise LocalCommonsDiscoveryError(f"Wikimedia API returned HTTP {status}")
    return request_url, ResponseEnvelope(
        requested_url=request_url,
        final_url=final_url,
        status=status,
        headers=headers,
        body=body,
    )


def fixture_payload(response: ResponseEnvelope) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "requested_url": response.requested_url,
        "final_url": response.final_url,
        "status": response.status,
        "headers": dict(sorted(response.headers.items(), key=lambda item: item[0].lower())),
        "body_base64": base64.b64encode(response.body).decode("ascii"),
    }


def run_batch(
    cohort: dict[str, Any],
    *,
    output_path: Path,
    fixture_dir: Path,
    fetcher: Callable[[CommonsSearchTask], tuple[str, ResponseEnvelope]] = fetch_with_urllib,
    sleeper: Callable[[float], None] = time.sleep,
) -> dict[str, Any]:
    registry = load_source_registry()
    interval = int(cohort["minimum_request_interval_seconds"])
    candidates: list[dict[str, Any]] = []
    task_results: list[dict[str, Any]] = []
    failures: list[dict[str, str]] = []
    fixture_dir.mkdir(parents=True, exist_ok=True)

    for index, raw_task in enumerate(cohort["tasks"]):
        task = CommonsSearchTask.from_dict(raw_task)
        try:
            request_url, response = fetcher(task)
            parsed = parse_search_response(
                registry,
                task,
                response,
                request_url=request_url,
            )
            result = parsed.to_dict()
            task_results.append(result)
            candidates.extend(result["candidates"])
            fixture_path = fixture_dir / f"{task.task_id}.json"
            fixture_path.write_text(
                pretty_json(fixture_payload(response)),
                encoding="utf-8",
                newline="",
            )
        except (HTTPError, URLError, TimeoutError, OSError, ValueError, LocalCommonsDiscoveryError) as error:
            failures.append(
                {
                    "task_id": task.task_id,
                    "panda_slug": task.panda_slug,
                    "query": task.query,
                    "error": str(error),
                }
            )
        if index + 1 < len(cohort["tasks"]):
            sleeper(interval)

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
        raise LocalCommonsDiscoveryError("Local Commons discovery produced duplicate candidate IDs")

    result = {
        "schema_version": 1,
        "operation": "local-wikimedia-commons-media-discovery",
        "outcome": "passed" if not failures else "partial",
        "mode": "live-urllib",
        "cohort_id": cohort["cohort_id"],
        "dataset_release_version": cohort["dataset_release_version"],
        "generated_at": cohort["generated_at"],
        "task_count": len(cohort["tasks"]),
        "completed_task_count": len(task_results),
        "failed_task_count": len(failures),
        "candidate_count": len(candidates),
        "tasks": task_results,
        "failures": failures,
        "candidates": candidates,
        "publication_write_targets": [],
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(pretty_json(result), encoding="utf-8", newline="")
    return result


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run a bounded local-only Wikimedia Commons discovery batch with urllib."
    )
    parser.add_argument("--cohort", type=Path, default=DEFAULT_COHORT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--fixture-dir", type=Path, default=DEFAULT_FIXTURE_DIR)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        cohort = load_cohort(args.cohort)
        result = run_batch(
            cohort,
            output_path=args.output,
            fixture_dir=args.fixture_dir,
        )
    except (OSError, json.JSONDecodeError, LocalCommonsDiscoveryError) as error:
        print(f"Local Commons discovery failed:\n{error}")
        return 1

    print(
        "Local Commons discovery completed: "
        f"outcome={result['outcome']}, tasks={result['task_count']}, "
        f"completed={result['completed_task_count']}, failed={result['failed_task_count']}, "
        f"candidates={result['candidate_count']}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
