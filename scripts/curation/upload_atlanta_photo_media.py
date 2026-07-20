from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
BATCH_VERSION = "2026.07.20.1"
BUCKET = "panda-atlas-media"
MANIFEST_PATH = REPO_ROOT / "data" / "reviewed-batches" / BATCH_VERSION / "media-manifest.json"
DERIVATIVE_DIR = REPO_ROOT / ".media-work" / "derivatives"
WRANGLER_CONFIG = REPO_ROOT / "services" / "worker-api" / "wrangler.jsonc"
CACHE_CONTROL = "public, max-age=31536000, immutable"


@dataclass(frozen=True)
class Upload:
    filename: str
    local_path: Path
    object_key: str
    sha256: str
    byte_size: int


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_uploads() -> list[Upload]:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    if manifest.get("batch_version") != BATCH_VERSION:
        raise ValueError("Media manifest batch version does not match the upload target")

    uploads: list[Upload] = []
    filenames: set[str] = set()
    for record in manifest.get("records", []):
        for derivative in record.get("derivatives", []):
            filename = derivative.get("filename")
            if not isinstance(filename, str) or not filename.endswith(".webp"):
                raise ValueError("Every derivative requires a WebP filename")
            if filename in filenames:
                raise ValueError(f"Duplicate derivative filename: {filename}")
            filenames.add(filename)
            path = DERIVATIVE_DIR / filename
            if not path.is_file():
                raise FileNotFoundError(
                    f"Missing generated derivative {path}; run process:panda-media first"
                )
            expected_size = derivative.get("bytes")
            expected_hash = derivative.get("sha256")
            if path.stat().st_size != expected_size:
                raise ValueError(f"Byte-size mismatch for {filename}")
            if file_sha256(path) != expected_hash:
                raise ValueError(f"SHA-256 mismatch for {filename}")
            uploads.append(
                Upload(
                    filename=filename,
                    local_path=path,
                    object_key=f"releases/{BATCH_VERSION}/{filename}",
                    sha256=expected_hash,
                    byte_size=expected_size,
                )
            )

    uploads.sort(key=lambda item: item.object_key)
    if len(uploads) != 6:
        raise ValueError(f"Expected six reviewed derivatives, found {len(uploads)}")
    return uploads


def npm_command() -> str:
    executable = "npm.cmd" if os.name == "nt" else "npm"
    resolved = shutil.which(executable)
    if not resolved:
        raise FileNotFoundError(f"Required command is unavailable: {executable}")
    return resolved


def wrangler_command(upload: Upload) -> list[str]:
    return [
        npm_command(),
        "exec",
        "wrangler",
        "--",
        "r2",
        "object",
        "put",
        f"{BUCKET}/{upload.object_key}",
        "--file",
        str(upload.local_path),
        "--content-type",
        "image/webp",
        "--cache-control",
        CACHE_CONTROL,
        "--remote",
        "--force",
        "--config",
        str(WRANGLER_CONFIG),
    ]


def wrangler_get_command(upload: Upload, destination: Path) -> list[str]:
    return [
        npm_command(),
        "exec",
        "wrangler",
        "--",
        "r2",
        "object",
        "get",
        f"{BUCKET}/{upload.object_key}",
        "--file",
        str(destination),
        "--remote",
        "--config",
        str(WRANGLER_CONFIG),
    ]


def verify_remote_uploads(uploads: list[Upload]) -> None:
    with tempfile.TemporaryDirectory(prefix="panda-atlas-r2-verify-") as temporary:
        directory = Path(temporary)
        for upload in uploads:
            destination = directory / upload.filename
            subprocess.run(
                wrangler_get_command(upload, destination),
                cwd=REPO_ROOT,
                check=True,
            )
            if destination.stat().st_size != upload.byte_size:
                raise ValueError(f"Remote byte-size mismatch for {upload.filename}")
            if file_sha256(destination) != upload.sha256:
                raise ValueError(f"Remote SHA-256 mismatch for {upload.filename}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verify and upload the reviewed Atlanta WebP derivatives to R2."
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Write the verified objects to remote R2. Without this flag, only verify and print.",
    )
    parser.add_argument(
        "--verify-remote",
        action="store_true",
        help="Fetch every remote object and verify its byte size and SHA-256.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    uploads = load_uploads()
    for upload in uploads:
        print(f"{upload.object_key} bytes={upload.byte_size} sha256={upload.sha256}")
        if args.execute:
            subprocess.run(wrangler_command(upload), cwd=REPO_ROOT, check=True)
    if args.verify_remote:
        verify_remote_uploads(uploads)
    actions = []
    if args.execute:
        actions.append("uploaded them to remote R2")
    if args.verify_remote:
        actions.append("verified the remote objects")
    detail = " and ".join(actions) if actions else "no remote writes"
    print(f"OK: verified {len(uploads)} derivative(s); {detail}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
