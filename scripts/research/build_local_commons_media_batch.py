from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_QUEUE = REPO_ROOT / "data" / "media-library" / "discovery" / "commons-queue.json"
DEFAULT_CANDIDATES = REPO_ROOT / "data" / "local-panda-research" / "media" / "candidates.jsonl"
DEFAULT_DISCOVERY_DIR = REPO_ROOT / "data" / "local-panda-research" / "media" / "discovery"
DEFAULT_OUTPUT = DEFAULT_DISCOVERY_DIR / "commons-batch-001.json"


class LocalCommonsBatchError(RuntimeError):
    pass


def pretty_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n"


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8-sig") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise LocalCommonsBatchError(f"{path} must contain a JSON object")
    return value


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig") as handle:
        for line_number, raw_line in enumerate(handle, start=1):
            line = raw_line.strip()
            if not line:
                continue
            value = json.loads(line)
            if not isinstance(value, dict):
                raise LocalCommonsBatchError(f"{path}:{line_number} must be a JSON object")
            rows.append(value)
    return rows


def covered_subject_ids(candidates: list[dict[str, Any]]) -> set[str]:
    covered: set[str] = set()
    for row in candidates:
        subject_id = row.get("subject_id")
        if not isinstance(subject_id, str):
            continue
        if subject_id.startswith("group-") or subject_id.startswith("unresolved-"):
            continue
        covered.add(subject_id)
    return covered


def processed_task_ids(discovery_dir: Path = DEFAULT_DISCOVERY_DIR) -> set[str]:
    processed: set[str] = set()
    if not discovery_dir.exists():
        return processed
    for path in sorted(discovery_dir.glob("commons-batch-*-results.json")):
        payload = load_json(path)
        for result in payload.get("tasks") or []:
            if not isinstance(result, dict):
                continue
            task = result.get("task")
            if isinstance(task, dict) and isinstance(task.get("task_id"), str):
                processed.add(task["task_id"])
        for failure in payload.get("failures") or []:
            if isinstance(failure, dict) and isinstance(failure.get("task_id"), str):
                processed.add(failure["task_id"])
    return processed


def processed_queries(discovery_dir: Path = DEFAULT_DISCOVERY_DIR) -> set[str]:
    queries: set[str] = set()
    if not discovery_dir.exists():
        return queries
    for path in sorted(discovery_dir.glob("commons-batch-*-results.json")):
        payload = load_json(path)
        for result in payload.get("tasks") or []:
            if not isinstance(result, dict):
                continue
            task = result.get("task")
            if isinstance(task, dict) and isinstance(task.get("query"), str):
                queries.add(task["query"])
        for failure in payload.get("failures") or []:
            if isinstance(failure, dict) and isinstance(failure.get("query"), str):
                queries.add(failure["query"])
    return queries


def select_tasks(
    queue: dict[str, Any],
    *,
    covered_subjects: set[str],
    processed_tasks: set[str],
    processed_query_texts: set[str],
    task_limit: int,
) -> list[dict[str, Any]]:
    raw_tasks = queue.get("tasks")
    if not isinstance(raw_tasks, list):
        raise LocalCommonsBatchError("Commons queue has no tasks array")
    if task_limit < 1:
        raise LocalCommonsBatchError("task_limit must be positive")

    selected: list[dict[str, Any]] = []
    selected_slugs: set[str] = set()
    selected_queries: set[str] = set()
    ordered = sorted(
        (task for task in raw_tasks if isinstance(task, dict)),
        key=lambda task: (
            int(task.get("priority", 999)),
            int(task.get("variant_order", 999)),
            str(task.get("panda_slug") or ""),
            str(task.get("task_id") or ""),
        ),
    )
    for task in ordered:
        slug = str(task.get("panda_slug") or "").strip()
        task_id = str(task.get("task_id") or "").strip()
        query = str(task.get("query") or "").strip()
        if (
            not slug
            or not task_id
            or not query
            or task_id in processed_tasks
            or query in processed_query_texts
            or query in selected_queries
            or slug in covered_subjects
            or slug in selected_slugs
        ):
            continue
        selected.append(task)
        selected_slugs.add(slug)
        selected_queries.add(query)
        if len(selected) >= task_limit:
            break

    if not selected:
        raise LocalCommonsBatchError("No uncovered Commons tasks were available")
    return selected


def build_batch(
    *,
    queue_path: Path = DEFAULT_QUEUE,
    candidates_path: Path = DEFAULT_CANDIDATES,
    discovery_dir: Path = DEFAULT_DISCOVERY_DIR,
    output_path: Path = DEFAULT_OUTPUT,
    task_limit: int = 8,
    generated_at: str = "2026-07-25T00:00:00+09:00",
) -> dict[str, Any]:
    queue = load_json(queue_path)
    candidates = load_jsonl(candidates_path)
    covered = covered_subject_ids(candidates)
    processed = processed_task_ids(discovery_dir)
    seen_queries = processed_queries(discovery_dir)
    tasks = select_tasks(
        queue,
        covered_subjects=covered,
        processed_tasks=processed,
        processed_query_texts=seen_queries,
        task_limit=task_limit,
    )
    task_ids = "|".join(str(task.get("task_id") or "") for task in tasks)
    digest = hashlib.sha256(task_ids.encode("utf-8")).hexdigest()[:16]

    batch = {
        "schema_version": 1,
        "cohort_id": f"local-commons-batch-{digest}",
        "dataset_release_version": str(queue.get("dataset_release_version") or "local"),
        "generated_at": generated_at,
        "minimum_request_interval_seconds": 10,
        "publication_write_targets": [],
        "purpose": "bounded local-only image discovery without rights-state ingestion gates",
        "queue_id": str(queue.get("queue_id") or "unknown"),
        "task_count": len(tasks),
        "tasks": tasks,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(pretty_json(batch), encoding="utf-8", newline="")
    return batch


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Build the next bounded local Commons image batch.")
    parser.add_argument("--queue", type=Path, default=DEFAULT_QUEUE)
    parser.add_argument("--candidates", type=Path, default=DEFAULT_CANDIDATES)
    parser.add_argument("--discovery-dir", type=Path, default=DEFAULT_DISCOVERY_DIR)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--task-limit", type=int, default=8)
    parser.add_argument("--generated-at", default="2026-07-25T00:00:00+09:00")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        batch = build_batch(
            queue_path=args.queue,
            candidates_path=args.candidates,
            discovery_dir=args.discovery_dir,
            output_path=args.output,
            task_limit=args.task_limit,
            generated_at=args.generated_at,
        )
    except (OSError, json.JSONDecodeError, LocalCommonsBatchError) as error:
        print(f"Local Commons batch build failed:\n{error}")
        return 1

    print(
        "Local Commons batch built: "
        f"cohort={batch['cohort_id']}, tasks={batch['task_count']}, "
        f"output={args.output}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
