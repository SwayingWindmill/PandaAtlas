from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import shutil
import tempfile
import warnings
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from PIL import Image, ImageOps
from PIL import __version__ as pillow_version
from validate_panda_curation import CURATION_DIR, validate_curation

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT_DIR = REPO_ROOT / ".media-work"
MEDIA_INBOX_NAME = "media-inbox"
MAX_ASSET_BYTES = 25 * 1024 * 1024
MAX_IMAGE_PIXELS = 80_000_000
DERIVATIVE_WIDTHS = (480, 1200)
ALLOWED_FORMATS = {
    "JPEG": ("jpg", "image/jpeg"),
    "PNG": ("png", "image/png"),
    "WEBP": ("webp", "image/webp"),
}
USER_AGENT = "PandaAtlasMediaProcessor/1.0"
SAFE_SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class MediaProcessingError(RuntimeError):
    pass


@dataclass(frozen=True)
class DecodedImage:
    image: Image.Image
    extension: str
    mime_type: str
    width: int
    height: int


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def read_approved_media(curation_dir: Path) -> list[dict[str, str]]:
    errors, _ = validate_curation(curation_dir)
    if errors:
        joined = "\n".join(f"- {error}" for error in errors)
        raise MediaProcessingError(f"Curation validation failed:\n{joined}")

    media_path = curation_dir / "media.csv"
    with media_path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [
            dict(row) for row in csv.DictReader(handle) if row.get("review_status") == "approved"
        ]


def _read_limited(response: Any, maximum_bytes: int) -> bytes:
    content_length = response.headers.get("Content-Length")
    if content_length and int(content_length) > maximum_bytes:
        raise MediaProcessingError(f"Remote asset exceeds {maximum_bytes} bytes before download")
    payload = response.read(maximum_bytes + 1)
    if len(payload) > maximum_bytes:
        raise MediaProcessingError(f"Asset exceeds {maximum_bytes} bytes")
    return payload


def load_asset(
    asset: str,
    curation_dir: Path,
    *,
    allow_network: bool,
    maximum_bytes: int = MAX_ASSET_BYTES,
) -> bytes:
    parsed = urlparse(asset)
    if parsed.scheme == "https":
        if not allow_network:
            raise MediaProcessingError(
                "Remote assets are disabled; rerun with --allow-network after rights review"
            )
        request = Request(asset, headers={"User-Agent": USER_AGENT})
        try:
            with urlopen(request, timeout=30) as response:  # noqa: S310 - HTTPS is enforced.
                final_url = urlparse(response.geturl())
                if final_url.scheme != "https":
                    raise MediaProcessingError("Remote asset redirected away from HTTPS")
                return _read_limited(response, maximum_bytes)
        except MediaProcessingError:
            raise
        except Exception as error:  # pragma: no cover - exact transport errors vary by platform.
            raise MediaProcessingError(f"Failed to download {asset}: {error}") from error

    if parsed.scheme:
        raise MediaProcessingError(f"Unsupported asset scheme: {parsed.scheme}")

    inbox = (curation_dir / MEDIA_INBOX_NAME).resolve()
    candidate = (curation_dir / asset).resolve()
    if inbox not in candidate.parents:
        raise MediaProcessingError(f"Local asset must be inside {MEDIA_INBOX_NAME}/: {asset}")
    if not candidate.is_file():
        raise MediaProcessingError(f"Local asset does not exist: {asset}")
    if candidate.stat().st_size > maximum_bytes:
        raise MediaProcessingError(f"Asset exceeds {maximum_bytes} bytes: {asset}")
    return candidate.read_bytes()


def decode_image(payload: bytes) -> DecodedImage:
    Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(payload)) as candidate:
                if (
                    getattr(candidate, "is_animated", False)
                    and getattr(candidate, "n_frames", 1) > 1
                ):
                    raise MediaProcessingError(
                        "Animated images are not accepted as panda profile photos"
                    )
                image_format = candidate.format
                if image_format not in ALLOWED_FORMATS:
                    raise MediaProcessingError(
                        f"Unsupported image format {image_format!r}; use JPEG, PNG, or WebP"
                    )
                candidate.verify()

            with Image.open(BytesIO(payload)) as candidate:
                candidate.load()
                corrected = ImageOps.exif_transpose(candidate)
                width, height = corrected.size
                if width <= 0 or height <= 0:
                    raise MediaProcessingError("Image dimensions must be positive")
                if width * height > MAX_IMAGE_PIXELS:
                    raise MediaProcessingError(
                        f"Image exceeds the {MAX_IMAGE_PIXELS}-pixel safety limit"
                    )
                normalized = corrected.convert("RGB")
                extension, mime_type = ALLOWED_FORMATS[image_format]
                return DecodedImage(
                    image=normalized.copy(),
                    extension=extension,
                    mime_type=mime_type,
                    width=width,
                    height=height,
                )
    except MediaProcessingError:
        raise
    except Exception as error:
        raise MediaProcessingError(f"Asset is not a valid supported image: {error}") from error


def media_id_for(row: dict[str, str], original_sha256: str) -> str:
    panda_slug = row["panda_slug"]
    if not SAFE_SLUG.fullmatch(panda_slug):
        raise MediaProcessingError(f"Unsafe panda slug for media paths: {panda_slug!r}")
    identity = "\0".join([panda_slug, row["source_url"], original_sha256]).encode("utf-8")
    suffix = hashlib.sha256(identity).hexdigest()[:16]
    return f"media-{row['panda_slug']}-{suffix}"


def write_derivative(
    image: Image.Image,
    output_path: Path,
    target_width: int,
) -> dict[str, Any]:
    width = min(target_width, image.width)
    height = max(1, round(image.height * width / image.width))
    derivative = image.resize((width, height), Image.Resampling.LANCZOS)
    derivative.save(output_path, format="WEBP", quality=82, method=6, exact=True)
    payload = output_path.read_bytes()
    return {
        "kind": f"width-{width}",
        "path": output_path.as_posix(),
        "sha256": sha256_bytes(payload),
        "mime_type": "image/webp",
        "width": width,
        "height": height,
        "bytes": len(payload),
    }


def process_media_row(
    row: dict[str, str],
    curation_dir: Path,
    build_dir: Path,
    *,
    allow_network: bool,
) -> dict[str, Any]:
    payload = load_asset(row["asset"], curation_dir, allow_network=allow_network)
    original_sha256 = sha256_bytes(payload)
    decoded = decode_image(payload)
    media_id = media_id_for(row, original_sha256)

    originals_dir = build_dir / "originals"
    derivatives_dir = build_dir / "derivatives"
    originals_dir.mkdir(parents=True, exist_ok=True)
    derivatives_dir.mkdir(parents=True, exist_ok=True)

    original_relative = Path("originals") / f"{media_id}.{decoded.extension}"
    original_path = build_dir / original_relative
    original_path.write_bytes(payload)

    derivative_widths = sorted({min(decoded.width, width) for width in DERIVATIVE_WIDTHS})
    derivatives = []
    for width in derivative_widths:
        relative_path = Path("derivatives") / f"{media_id}-w{width}.webp"
        derivative = write_derivative(decoded.image, build_dir / relative_path, width)
        derivative["path"] = relative_path.as_posix()
        derivatives.append(derivative)

    return {
        "media_id": media_id,
        "panda_slug": row["panda_slug"],
        "asset": row["asset"],
        "source_url": row["source_url"],
        "rights": row["rights"],
        "credit": row["credit"],
        "alt_zh": row["alt_zh"],
        "alt_en": row["alt_en"],
        "review_status": row["review_status"],
        "original": {
            "path": original_relative.as_posix(),
            "sha256": original_sha256,
            "mime_type": decoded.mime_type,
            "width": decoded.width,
            "height": decoded.height,
            "bytes": len(payload),
        },
        "derivatives": derivatives,
    }


def install_build_atomically(temporary_dir: Path, output_dir: Path) -> None:
    if not output_dir.exists():
        os.replace(temporary_dir, output_dir)
        return

    backup_container = Path(
        tempfile.mkdtemp(prefix=f".{output_dir.name}-backup-", dir=output_dir.parent)
    )
    backup_dir = backup_container / "previous"
    os.replace(output_dir, backup_dir)
    try:
        os.replace(temporary_dir, output_dir)
    except Exception as install_error:
        try:
            os.replace(backup_dir, output_dir)
        except Exception as restore_error:
            raise MediaProcessingError(
                f"Failed to install the new media build and restore the previous build; "
                f"backup remains at {backup_dir}"
            ) from restore_error
        shutil.rmtree(backup_container, ignore_errors=True)
        raise install_error
    shutil.rmtree(backup_container, ignore_errors=True)


def process_media(
    curation_dir: Path,
    output_dir: Path,
    *,
    allow_network: bool = False,
    force: bool = False,
) -> dict[str, Any]:
    curation_dir = curation_dir.resolve()
    output_dir = output_dir.resolve()
    if (
        output_dir == curation_dir
        or output_dir in curation_dir.parents
        or curation_dir in output_dir.parents
    ):
        raise MediaProcessingError("Output directory must not overlap the curation input directory")
    if output_dir.exists() and not force:
        raise MediaProcessingError(
            f"Output already exists and is immutable by default: {output_dir}"
        )

    output_dir.parent.mkdir(parents=True, exist_ok=True)
    temporary_dir = Path(
        tempfile.mkdtemp(prefix=f".{output_dir.name}-build-", dir=output_dir.parent)
    )
    try:
        rows = read_approved_media(curation_dir)
        records = [
            process_media_row(
                row,
                curation_dir,
                temporary_dir,
                allow_network=allow_network,
            )
            for row in rows
        ]
        records.sort(key=lambda item: (item["panda_slug"], item["media_id"]))
        manifest = {
            "schema_version": 1,
            "processor": {
                "name": "PandaAtlas panda media processor",
                "pillow_version": pillow_version,
                "derivative_widths": list(DERIVATIVE_WIDTHS),
                "derivative_format": "image/webp",
            },
            "record_count": len(records),
            "records": records,
        }
        (temporary_dir / "manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        install_build_atomically(temporary_dir, output_dir)
        return manifest
    except Exception:
        shutil.rmtree(temporary_dir, ignore_errors=True)
        raise


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Archive approved panda photos and generate controlled WebP derivatives."
    )
    parser.add_argument("--curation-dir", type=Path, default=CURATION_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument(
        "--allow-network",
        action="store_true",
        help="Allow approved HTTPS assets to be downloaded. Network access is off by default.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Replace an existing output directory instead of preserving it as immutable.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        manifest = process_media(
            args.curation_dir,
            args.output_dir,
            allow_network=args.allow_network,
            force=args.force,
        )
    except MediaProcessingError as error:
        print(f"ERROR: {error}")
        return 1
    print(
        f"OK: processed {manifest['record_count']} approved panda photo(s) into {args.output_dir}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
