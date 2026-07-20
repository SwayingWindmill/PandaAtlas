from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
MODULE_PATH = ROOT / "scripts" / "curation" / "upload_atlanta_photo_media.py"
SPEC = importlib.util.spec_from_file_location("upload_atlanta_photo_media", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


class AtlantaPhotoUploadTests(unittest.TestCase):
    def fixture(self, root: Path) -> tuple[Path, Path]:
        derivative_dir = root / "derivatives"
        derivative_dir.mkdir()
        derivatives = []
        for index in range(6):
            filename = f"media-test-{index:02d}-w{480 if index % 2 == 0 else 1200}.webp"
            content = f"webp-{index}".encode()
            (derivative_dir / filename).write_bytes(content)
            derivatives.append(
                {
                    "kind": "width-480" if index % 2 == 0 else "width-1200",
                    "filename": filename,
                    "sha256": sha256(content),
                    "mime_type": "image/webp",
                    "width": 480 if index % 2 == 0 else 1200,
                    "height": 320 if index % 2 == 0 else 800,
                    "bytes": len(content),
                }
            )
        manifest_path = root / "media-manifest.json"
        manifest_path.write_text(
            json.dumps(
                {
                    "batch_version": MODULE.BATCH_VERSION,
                    "records": [{"panda_slug": "test", "derivatives": derivatives}],
                }
            ),
            encoding="utf-8",
        )
        return manifest_path, derivative_dir

    def test_load_uploads_verifies_six_deterministic_derivatives(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            manifest_path, derivative_dir = self.fixture(Path(temporary))
            with (
                patch.object(MODULE, "MANIFEST_PATH", manifest_path),
                patch.object(MODULE, "DERIVATIVE_DIR", derivative_dir),
            ):
                uploads = MODULE.load_uploads()

        self.assertEqual(len(uploads), 6)
        self.assertEqual(
            [upload.object_key for upload in uploads],
            sorted(upload.object_key for upload in uploads),
        )
        self.assertTrue(
            all(
                upload.object_key.startswith(f"releases/{MODULE.BATCH_VERSION}/media-test-")
                for upload in uploads
            )
        )

    def test_load_uploads_rejects_tampered_derivative(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            manifest_path, derivative_dir = self.fixture(Path(temporary))
            target = next(derivative_dir.iterdir())
            target.write_bytes(b"tampered")
            with (
                patch.object(MODULE, "MANIFEST_PATH", manifest_path),
                patch.object(MODULE, "DERIVATIVE_DIR", derivative_dir),
                self.assertRaisesRegex(ValueError, "mismatch"),
            ):
                MODULE.load_uploads()

    def test_wrangler_commands_are_remote_and_immutable(self) -> None:
        upload = MODULE.Upload(
            filename="media-test-w480.webp",
            local_path=Path("media-test-w480.webp"),
            object_key=f"releases/{MODULE.BATCH_VERSION}/media-test-w480.webp",
            sha256="a" * 64,
            byte_size=1,
        )
        with patch.object(MODULE, "npm_command", return_value="npm"):
            put_command = MODULE.wrangler_command(upload)
            get_command = MODULE.wrangler_get_command(upload, Path("download.webp"))

        self.assertIn("--remote", put_command)
        self.assertIn("--force", put_command)
        self.assertIn("image/webp", put_command)
        self.assertIn(MODULE.CACHE_CONTROL, put_command)
        self.assertIn(str(MODULE.WRANGLER_CONFIG), put_command)
        self.assertIn(f"{MODULE.BUCKET}/{upload.object_key}", put_command)
        self.assertIn("--remote", get_command)
        self.assertIn("download.webp", get_command)
        self.assertIn(f"{MODULE.BUCKET}/{upload.object_key}", get_command)


if __name__ == "__main__":
    unittest.main()
