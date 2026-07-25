from __future__ import annotations

import argparse
import base64
import gzip
import json
from pathlib import Path
from typing import Any, Iterable
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[2]
VAULT_DIR = ROOT / "data" / "local-panda-research"
SOURCES_PATH = VAULT_DIR / "sources.jsonl"
RECORDS_DIR = VAULT_DIR / "records"


class BatchImportError(ValueError):
    """Raised when a local research import batch is malformed."""


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


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
                raise BatchImportError(f"{path}:{line_number}: JSONL row must be an object")
            rows.append(value)
    return rows


def write_jsonl(path: Path, rows: Iterable[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "".join(canonical_json(row) + "\n" for row in rows),
        encoding="utf-8",
        newline="",
    )


def parse_batch_payload(payload: Any) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    if not isinstance(payload, dict):
        raise BatchImportError("batch root must be an object")
    sources = payload.get("sources")
    records = payload.get("records")
    if not isinstance(sources, list) or not all(isinstance(row, dict) for row in sources):
        raise BatchImportError("batch sources must be an array of objects")
    if not isinstance(records, list) or not all(isinstance(row, dict) for row in records):
        raise BatchImportError("batch records must be an array of objects")
    return sources, records


def load_batch(path: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    return parse_batch_payload(json.loads(path.read_text(encoding="utf-8-sig")))


def load_batch_url(url: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    if not url.startswith(("http://", "https://")):
        raise BatchImportError("batch URL must use HTTP or HTTPS")
    with urlopen(url, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8-sig"))
    return parse_batch_payload(payload)


def load_batch_gzip_base64(path: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    encoded = path.read_text(encoding="ascii").strip()
    if not encoded:
        raise BatchImportError("compressed batch file is empty")
    try:
        compressed = base64.b64decode(encoded, validate=True)
        payload = json.loads(gzip.decompress(compressed).decode("utf-8-sig"))
    except (ValueError, OSError, json.JSONDecodeError) as error:
        raise BatchImportError(f"invalid gzip+base64 batch: {error}") from error
    return parse_batch_payload(payload)


def normalize_records(records: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    normalized: list[dict[str, Any]] = []
    review_status_fixes = 0
    for source_row in records:
        row = dict(source_row)
        evidence_level = row.get("evidence_level")
        if evidence_level in {"secondary_lead", "inferred"} and row.get("review_status") == "captured":
            row["review_status"] = "needs_primary_source"
            review_status_fixes += 1
        row["publication_status"] = "local_only"
        normalized.append(row)
    return normalized, review_status_fixes


def merge_sources(existing: list[dict[str, Any]], incoming: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int, int]:
    ordered_ids: list[str] = []
    by_id: dict[str, dict[str, Any]] = {}
    for row in existing:
        source_id = str(row.get("source_id") or "")
        if not source_id:
            raise BatchImportError("existing source row is missing source_id")
        if source_id not in by_id:
            ordered_ids.append(source_id)
        by_id[source_id] = row

    added = 0
    replaced = 0
    for row in incoming:
        source_id = str(row.get("source_id") or "")
        if not source_id.startswith("src-"):
            raise BatchImportError(f"invalid incoming source_id: {source_id!r}")
        if source_id in by_id:
            replaced += 1
        else:
            added += 1
            ordered_ids.append(source_id)
        by_id[source_id] = row
    return [by_id[source_id] for source_id in ordered_ids], added, replaced


def ensure_unique_record_ids(records: list[dict[str, Any]]) -> None:
    seen: set[str] = set()
    duplicates: set[str] = set()
    for row in records:
        record_id = str(row.get("record_id") or "")
        if not record_id.startswith("lpr-"):
            raise BatchImportError(f"invalid record_id: {record_id!r}")
        if record_id in seen:
            duplicates.add(record_id)
        seen.add(record_id)
    if duplicates:
        raise BatchImportError(f"duplicate record IDs: {', '.join(sorted(duplicates))}")


def import_rows(
    incoming_sources: list[dict[str, Any]],
    incoming_records: list[dict[str, Any]],
    output_path: Path,
) -> dict[str, int]:
    normalized_records, review_status_fixes = normalize_records(incoming_records)
    ensure_unique_record_ids(normalized_records)

    existing_sources = load_jsonl(SOURCES_PATH)
    merged_sources, sources_added, sources_replaced = merge_sources(existing_sources, incoming_sources)
    write_jsonl(SOURCES_PATH, merged_sources)
    write_jsonl(output_path, normalized_records)

    return {
        "sources": len(incoming_sources),
        "sources_added": sources_added,
        "sources_replaced": sources_replaced,
        "records": len(normalized_records),
        "review_status_fixes": review_status_fixes,
    }


def import_batch(batch_path: Path, output_path: Path) -> dict[str, int]:
    return import_rows(*load_batch(batch_path), output_path)


def import_batch_url(batch_url: str, output_path: Path) -> dict[str, int]:
    return import_rows(*load_batch_url(batch_url), output_path)


def import_batch_gzip_base64(batch_path: Path, output_path: Path) -> dict[str, int]:
    return import_rows(*load_batch_gzip_base64(batch_path), output_path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import a local-only panda research batch.")
    location = parser.add_mutually_exclusive_group(required=True)
    location.add_argument("--batch", type=Path)
    location.add_argument("--batch-url")
    location.add_argument("--batch-gzip-base64", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    output_path = args.output if args.output.is_absolute() else ROOT / args.output
    try:
        if args.batch_url:
            summary = import_batch_url(args.batch_url, output_path)
        elif args.batch_gzip_base64:
            batch_path = (
                args.batch_gzip_base64
                if args.batch_gzip_base64.is_absolute()
                else ROOT / args.batch_gzip_base64
            )
            summary = import_batch_gzip_base64(batch_path, output_path)
        else:
            batch_path = args.batch if args.batch.is_absolute() else ROOT / args.batch
            summary = import_batch(batch_path, output_path)
    except (OSError, json.JSONDecodeError, BatchImportError) as error:
        print(f"Local panda research batch import failed: {error}")
        return 1

    print(
        "Local panda research batch import passed: "
        f"sources={summary['sources']} "
        f"(added={summary['sources_added']}, replaced={summary['sources_replaced']}), "
        f"records={summary['records']}, review_status_fixes={summary['review_status_fixes']}, "
        f"output={output_path}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
