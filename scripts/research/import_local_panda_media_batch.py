from __future__ import annotations

import argparse
import base64
import gzip
import json
from pathlib import Path
from typing import Any

from collect_local_panda_media import (
    DEFAULT_CANDIDATES,
    LocalMediaError,
    canonical_json,
    load_jsonl,
    validate_candidates,
)

ROOT = Path(__file__).resolve().parents[2]


class MediaBatchImportError(ValueError):
    """Raised when a local media candidate batch is malformed."""


def load_gzip_base64_jsonl(path: Path) -> list[dict[str, Any]]:
    encoded = path.read_text(encoding="ascii").strip()
    if not encoded:
        raise MediaBatchImportError("compressed media batch is empty")
    try:
        raw = gzip.decompress(base64.b64decode(encoded, validate=True)).decode("utf-8-sig")
    except (ValueError, OSError, UnicodeDecodeError) as error:
        raise MediaBatchImportError(f"invalid gzip+base64 media batch: {error}") from error

    rows: list[dict[str, Any]] = []
    for line_number, raw_line in enumerate(raw.splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            raise MediaBatchImportError(
                f"batch line {line_number}: invalid JSON: {error.msg}"
            ) from error
        if not isinstance(value, dict):
            raise MediaBatchImportError(f"batch line {line_number}: row must be an object")
        value["__line__"] = line_number
        rows.append(value)
    return rows


def strip_internal_fields(row: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in row.items() if not key.startswith("__")}


def merge_candidates(
    existing: list[dict[str, Any]],
    incoming: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], int, int]:
    ordered_ids: list[str] = []
    by_id: dict[str, dict[str, Any]] = {}
    asset_to_id: dict[str, str] = {}

    for row in existing:
        clean = strip_internal_fields(row)
        media_id = str(clean.get("media_id") or "")
        asset_url = str(clean.get("asset_url") or "")
        if not media_id:
            raise MediaBatchImportError("existing candidate is missing media_id")
        if media_id not in by_id:
            ordered_ids.append(media_id)
        by_id[media_id] = clean
        if asset_url:
            asset_to_id[asset_url] = media_id

    added = 0
    replaced = 0
    for row in incoming:
        clean = strip_internal_fields(row)
        media_id = str(clean.get("media_id") or "")
        asset_url = str(clean.get("asset_url") or "")
        existing_id = media_id if media_id in by_id else asset_to_id.get(asset_url)
        if existing_id:
            by_id[existing_id] = clean
            replaced += 1
            if media_id != existing_id:
                clean["media_id"] = existing_id
        else:
            ordered_ids.append(media_id)
            by_id[media_id] = clean
            added += 1
        if asset_url:
            asset_to_id[asset_url] = clean["media_id"]

    merged = [by_id[media_id] for media_id in ordered_ids]
    return merged, added, replaced


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "".join(canonical_json(strip_internal_fields(row)) + "\n" for row in rows),
        encoding="utf-8",
        newline="",
    )


def import_batch(batch_path: Path, output_path: Path = DEFAULT_CANDIDATES) -> dict[str, int]:
    incoming = load_gzip_base64_jsonl(batch_path)
    validate_candidates(incoming)
    existing = load_jsonl(output_path)
    merged, added, replaced = merge_candidates(existing, incoming)
    validate_candidates([{**row, "__line__": index} for index, row in enumerate(merged, start=1)])
    write_jsonl(output_path, merged)
    return {
        "incoming": len(incoming),
        "added": added,
        "replaced": replaced,
        "total": len(merged),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import a local panda media candidate batch.")
    parser.add_argument("--batch-gzip-base64", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=DEFAULT_CANDIDATES)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    batch_path = args.batch_gzip_base64
    if not batch_path.is_absolute():
        batch_path = ROOT / batch_path
    output_path = args.output
    if not output_path.is_absolute():
        output_path = ROOT / output_path
    try:
        summary = import_batch(batch_path, output_path)
    except (OSError, LocalMediaError, MediaBatchImportError) as error:
        print(f"Local panda media batch import failed: {error}")
        return 1

    print(
        "Local panda media batch import passed: "
        f"incoming={summary['incoming']}, added={summary['added']}, "
        f"replaced={summary['replaced']}, total={summary['total']}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
