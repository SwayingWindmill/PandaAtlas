from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_RELEASE = "2026.07.24.2"
DEFAULT_MEDIA_LIBRARY = REPO_ROOT / "data" / "media-library" / "releases"
DEFAULT_CURATION_DIR = REPO_ROOT / "data" / "curation" / "pandas"
DEFAULT_PUBLIC_RELEASES = REPO_ROOT / "data" / "public-releases"
DEFAULT_OUTPUT_DIR = REPO_ROOT / "data" / "media-library" / "discovery"
SOURCE_ID = "wikimedia-commons-action-api"
ADAPTER_ID = "wikimedia-commons-media-discovery"
FIRST_COHORT_SLUGS = (
    "mei-xiang",
    "tian-tian",
    "xiao-qi-ji",
    "bao-bao",
    "bei-bei",
)
REVIEWED_QUERY_CONTEXT = {
    "mei-xiang": "Smithsonian panda",
    "tian-tian": "Smithsonian panda",
    "xiao-qi-ji": "Smithsonian panda",
    "bao-bao": "Smithsonian panda",
    "bei-bei": "Smithsonian panda",
}


class DiscoveryQueueError(RuntimeError):
    pass


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def pretty_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n"


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_text(value: str) -> str:
    return sha256_bytes(value.encode("utf-8"))


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def task_id(panda_slug: str, query: str) -> str:
    identity = f"{SOURCE_ID}\0{ADAPTER_ID}\0{panda_slug}\0{query}"
    return f"commons-search-{sha256_text(identity)[:24]}"


def query_variants(slug: str, row: dict[str, str]) -> list[dict[str, str]]:
    name_en = row["name_en"].strip()
    name_zh = row["name_zh"].strip()
    reviewed_context = REVIEWED_QUERY_CONTEXT.get(slug, "giant panda")
    variants = [
        {
            "locale": "en",
            "query": f'"{name_en}" {reviewed_context}',
            "basis": (
                "canonical-english-name-with-reviewed-institution"
                if slug in REVIEWED_QUERY_CONTEXT
                else "canonical-english-name"
            ),
        }
    ]
    if name_zh:
        variants.append(
            {
                "locale": "zh",
                "query": f'"{name_zh}" 大熊猫',
                "basis": "canonical-chinese-name",
            }
        )
    return variants


def build(
    release_version: str = DEFAULT_RELEASE,
    media_library_root: Path = DEFAULT_MEDIA_LIBRARY,
    curation_dir: Path = DEFAULT_CURATION_DIR,
    public_releases: Path = DEFAULT_PUBLIC_RELEASES,
) -> dict[str, dict[str, Any]]:
    library_dir = media_library_root / release_version
    coverage = read_json(library_dir / "coverage.json")
    release_dir = public_releases / release_version
    release_manifest = read_json(release_dir / "manifest.json")
    api = read_json(release_dir / "api.json")
    panda_rows = read_csv(curation_dir / "pandas.csv")
    pandas_by_slug = {row["slug"]: row for row in panda_rows}
    public_slugs = {row["slug"] for row in api.get("pandas", [])}

    missing_records = [
        record for record in coverage["records"] if record["state"] == "needs-discovery"
    ]
    missing_slugs = {record["panda_slug"] for record in missing_records}
    if missing_slugs - pandas_by_slug.keys():
        raise DiscoveryQueueError("Media coverage references unknown curation panda slugs")

    tasks: list[dict[str, Any]] = []
    for slug in sorted(missing_slugs):
        row = pandas_by_slug[slug]
        priority = 0 if slug in public_slugs else 1
        for variant_index, variant in enumerate(query_variants(slug, row)):
            tasks.append(
                {
                    "task_id": task_id(slug, variant["query"]),
                    "panda_slug": slug,
                    "name_zh": row["name_zh"] or None,
                    "name_en": row["name_en"],
                    "source_id": SOURCE_ID,
                    "adapter_id": ADAPTER_ID,
                    "query": variant["query"],
                    "query_locale": variant["locale"],
                    "query_basis": variant["basis"],
                    "priority": priority,
                    "variant_order": variant_index,
                    "max_results": 5,
                    "namespace": 6,
                    "allow_continuation": False,
                    "download_original": False,
                    "state": "pending",
                }
            )
    tasks.sort(
        key=lambda item: (
            item["priority"],
            item["panda_slug"],
            item["variant_order"],
            item["task_id"],
        )
    )
    queue_identity = sha256_text(canonical_json(tasks))
    queue = {
        "schema_version": 1,
        "queue_id": f"commons-media-queue-{queue_identity}",
        "dataset_release_version": release_version,
        "generated_at": release_manifest["released_at"],
        "source_id": SOURCE_ID,
        "adapter_id": ADAPTER_ID,
        "policy": {
            "max_results_per_request": 5,
            "max_requests_per_minute": 6,
            "concurrency_per_host": 1,
            "allow_continuation": False,
            "original_image_download": False,
            "publication_write_targets": [],
        },
        "summary": {
            "pandas_needing_discovery": len(missing_slugs),
            "public_release_pandas_needing_discovery": len(missing_slugs & public_slugs),
            "task_count": len(tasks),
            "english_tasks": sum(task["query_locale"] == "en" for task in tasks),
            "chinese_tasks": sum(task["query_locale"] == "zh" for task in tasks),
        },
        "tasks": tasks,
    }

    task_by_slug: dict[str, dict[str, Any]] = {}
    for task in tasks:
        if task["query_locale"] == "en":
            task_by_slug[task["panda_slug"]] = task
    missing_cohort = [slug for slug in FIRST_COHORT_SLUGS if slug not in task_by_slug]
    if missing_cohort:
        raise DiscoveryQueueError(
            "First Commons cohort is not pending media discovery: " + ", ".join(missing_cohort)
        )
    cohort_tasks = [task_by_slug[slug] for slug in FIRST_COHORT_SLUGS]
    cohort = {
        "schema_version": 1,
        "cohort_id": "commons-first-public-five-2026-07-24",
        "dataset_release_version": release_version,
        "generated_at": release_manifest["released_at"],
        "queue_id": queue["queue_id"],
        "purpose": "bounded metadata-only discovery for five published profiles without media",
        "task_count": len(cohort_tasks),
        "minimum_request_interval_seconds": 10,
        "tasks": cohort_tasks,
        "publication_write_targets": [],
    }

    queue_text = pretty_json(queue)
    cohort_text = pretty_json(cohort)
    manifest = {
        "schema_version": 1,
        "dataset_release_version": release_version,
        "generated_at": release_manifest["released_at"],
        "inputs": {
            "media_coverage_sha256": sha256_bytes((library_dir / "coverage.json").read_bytes()),
            "curation_pandas_sha256": sha256_bytes((curation_dir / "pandas.csv").read_bytes()),
            "public_release_api_sha256": sha256_bytes((release_dir / "api.json").read_bytes()),
            "public_release_manifest_sha256": sha256_bytes(
                (release_dir / "manifest.json").read_bytes()
            ),
        },
        "files": {
            "commons-queue.json": {
                "bytes": len(queue_text.encode("utf-8")),
                "sha256": sha256_text(queue_text),
            },
            "commons-first-public-five.json": {
                "bytes": len(cohort_text.encode("utf-8")),
                "sha256": sha256_text(cohort_text),
            },
        },
    }
    return {"queue": queue, "cohort": cohort, "manifest": manifest}


def install_atomically(output_dir: Path, payloads: dict[str, dict[str, Any]]) -> None:
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(
        tempfile.mkdtemp(prefix=f"{output_dir.name}-build-", dir=output_dir.parent)
    )
    try:
        files = {
            "commons-queue.json": payloads["queue"],
            "commons-first-public-five.json": payloads["cohort"],
            "manifest.json": payloads["manifest"],
        }
        for filename, payload in files.items():
            (temporary / filename).write_text(pretty_json(payload), encoding="utf-8", newline="")
        if output_dir.exists():
            backup = output_dir.parent / f".{output_dir.name}-backup"
            if backup.exists():
                shutil.rmtree(backup)
            os.replace(output_dir, backup)
            try:
                os.replace(temporary, output_dir)
            except Exception:
                os.replace(backup, output_dir)
                raise
            shutil.rmtree(backup)
        else:
            os.replace(temporary, output_dir)
    finally:
        shutil.rmtree(temporary, ignore_errors=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the bounded Commons media search queue")
    parser.add_argument("--release", default=DEFAULT_RELEASE)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--check", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    payloads = build(args.release)
    if args.check:
        expected = {
            "commons-queue.json": payloads["queue"],
            "commons-first-public-five.json": payloads["cohort"],
            "manifest.json": payloads["manifest"],
        }
        for filename, payload in expected.items():
            path = args.output_dir / filename
            if not path.exists() or path.read_text(encoding="utf-8") != pretty_json(payload):
                raise DiscoveryQueueError(f"Commons media discovery queue drifted: {filename}")
        print("OK: Commons media discovery queue is reproducible")
        return 0
    install_atomically(args.output_dir, payloads)
    print(json.dumps(payloads["queue"]["summary"], ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
