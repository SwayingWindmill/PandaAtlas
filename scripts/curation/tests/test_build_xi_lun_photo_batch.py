from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from contextlib import contextmanager
from copy import deepcopy
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MODULE_PATH = REPO_ROOT / "scripts" / "curation" / "build_xi_lun_photo_batch.py"
SPEC = importlib.util.spec_from_file_location("build_xi_lun_photo_batch", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


@contextmanager
def patched_inputs(
    *,
    candidate: dict | None = None,
    integrity: dict | None = None,
    processor: dict | None = None,
    media_manifest: dict | None = None,
):
    original_paths = (
        MODULE.SOURCE_INTEGRITY_PATH,
        MODULE.PROCESSOR_MANIFEST_PATH,
        MODULE.MEDIA_MANIFEST_PATH,
    )
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        actual_candidate = candidate or MODULE.read_json(
            REPO_ROOT
            / "services"
            / "api"
            / "tests"
            / "acquisition"
            / "fixtures"
            / "commons-xi-lun-imageinfo.json"
        )
        actual_processor = processor or MODULE.read_json(MODULE.PROCESSOR_MANIFEST_PATH)
        actual_media = media_manifest or MODULE.read_json(MODULE.MEDIA_MANIFEST_PATH)
        actual_integrity = integrity or MODULE.read_json(MODULE.SOURCE_INTEGRITY_PATH)

        candidate_path = root / "candidate.json"
        processor_path = root / "processor.json"
        media_path = root / "media.json"
        integrity_path = root / "integrity.json"
        candidate_path.write_text(json.dumps(actual_candidate), encoding="utf-8")
        processor_path.write_text(json.dumps(actual_processor), encoding="utf-8")
        media_path.write_text(json.dumps(actual_media), encoding="utf-8")
        actual_integrity = deepcopy(actual_integrity)
        actual_integrity["candidate_fixture"] = str(candidate_path)
        actual_integrity["candidate_fixture_canonical_sha256"] = MODULE.canonical_json_sha256(
            actual_candidate
        )
        actual_integrity["processing_input"][
            "processor_manifest_canonical_sha256"
        ] = MODULE.canonical_json_sha256(actual_processor)
        integrity_path.write_text(json.dumps(actual_integrity), encoding="utf-8")

        MODULE.SOURCE_INTEGRITY_PATH = integrity_path
        MODULE.PROCESSOR_MANIFEST_PATH = processor_path
        MODULE.MEDIA_MANIFEST_PATH = media_path
        try:
            yield
        finally:
            (
                MODULE.SOURCE_INTEGRITY_PATH,
                MODULE.PROCESSOR_MANIFEST_PATH,
                MODULE.MEDIA_MANIFEST_PATH,
            ) = original_paths


class XiLunPhotoBatchTests(unittest.TestCase):
    def test_builds_fifteen_profile_release_with_complete_xi_lun(self) -> None:
        source = MODULE.build_source()
        self.assertEqual(source["dataset"]["version"], "2026.07.21.1")
        self.assertEqual(source["dataset"]["base_dataset_version"], "2026.07.20.2")
        self.assertEqual(source["dataset"]["core_panda_count"], 15)
        self.assertEqual(len(source["pandas"]), 15)

        panda = next(item for item in source["pandas"] if item["id"] == MODULE.PANDA_ID)
        self.assertEqual(panda["public"]["canonical_slug"], "xi-lun")
        self.assertEqual(
            {content["locale"] for content in panda["public"]["content"]},
            {"zh-CN", "en"},
        )
        current = [
            item
            for item in source["residencies"]
            if item["public"].get("panda_id") == MODULE.PANDA_ID
            and item["public"].get("end_date") is None
        ]
        self.assertEqual(len(current), 1)
        self.assertEqual(current[0]["public"]["last_verified_at"], "2026-07-20")
        events = [
            item
            for item in source["events"]
            if MODULE.PANDA_ID in item["public"].get("participants", [])
        ]
        self.assertEqual(len(events), 3)
        self.assertEqual(
            {item["public"]["event_type"] for item in events},
            {"birth", "public_debut", "transfer"},
        )
        parents = [
            item
            for item in source["parentage_assertions"]
            if item["public"].get("child_id") == MODULE.PANDA_ID
        ]
        self.assertEqual({item["public"]["role"] for item in parents}, {"father", "mother"})

    def test_media_is_exact_reviewed_webp_projection(self) -> None:
        source = MODULE.build_source()
        media = next(
            item for item in source["media"] if item["public"].get("panda_id") == MODULE.PANDA_ID
        )
        self.assertEqual(media["id"], MODULE.EXPECTED_MEDIA_ID)
        self.assertEqual(media["public"]["rights"], "CC BY-SA 4.0")
        self.assertEqual(media["public"]["credit"], "O01326 / Wikimedia Commons")
        self.assertEqual(media["public"]["status"], "available")
        self.assertEqual(
            {item["kind"] for item in media["public"]["derivatives"]},
            {"width-480", "width-1200"},
        )
        for derivative in media["public"]["derivatives"]:
            self.assertEqual(derivative["mime_type"], "image/webp")
            self.assertIn("2026.07.21.1", derivative["url"])
            self.assertNotIn("filename", derivative)

    def test_base_release_is_immutable_except_shared_return_participant(self) -> None:
        base = MODULE.read_json(MODULE.BASE_PATH)
        source = MODULE.build_source()
        for collection in (
            "sources",
            "facilities",
            "institutions",
            "places",
            "pandas",
            "facts",
            "residencies",
            "parentage_assertions",
            "media",
        ):
            current = {item["id"]: item for item in source[collection]}
            for item in base[collection]:
                self.assertEqual(current[item["id"]], item, f"{collection}:{item['id']}")
        shared = next(
            item for item in source["events"] if item["id"] == "event-zoo-atlanta-return-2024"
        )
        self.assertIn(MODULE.PANDA_ID, shared["public"]["participants"])

    def test_build_is_deterministic(self) -> None:
        first = MODULE.render_source(MODULE.build_source())
        second = MODULE.render_source(MODULE.build_source())
        self.assertEqual(first, second)

    def test_candidate_identity_drift_fails_closed(self) -> None:
        candidate = MODULE.read_json(
            REPO_ROOT
            / "services"
            / "api"
            / "tests"
            / "acquisition"
            / "fixtures"
            / "commons-xi-lun-imageinfo.json"
        )
        candidate["query"]["pages"][0]["title"] = "File:Ya Lun at Zoo Atlanta.jpg"
        with patched_inputs(candidate=candidate):
            with self.assertRaisesRegex(ValueError, "candidate title drifted"):
                MODULE.validate_reviewed_inputs()

    def test_processing_input_integrity_drift_fails_closed(self) -> None:
        processor = deepcopy(MODULE.read_json(MODULE.PROCESSOR_MANIFEST_PATH))
        processor["records"][0]["original"]["sha256"] = "0" * 64
        with patched_inputs(processor=processor):
            with self.assertRaisesRegex(ValueError, "processing input sha256 drifted"):
                MODULE.validate_reviewed_inputs()

    def test_derivative_integrity_drift_fails_closed(self) -> None:
        manifest = deepcopy(MODULE.read_json(MODULE.MEDIA_MANIFEST_PATH))
        manifest["records"][0]["derivatives"][0]["sha256"] = "f" * 64
        with patched_inputs(media_manifest=manifest):
            with self.assertRaisesRegex(ValueError, "derivative width-480 field sha256 drifted"):
                MODULE.validate_reviewed_inputs()

    def test_original_download_and_thumbnail_policy_are_bound(self) -> None:
        integrity = deepcopy(MODULE.read_json(MODULE.SOURCE_INTEGRITY_PATH))
        integrity["review"]["original_image_downloaded"] = True
        with patched_inputs(integrity=integrity):
            with self.assertRaisesRegex(ValueError, "source review state drifted"):
                MODULE.validate_reviewed_inputs()


if __name__ == "__main__":
    unittest.main()
