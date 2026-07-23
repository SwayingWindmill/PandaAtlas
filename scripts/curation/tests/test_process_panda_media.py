from __future__ import annotations

import csv
import hashlib
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

MODULE_PATH = Path(__file__).resolve().parents[1] / "process_panda_media.py"
sys.path.insert(0, str(MODULE_PATH.parent))
SPEC = importlib.util.spec_from_file_location("process_panda_media", MODULE_PATH)
assert SPEC and SPEC.loader
PROCESSOR = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = PROCESSOR
SPEC.loader.exec_module(PROCESSOR)

PANDA_FIELDS = [
    "slug",
    "name_zh",
    "name_en",
    "gender",
    "birth_date",
    "birth_date_precision",
    "birth_date_text",
    "death_date",
    "status",
    "birthplace",
    "current_location",
    "father_slug",
    "mother_slug",
    "intro",
    "tags",
    "is_featured",
    "primary_source_ids",
    "evidence_status",
    "review_status",
    "notes",
]
EVENT_FIELDS = [
    "event_id",
    "panda_slug",
    "event_type",
    "event_date",
    "event_date_precision",
    "location",
    "related_slugs",
    "source_ids",
    "evidence_status",
    "review_status",
    "notes",
]
MEDIA_FIELDS = [
    "panda_slug",
    "asset",
    "source_url",
    "rights",
    "credit",
    "alt_zh",
    "alt_en",
    "review_status",
    "notes",
]


def write_csv(path: Path, fields: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def panda_row(review_status: str = "approved") -> dict[str, str]:
    row = {field: "" for field in PANDA_FIELDS}
    row.update(
        {
            "slug": "test-panda",
            "name_zh": "测试熊猫",
            "name_en": "Test Panda",
            "gender": "female",
            "birth_date": "2020-01-02",
            "birth_date_precision": "day",
            "status": "alive",
            "current_location": "Test Institution",
            "intro": "A source-backed test panda.",
            "primary_source_ids": "src-official",
            "evidence_status": "verified",
            "review_status": review_status,
        }
    )
    return row


def event_row(index: int) -> dict[str, str]:
    row = {field: "" for field in EVENT_FIELDS}
    row.update(
        {
            "event_id": f"event-{index}",
            "panda_slug": "test-panda",
            "event_type": "milestone",
            "event_date": f"202{index}-01-02",
            "event_date_precision": "day",
            "source_ids": "src-official",
            "evidence_status": "verified",
            "review_status": "approved",
        }
    )
    return row


def media_row(
    *,
    asset: str = "media-inbox/test-panda.jpg",
    review_status: str = "approved",
) -> dict[str, str]:
    row = {field: "" for field in MEDIA_FIELDS}
    row.update(
        {
            "panda_slug": "test-panda",
            "asset": asset,
            "source_url": "https://commons.wikimedia.org/wiki/File:Test_Panda.jpg",
            "rights": "CC BY-SA 4.0",
            "credit": "Photo: Example Author / Wikimedia Commons",
            "alt_zh": "测试熊猫坐在竹子旁",
            "alt_en": "Test Panda sitting beside bamboo",
            "review_status": review_status,
        }
    )
    return row


class PandaMediaProcessorTests(unittest.TestCase):
    def make_curation(
        self,
        root: Path,
        *,
        asset: str = "media-inbox/test-panda.jpg",
        media_status: str = "approved",
        panda_status: str = "approved",
        valid_image: bool = True,
    ) -> Path:
        curation = root / "curation"
        inbox = curation / "media-inbox"
        inbox.mkdir(parents=True)
        write_csv(curation / "sources.csv", ["source_id"], [{"source_id": "src-official"}])
        write_csv(curation / "pandas.csv", PANDA_FIELDS, [panda_row(panda_status)])
        write_csv(curation / "events.csv", EVENT_FIELDS, [event_row(1), event_row(2), event_row(3)])
        write_csv(
            curation / "media.csv",
            MEDIA_FIELDS,
            [media_row(asset=asset, review_status=media_status)],
        )
        if asset.startswith("media-inbox/"):
            image_path = curation / asset
            image_path.parent.mkdir(parents=True, exist_ok=True)
            if valid_image:
                exif = Image.Exif()
                exif[315] = "Example Author"
                Image.new("RGB", (1600, 1000), (240, 240, 240)).save(
                    image_path,
                    format="JPEG",
                    exif=exif,
                )
            else:
                image_path.write_text("not an image", encoding="utf-8")
        return curation

    def test_processes_local_photo_and_generates_manifest_and_webp_derivatives(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            curation = self.make_curation(root)
            output = root / "processed"

            manifest = PROCESSOR.process_media(curation, output)

            self.assertEqual(manifest["record_count"], 1)
            record = manifest["records"][0]
            self.assertEqual(record["panda_slug"], "test-panda")
            original_path = output / record["original"]["path"]
            self.assertTrue(original_path.is_file())
            self.assertEqual(
                record["original"]["sha256"],
                hashlib.sha256(original_path.read_bytes()).hexdigest(),
            )
            self.assertEqual(record["original"]["width"], 1600)
            self.assertEqual(record["original"]["height"], 1000)
            with Image.open(original_path) as original:
                self.assertEqual(original.getexif().get(315), "Example Author")
            self.assertEqual([item["width"] for item in record["derivatives"]], [480, 1200])
            for derivative in record["derivatives"]:
                derivative_path = output / derivative["path"]
                self.assertTrue(derivative_path.is_file())
                with Image.open(derivative_path) as image:
                    self.assertEqual(image.format, "WEBP")
                    self.assertEqual(image.size, (derivative["width"], derivative["height"]))
                    self.assertEqual(len(image.getexif()), 0)
            on_disk = json.loads((output / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(on_disk, manifest)

    def test_output_is_immutable_unless_force_is_explicit(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            curation = self.make_curation(root)
            output = root / "processed"
            first_manifest = PROCESSOR.process_media(curation, output)

            with self.assertRaisesRegex(PROCESSOR.MediaProcessingError, "immutable by default"):
                PROCESSOR.process_media(curation, output)

            manifest = PROCESSOR.process_media(curation, output, force=True)
            self.assertEqual(manifest, first_manifest)
            self.assertEqual(list(root.glob(".processed-backup-*")), [])

    def test_failed_forced_rebuild_preserves_previous_output(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            curation = self.make_curation(root)
            output = root / "processed"
            PROCESSOR.process_media(curation, output)
            previous_manifest = (output / "manifest.json").read_bytes()
            (curation / "media-inbox" / "test-panda.jpg").write_text(
                "not an image",
                encoding="utf-8",
            )

            with self.assertRaises(PROCESSOR.MediaProcessingError):
                PROCESSOR.process_media(curation, output, force=True)

            self.assertEqual((output / "manifest.json").read_bytes(), previous_manifest)

    def test_remote_download_is_disabled_by_default(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            curation = self.make_curation(
                root,
                asset="https://upload.wikimedia.org/test-panda.jpg",
            )
            with self.assertRaisesRegex(
                PROCESSOR.MediaProcessingError, "Remote assets are disabled"
            ):
                PROCESSOR.process_media(curation, root / "processed")

    def test_local_path_must_stay_inside_media_inbox(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            outside = root / "outside.png"
            Image.new("RGB", (10, 10)).save(outside, format="PNG")
            curation = self.make_curation(root, asset="../outside.png")
            with self.assertRaisesRegex(
                PROCESSOR.MediaProcessingError, "must be inside media-inbox"
            ):
                PROCESSOR.process_media(curation, root / "processed")

    def test_output_directory_cannot_overlap_curation_input(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            curation = self.make_curation(root)
            with self.assertRaisesRegex(PROCESSOR.MediaProcessingError, "must not overlap"):
                PROCESSOR.process_media(curation, curation / "processed")

    def test_unsafe_panda_slug_cannot_enter_output_paths(self) -> None:
        with self.assertRaisesRegex(PROCESSOR.MediaProcessingError, "Unsafe panda slug"):
            PROCESSOR.media_id_for(
                {
                    "panda_slug": "../escape",
                    "source_url": "https://example.org/photo",
                },
                "0" * 64,
            )

    def test_invalid_image_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            curation = self.make_curation(root, valid_image=False)
            with self.assertRaisesRegex(
                PROCESSOR.MediaProcessingError, "not a valid supported image"
            ):
                PROCESSOR.process_media(curation, root / "processed")

    def test_can_filter_processing_to_requested_approved_panda_slugs(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            curation = self.make_curation(Path(temporary_directory))

            rows = PROCESSOR.read_processable_media(curation, {"test-panda"})

            self.assertEqual([row["panda_slug"] for row in rows], ["test-panda"])
            with self.assertRaisesRegex(
                PROCESSOR.MediaProcessingError,
                "No processable media row found",
            ):
                PROCESSOR.read_processable_media(curation, {"missing-panda"})

    def test_draft_media_is_not_processed(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            curation = self.make_curation(
                root,
                media_status="draft",
                panda_status="draft",
            )
            manifest = PROCESSOR.process_media(curation, root / "processed")
            self.assertEqual(manifest["record_count"], 0)
            self.assertEqual(manifest["records"], [])

    def test_processes_collection_only_media(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            curation = self.make_curation(
                root,
                media_status="collection_only",
                panda_status="reviewed",
            )
            manifest = PROCESSOR.process_media(
                curation,
                root / "processed",
            )
            self.assertEqual(manifest["record_count"], 1)
            self.assertEqual(
                manifest["record_count"],
                1,
            )


if __name__ == "__main__":
    unittest.main()
