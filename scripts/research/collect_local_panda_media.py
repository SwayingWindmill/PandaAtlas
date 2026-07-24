from __future__ import annotations

import argparse
import hashlib
import json
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, BinaryIO, Callable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

REPO_ROOT = Path(__file__).resolve().parents[2]
MEDIA_ROOT = REPO_ROOT / "data" / "local-panda-research" / "media"
DEFAULT_CANDIDATES = MEDIA_ROOT / "candidates.jsonl"
DEFAULT_INVENTORY = MEDIA_ROOT / "inventory.jsonl"
DEFAULT_FILES_DIR = MEDIA_ROOT / "files"
USER_AGENT = "PandaAtlasLocalResearch/0.1 (+https://github.com/SwayingWindmill/PandaAtlas)"
MAX_IMAGE_BYTES = 100 * 1024 * 1024

REQUIRED_FIELDS = {
    "media_id",
    "subject_id",
    "subject_label",
    "source_page_url",
    "asset_url",
    "credit",
    "description",
    "captured_at",
    "identity_confidence",
    "rights_label",
    "rights_state",
    "collection_priority",
    "local_filename",
    "discovered_at",
    "notes",
}


class LocalMediaError(RuntimeError):
    pass


@dataclass(frozen=True)
class DownloadResult:
    sha256: str
    bytes: int
    mime_type: str


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig") as handle:
        for line_number, raw_line in enumerate(handle, start=1):
            line = raw_line.strip()
            if not line:
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as error:
                raise LocalMediaError(f"{path}:{line_number}: invalid JSON: {error.msg}") from error
            if not isinstance(value, dict):
                raise LocalMediaError(f"{path}:{line_number}: each line must be an object")
            value["__line__"] = line_number
            rows.append(value)
    return rows


def _non_empty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def validate_candidates(rows: list[dict[str, Any]]) -> None:
    errors: list[str] = []
    seen_ids: set[str] = set()
    seen_filenames: set[str] = set()

    for row in rows:
        line = row.get("__line__", "?")
        missing = sorted(REQUIRED_FIELDS - row.keys())
        if missing:
            errors.append(f"line {line}: missing fields: {', '.join(missing)}")
            continue

        media_id = row["media_id"]
        if not _non_empty_string(media_id) or not media_id.startswith("local-media-"):
            errors.append(f"line {line}: media_id must use the local-media-* namespace")
        elif media_id in seen_ids:
            errors.append(f"line {line}: duplicate media_id: {media_id}")
        else:
            seen_ids.add(media_id)

        for field in (
            "subject_id",
            "subject_label",
            "credit",
            "description",
            "captured_at",
            "rights_label",
            "rights_state",
            "local_filename",
            "discovered_at",
            "notes",
        ):
            if not _non_empty_string(row[field]):
                errors.append(f"line {line}: {field} must be a non-empty string")

        for field in ("source_page_url", "asset_url"):
            if not _non_empty_string(row[field]) or not row[field].startswith("https://"):
                errors.append(f"line {line}: {field} must be an HTTPS URL")

        identity_confidence = row["identity_confidence"]
        if not isinstance(identity_confidence, (int, float)) or not 0 <= identity_confidence <= 1:
            errors.append(f"line {line}: identity_confidence must be between 0 and 1")

        priority = row["collection_priority"]
        if not isinstance(priority, int) or not 1 <= priority <= 5:
            errors.append(f"line {line}: collection_priority must be an integer from 1 to 5")

        filename = row["local_filename"]
        if _non_empty_string(filename):
            candidate_path = Path(filename)
            if candidate_path.name != filename or filename in {".", ".."}:
                errors.append(f"line {line}: local_filename must be a plain filename")
            elif filename in seen_filenames:
                errors.append(f"line {line}: duplicate local_filename: {filename}")
            else:
                seen_filenames.add(filename)

    if errors:
        raise LocalMediaError("\n".join(errors))


def sniff_mime_type(prefix: bytes) -> str | None:
    if prefix.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if prefix.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if prefix.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if len(prefix) >= 12 and prefix[:4] == b"RIFF" and prefix[8:12] == b"WEBP":
        return "image/webp"
    if prefix.startswith(b"II*\x00") or prefix.startswith(b"MM\x00*"):
        return "image/tiff"
    return None


def hash_file(path: Path) -> DownloadResult:
    digest = hashlib.sha256()
    byte_count = 0
    prefix = b""
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            if len(prefix) < 32:
                prefix += chunk[: 32 - len(prefix)]
            digest.update(chunk)
            byte_count += len(chunk)
    mime_type = sniff_mime_type(prefix)
    if mime_type is None:
        raise LocalMediaError(f"existing file is not a recognized image: {path}")
    return DownloadResult(digest.hexdigest(), byte_count, mime_type)


def _open_url(url: str) -> BinaryIO:
    request = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.2",
        },
        method="GET",
    )
    return urlopen(request, timeout=60)  # type: ignore[return-value]


def download_image(
    url: str,
    destination: Path,
    *,
    opener: Callable[[str], BinaryIO] = _open_url,
    max_bytes: int = MAX_IMAGE_BYTES,
) -> DownloadResult:
    destination.parent.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256()
    byte_count = 0
    prefix = b""

    fd, temporary_name = tempfile.mkstemp(
        prefix=f".{destination.name}.", suffix=".part", dir=destination.parent
    )
    os.close(fd)
    temporary_path = Path(temporary_name)
    try:
        with opener(url) as response, temporary_path.open("wb") as output:
            while chunk := response.read(1024 * 1024):
                byte_count += len(chunk)
                if byte_count > max_bytes:
                    raise LocalMediaError(
                        f"asset exceeds local safety limit of {max_bytes} bytes: {url}"
                    )
                if len(prefix) < 32:
                    prefix += chunk[: 32 - len(prefix)]
                digest.update(chunk)
                output.write(chunk)

        mime_type = sniff_mime_type(prefix)
        if mime_type is None:
            raise LocalMediaError(f"downloaded response is not a recognized image: {url}")
        temporary_path.replace(destination)
        return DownloadResult(digest.hexdigest(), byte_count, mime_type)
    finally:
        temporary_path.unlink(missing_ok=True)


def _display_path(path: Path) -> str:
    try:
        display = path.relative_to(REPO_ROOT)
    except ValueError:
        display = path
    return str(display).replace("\\", "/")


def inventory_entry(
    candidate: dict[str, Any],
    *,
    files_dir: Path,
    execute: bool,
    refresh: bool,
    opener: Callable[[str], BinaryIO] = _open_url,
) -> dict[str, Any]:
    destination = files_dir / candidate["local_filename"]
    status: str
    result: DownloadResult | None = None
    error_message: str | None = None

    try:
        if destination.exists() and not refresh:
            result = hash_file(destination)
            status = "present"
        elif execute:
            result = download_image(candidate["asset_url"], destination, opener=opener)
            status = "downloaded"
        else:
            status = "pending"
    except (HTTPError, URLError, TimeoutError, OSError, LocalMediaError) as error:
        status = "failed"
        error_message = str(error)

    entry = {
        key: value
        for key, value in candidate.items()
        if not key.startswith("__")
    }
    entry.update(
        {
            "collection_policy": "rights-recorded-not-gating",
            "local_path": _display_path(destination),
            "retrieval_status": status,
            "sha256": result.sha256 if result else None,
            "bytes": result.bytes if result else None,
            "mime_type": result.mime_type if result else None,
            "error": error_message,
        }
    )
    return entry


def write_inventory(path: Path, entries: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = "".join(canonical_json(entry) + "\n" for entry in sorted(entries, key=lambda x: x["media_id"]))
    path.write_text(payload, encoding="utf-8", newline="")


def collect(
    *,
    candidates_path: Path = DEFAULT_CANDIDATES,
    inventory_path: Path = DEFAULT_INVENTORY,
    files_dir: Path = DEFAULT_FILES_DIR,
    execute: bool = False,
    refresh: bool = False,
    opener: Callable[[str], BinaryIO] = _open_url,
) -> list[dict[str, Any]]:
    candidates = load_jsonl(candidates_path)
    validate_candidates(candidates)
    entries = [
        inventory_entry(
            candidate,
            files_dir=files_dir,
            execute=execute,
            refresh=refresh,
            opener=opener,
        )
        for candidate in sorted(
            candidates,
            key=lambda row: (row["collection_priority"], row["media_id"]),
        )
    ]
    write_inventory(inventory_path, entries)
    return entries


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Collect local-only panda images without using rights status as an ingestion gate."
    )
    parser.add_argument("--execute", action="store_true", help="Download missing image files.")
    parser.add_argument("--refresh", action="store_true", help="Redownload existing image files.")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Return a non-zero exit code when any individual asset cannot be downloaded.",
    )
    parser.add_argument("--candidates", type=Path, default=DEFAULT_CANDIDATES)
    parser.add_argument("--inventory", type=Path, default=DEFAULT_INVENTORY)
    parser.add_argument("--files-dir", type=Path, default=DEFAULT_FILES_DIR)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        entries = collect(
            candidates_path=args.candidates,
            inventory_path=args.inventory,
            files_dir=args.files_dir,
            execute=args.execute,
            refresh=args.refresh,
        )
    except LocalMediaError as error:
        print(f"Local panda media collection failed:\n{error}")
        return 1

    counts: dict[str, int] = {}
    total_bytes = 0
    for entry in entries:
        status = entry["retrieval_status"]
        counts[status] = counts.get(status, 0) + 1
        total_bytes += entry["bytes"] or 0
    count_text = ", ".join(f"{key}={counts[key]}" for key in sorted(counts))
    print(
        f"Local panda media inventory: {len(entries)} candidates; {count_text}; "
        f"stored_bytes={total_bytes}. Rights metadata was recorded but not used as a gate."
    )
    return 1 if args.strict and counts.get("failed") else 0


if __name__ == "__main__":
    raise SystemExit(main())
