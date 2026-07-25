from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[3]
MODULE_PATH = ROOT / "scripts" / "research" / "import_local_panda_media_candidates.py"
SPEC = importlib.util.spec_from_file_location("import_local_panda_media_candidates", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class LocalPandaMediaCandidateImportTests(unittest.TestCase):
    def test_restricted_candidate_is_imported(self) -> None:
        source = {
            "candidate_id": "media-candidate-example",
            "panda_slug": "example-panda",
            "asset_url": "https://example.test/example.jpg",
            "source_url": "https://example.test/source",
            "credit": "Example credit",
            "rights_label": "All rights reserved",
            "rights_state": "restricted",
            "identity_confidence": 0.8,
            "review_state": "collection_only",
            "alt_en": "Example panda image.",
            "captured_at": None,
        }

        candidate = MODULE.candidate_from_release(
            source,
            labels={"example-panda": "Example Panda"},
            release_version="2026.07.24.3",
            discovered_at="2026-07-25",
        )

        self.assertEqual(candidate["rights_state"], "restricted")
        self.assertEqual(candidate["collection_priority"], 2)
        self.assertEqual(candidate["captured_at"], "unknown")
        self.assertIn("never gates local ingestion", candidate["notes"])

    def test_duplicate_asset_url_is_not_added_twice(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            release_dir = root / "release"
            release_dir.mkdir()
            output = root / "candidates.jsonl"
            asset_url = "https://example.test/example.jpg"
            output.write_text(
                json.dumps(
                    {
                        "media_id": "local-media-existing",
                        "asset_url": asset_url,
                    }
                )
                + "\n",
                encoding="utf-8",
            )
            (release_dir / "candidates.json").write_text(
                json.dumps(
                    {
                        "dataset_release_version": "test-release",
                        "candidates": [
                            {
                                "candidate_id": "media-candidate-example",
                                "panda_slug": "example-panda",
                                "asset_url": asset_url,
                                "source_url": "https://example.test/source",
                                "credit": "Example credit",
                                "rights_label": "restricted",
                                "rights_state": "restricted",
                                "identity_confidence": 0.8,
                                "review_state": "collection_only",
                                "alt_en": "Example panda image.",
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )

            original_loader = MODULE.load_panda_labels
            MODULE.load_panda_labels = lambda: {"example-panda": "Example Panda"}
            try:
                summary = MODULE.import_release_candidates(
                    release_dir=release_dir,
                    output_path=output,
                    discovered_at="2026-07-25",
                )
            finally:
                MODULE.load_panda_labels = original_loader

            self.assertEqual(summary["added_candidates"], 0)
            self.assertEqual(summary["skipped_duplicates"], 1)
            self.assertEqual(summary["total_candidates"], 1)

    def test_latest_release_can_be_resolved(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "2026.07.24.2").mkdir()
            latest = root / "2026.07.24.3"
            latest.mkdir()

            self.assertEqual(MODULE.latest_release_dir(root), latest)

    def test_commons_subject_resolution_uses_description_not_search_target(self) -> None:
        source = {
            "panda_slug": "bao-bao",
            "file_title": "File:Mei Xiang portrait.jpg",
            "description": "Giant panda Mei Xiang at the Smithsonian National Zoo.",
            "categories": ["Mei Xiang (panda)"],
        }
        alias_index = {
            "bao bao": {"bao-bao"},
            "mei xiang": {"mei-xiang"},
        }

        self.assertEqual(
            MODULE.resolve_commons_subjects(source, alias_index=alias_index),
            ["mei-xiang"],
        )

    def test_short_aliases_require_word_boundaries(self) -> None:
        source = {
            "file_title": "File:Sri Lankan Fresh Fruit.jpg",
            "description": "Fresh fruit photography.",
            "categories": [],
        }
        alias_index = {
            "pan": {"pan-bronx"},
            "po": {"po-madrid"},
            "rio": {"rio-indonesia"},
        }

        self.assertEqual(
            MODULE.resolve_commons_subjects(source, alias_index=alias_index),
            [],
        )

    def test_title_and_description_names_override_category_group_names(self) -> None:
        source = {
            "file_title": "File:Ding Ding the panda.jpg",
            "description": "Ding Ding the panda at Moscow Zoo.",
            "categories": ["Ru Yi and Ding Ding"],
        }

        self.assertEqual(
            MODULE.resolve_commons_subjects(
                source,
                alias_index={
                    "ding ding": {"ding-ding"},
                    "ru yi": {"ru-yi"},
                },
            ),
            ["ding-ding"],
        )

    def test_common_word_alias_requires_explicit_name_context(self) -> None:
        generic = {
            "file_title": "File:A Happy Panda.jpg",
            "description": "",
            "categories": ["Ailuropoda melanoleuca"],
        }
        explicit = {
            "file_title": "File:Happy the panda.jpg",
            "description": "Happy the panda at the zoo.",
            "categories": [],
        }

        self.assertEqual(
            MODULE.resolve_commons_subjects(
                generic,
                alias_index={"happy": {"happy-st-louis"}},
            ),
            [],
        )
        self.assertEqual(
            MODULE.resolve_commons_subjects(
                explicit,
                alias_index={"happy": {"happy-st-louis"}},
            ),
            ["happy-st-louis"],
        )

    def test_irrelevant_image_without_panda_signal_is_skipped(self) -> None:
        source = {
            "mime": "image/jpeg",
            "candidate_id": "commons-candidate-fruit",
            "original_url": "https://example.test/fruit.jpg",
            "description_url": "https://example.test/source",
            "file_title": "File:Sri Lankan Fresh Fruit.jpg",
            "description": "Sri Lankan fresh fruit.",
            "categories": [],
        }

        self.assertIsNone(
            MODULE.candidate_from_commons_discovery(
                source,
                labels={},
                alias_index={"pan": {"pan-bronx"}},
                discovered_at="2026-07-25",
            )
        )

    def test_kung_fu_panda_merchandise_is_skipped(self) -> None:
        source = {
            "mime": "image/jpeg",
            "candidate_id": "commons-candidate-fictional-a-bao",
            "original_url": "https://example.test/a-bao.jpg",
            "description_url": "https://example.test/source",
            "file_title": "北京环球影城阿宝纪念品.jpg",
            "description": "北京环球影城功夫熊猫阿宝纪念品",
            "categories": [],
        }

        self.assertIsNone(
            MODULE.candidate_from_commons_discovery(
                source,
                labels={"a-bao": "A Bao"},
                alias_index={"阿宝": {"a-bao"}},
                discovered_at="2026-07-25",
            )
        )

    def test_panda_habitat_entry_sign_is_skipped(self) -> None:
        source = {
            "mime": "image/png",
            "candidate_id": "commons-candidate-entry-sign",
            "original_url": "https://example.test/entry.png",
            "description_url": "https://example.test/source",
            "file_title": "File:HKOP ST Entry.png",
            "description": "Hong Kong Jockey Club Sichuan Treasures",
            "categories": ["Giant Panda Habitat, Ocean Park, Hong Kong"],
        }

        self.assertIsNone(
            MODULE.candidate_from_commons_discovery(
                source,
                labels={},
                alias_index={},
                discovered_at="2026-07-25",
            )
        )

    def test_location_hints_disambiguate_same_name_pandas(self) -> None:
        source = {
            "file_title": "File:Grosser Panda Bao Bao Berlin.jpg",
            "description": "Bao Bao was a male giant panda living at Berlin Zoo.",
            "categories": ["Bao Bao (panda)"],
        }

        subjects = MODULE.resolve_commons_subjects(
            source,
            alias_index={
                "bao bao": {
                    "bao-bao",
                    "bao-bao-beijing-unknown",
                    "bao-bao-berlin",
                }
            },
        )
        resolved = MODULE.disambiguate_commons_subjects(
            source,
            subjects,
            identity_hints={
                "bao-bao": {"smithsonian", "wolong"},
                "bao-bao-beijing-unknown": {"beijing"},
                "bao-bao-berlin": {"berlin"},
            },
        )

        self.assertEqual(resolved, ["bao-bao-berlin"])

    def test_location_hints_keep_multiple_named_group_members(self) -> None:
        source = {
            "file_title": "File:Madrid panda twins.jpg",
            "description": "Giant panda twins Po and De De at Madrid Zoo Aquarium.",
            "categories": [],
        }

        resolved = MODULE.disambiguate_commons_subjects(
            source,
            ["de-de", "de-de-chengdu-2010", "de-de-madrid", "po-madrid"],
            identity_hints={
                "de-de": {"hong", "kong", "ocean"},
                "de-de-chengdu-2010": {"chengdu"},
                "de-de-madrid": {"madrid", "aquarium"},
                "po-madrid": {"madrid", "aquarium"},
            },
        )

        self.assertEqual(resolved, ["de-de-madrid", "po-madrid"])

    def test_relationships_disambiguate_parent_and_child_group(self) -> None:
        source = {
            "file_title": "File:Yang Yang und Fu Long.jpg",
            "description": "Panda mother and cub.",
            "categories": [],
        }

        resolved = MODULE.disambiguate_commons_subjects(
            source,
            ["fu-long", "yang-yang", "yang-yang-vienna", "yang-yang-yaan-2001"],
            identity_hints={},
            relationships={
                "fu-long": {"yang-yang-vienna"},
                "yang-yang-vienna": {"fu-long"},
                "yang-yang": set(),
                "yang-yang-yaan-2001": set(),
            },
        )

        self.assertEqual(resolved, ["fu-long", "yang-yang-vienna"])

    def test_search_target_does_not_override_location_evidence(self) -> None:
        source = {
            "mime": "image/jpeg",
            "candidate_id": "commons-candidate-berlin-bao-bao",
            "original_url": "https://example.test/berlin-bao-bao.jpg",
            "description_url": "https://example.test/source",
            "file_title": "File:Bao Bao Berlin.jpg",
            "description": "Bao Bao was a male giant panda living at Berlin Zoo.",
            "categories": ["Bao Bao (panda)"],
            "panda_slug": "bao-bao-beijing-unknown",
            "identity_confidence": 0.95,
        }

        candidate = MODULE.candidate_from_commons_discovery(
            source,
            labels={"bao-bao-berlin": "Bao Bao"},
            alias_index={
                "bao bao": {
                    "bao-bao",
                    "bao-bao-beijing-unknown",
                    "bao-bao-berlin",
                }
            },
            identity_hints={
                "bao-bao": {"smithsonian"},
                "bao-bao-beijing-unknown": {"beijing"},
                "bao-bao-berlin": {"berlin"},
            },
            discovered_at="2026-07-25",
        )

        self.assertIsNotNone(candidate)
        assert candidate is not None
        self.assertEqual(candidate["subject_id"], "bao-bao-berlin")

    def test_taxidermied_panda_is_skipped(self) -> None:
        source = {
            "mime": "image/jpeg",
            "candidate_id": "commons-candidate-taxidermied",
            "original_url": "https://example.test/taxidermied.jpg",
            "description_url": "https://example.test/source",
            "file_title": "File:Bao Bao the panda taxidermied.jpg",
            "description": "Bao Bao at the Natural History Museum Berlin.",
            "categories": ["Bao Bao (panda)"],
        }

        self.assertIsNone(
            MODULE.candidate_from_commons_discovery(
                source,
                labels={},
                alias_index={"bao bao": {"bao-bao-berlin"}},
                identity_hints={"bao-bao-berlin": {"berlin"}},
                discovered_at="2026-07-25",
            )
        )

    def test_named_panda_bone_exhibit_is_skipped(self) -> None:
        source = {
            "mime": "image/jpeg",
            "candidate_id": "commons-candidate-bone",
            "original_url": "https://example.test/bone.jpg",
            "description_url": "https://example.test/source",
            "file_title": "File:Giant panda Left hand Bone.jpg",
            "description": "Bone of the left forelimb of giant panda Fei Fei.",
            "categories": ["Fei Fei (panda)"],
        }

        self.assertIsNone(
            MODULE.candidate_from_commons_discovery(
                source,
                labels={"fei-fei-ueno": "Fei Fei"},
                alias_index={"fei fei": {"fei-fei-ueno"}},
                discovered_at="2026-07-25",
            )
        )

    def test_named_specimen_image_is_skipped(self) -> None:
        source = {
            "mime": "image/jpeg",
            "candidate_id": "commons-candidate-specimen",
            "original_url": "https://example.test/specimen.jpg",
            "description_url": "https://example.test/source",
            "file_title": "File:Giant panda Chu Chu Specimen.jpg",
            "description": "Specimen of giant panda baby Chu Chu.",
            "categories": ["Chu Chu (panda)"],
        }

        self.assertIsNone(
            MODULE.candidate_from_commons_discovery(
                source,
                labels={"chu-chu-ueno": "Chu Chu"},
                alias_index={"chu chu": {"chu-chu-ueno"}},
                discovered_at="2026-07-25",
            )
        )

    def test_natural_history_museum_specimen_is_skipped(self) -> None:
        source = {
            "mime": "image/jpeg",
            "candidate_id": "commons-candidate-museum-specimen",
            "original_url": "https://example.test/museum.jpg",
            "description_url": "https://example.test/source",
            "file_title": "File:London Zoo giant panda Chi-Chi.jpg",
            "description": "Natural History Museum, London, England, UK.",
            "categories": ["Chi Chi (panda)"],
        }

        self.assertIsNone(
            MODULE.candidate_from_commons_discovery(
                source,
                labels={"chi-chi": "Chi Chi"},
                alias_index={"chi chi": {"chi-chi"}},
                identity_hints={"chi-chi": {"london"}},
                discovered_at="2026-07-25",
            )
        )

    def test_panda_sculpture_is_skipped(self) -> None:
        source = {
            "mime": "image/jpeg",
            "candidate_id": "commons-candidate-sculpture",
            "original_url": "https://example.test/sculpture.jpg",
            "description_url": "https://example.test/source",
            "file_title": "File:Hehe Xiexie Montreal.jpg",
            "description": "Panda bears He He and Xie Xie in an open-air museum.",
            "categories": ["Panda sculptures"],
        }

        self.assertIsNone(
            MODULE.candidate_from_commons_discovery(
                source,
                labels={"he-he-hongshan": "He He"},
                alias_index={"he he": {"he-he-hongshan"}},
                discovered_at="2026-07-25",
            )
        )

    def test_panda_sticker_image_is_skipped(self) -> None:
        source = {
            "mime": "image/jpeg",
            "candidate_id": "commons-candidate-sticker",
            "original_url": "https://example.test/sticker.jpg",
            "description_url": "https://example.test/source",
            "file_title": "File:Airplane panda stickers.jpg",
            "description": "Aircraft with stickers depicting two giant pandas.",
            "categories": [],
        }

        self.assertIsNone(
            MODULE.candidate_from_commons_discovery(
                source,
                labels={},
                alias_index={},
                discovered_at="2026-07-25",
            )
        )

    def test_commons_video_is_skipped(self) -> None:
        source = {
            "mime": "video/webm",
            "original_url": "https://example.test/panda.webm",
            "description_url": "https://example.test/source",
        }

        self.assertIsNone(
            MODULE.candidate_from_commons_discovery(
                source,
                labels={},
                alias_index={},
                discovered_at="2026-07-25",
            )
        )


if __name__ == "__main__":
    unittest.main()
