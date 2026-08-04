from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[3]
MODULE_PATH = ROOT / "scripts" / "research" / "runners" / "import_local_panda_media_candidates.py"
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
        self.assertEqual(
            MODULE.resolve_commons_subjects(
                {
                    "file_title": "File:Festival.jpg",
                    "description": "A king who ruled long long ago.",
                    "categories": [],
                },
                alias_index={"long long": {"ko-ko"}},
            ),
            [],
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

    def test_panda_habitat_entry_sign_is_saved_as_facility_signage(self) -> None:
        source = {
            "mime": "image/png",
            "candidate_id": "commons-candidate-entry-sign",
            "original_url": "https://example.test/entry.png",
            "description_url": "https://example.test/source",
            "file_title": "File:Panda Habitat Entry.png",
            "description": "Panda habitat entrance at Ocean Park.",
            "categories": ["Giant Panda Habitat, Ocean Park, Hong Kong"],
        }

        candidate = MODULE.candidate_from_commons_discovery(
            source,
            labels={},
            alias_index={},
            discovered_at="2026-07-25",
        )

        self.assertIsNotNone(candidate)
        assert candidate is not None
        self.assertEqual(candidate["subject_id"], "topic-panda-facility-signage")
        self.assertEqual(candidate["media_kind"], "facility_signage")

    def test_title_year_overrides_later_digitization_date(self) -> None:
        source = {
            "file_title": "File:Giant Panda Ling Ling (1985) Smithsonian.jpg",
            "description": "Original from Smithsonian National Zoo.",
            "categories": [],
            "captured_at_text": "2011-09-29",
        }

        resolved = MODULE.disambiguate_commons_subjects(
            source,
            [
                "ling-ling-beijing",
                "ling-ling-chongqing",
                "ling-ling-smithsonian",
                "ling-ling-ueno",
            ],
            identity_hints={
                "ling-ling-beijing": {"beijing"},
                "ling-ling-chongqing": {"chongqing"},
                "ling-ling-smithsonian": {"smithsonian"},
                "ling-ling-ueno": {"ueno"},
            },
            life_ranges={
                "ling-ling-beijing": (None, None),
                "ling-ling-chongqing": (1995, None),
                "ling-ling-smithsonian": (1970, 1992),
                "ling-ling-ueno": (1985, 2008),
            },
        )

        self.assertEqual(resolved, ["ling-ling-smithsonian"])

    def test_capture_year_excludes_later_same_name_pandas(self) -> None:
        source = {
            "file_title": "File:Giant Panda in Ocean Park.jpg",
            "description": "In 2002 Ocean Park had An An and Jia Jia.",
            "categories": [],
            "captured_at_text": "2002-08-01",
        }

        resolved = MODULE.disambiguate_commons_subjects(
            source,
            [
                "an-an-hk-2024",
                "an-an-ocean-park",
                "jia-jia-hk",
                "jia-jia-ocean-park",
            ],
            identity_hints={},
            life_ranges={
                "an-an-hk-2024": (2019, None),
                "an-an-ocean-park": (1986, 2022),
                "jia-jia-hk": (2024, None),
                "jia-jia-ocean-park": (1980, 2016),
            },
        )

        self.assertEqual(resolved, ["an-an-ocean-park", "jia-jia-ocean-park"])

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

    def test_panda_name_in_podcast_event_is_skipped(self) -> None:
        source = {
            "mime": "image/jpeg",
            "candidate_id": "commons-candidate-podcast",
            "original_url": "https://example.test/podcast.jpg",
            "description_url": "https://example.test/source",
            "file_title": "File:Jing Jing Podcast dinner.jpg",
            "description": "BloggerCon Jing Jing Podcast dinner.",
            "categories": [],
        }

        self.assertIsNone(
            MODULE.candidate_from_commons_discovery(
                source,
                labels={"jing-jing": "Jing Jing"},
                alias_index={"jing jing": {"jing-jing"}},
                discovered_at="2026-07-25",
            )
        )

    def test_baby_panda_bamboo_plant_is_skipped(self) -> None:
        source = {
            "mime": "image/jpeg",
            "candidate_id": "commons-candidate-plant",
            "original_url": "https://example.test/plant.jpg",
            "description_url": "https://example.test/source",
            "file_title": "File:Pogonatherum paniceum.jpg",
            "description": "Baby Panda Bamboo in a botanic garden. Classification: Plantae > Poaceae.",
            "categories": [],
        }

        self.assertIsNone(
            MODULE.candidate_from_commons_discovery(
                source,
                labels={"jin-zhu": "Jin Zhu"},
                alias_index={"jin zhu": {"jin-zhu"}},
                discovered_at="2026-07-25",
            )
        )

    def test_fiat_panda_automobile_is_skipped(self) -> None:
        source = {
            "mime": "image/jpeg",
            "candidate_id": "commons-candidate-fiat-panda",
            "original_url": "https://example.test/fiat.jpg",
            "description_url": "https://example.test/source",
            "file_title": "File:Fiat Panda Dakar.jpg",
            "description": "Fiat Panda rallying automobile.",
            "categories": ["Number 1 on Fiat rallying automobiles"],
        }

        self.assertIsNone(
            MODULE.candidate_from_commons_discovery(
                source,
                labels={"number-1-beijing": "Number 1"},
                alias_index={"number 1": {"number-1-beijing"}},
                discovered_at="2026-07-25",
            )
        )

    def test_same_name_ambiguity_is_unresolved_not_a_group(self) -> None:
        source = {
            "mime": "image/jpeg",
            "candidate_id": "commons-candidate-bao-bao",
            "original_url": "https://example.test/bao-bao.jpg",
            "description_url": "https://example.test/source",
            "file_title": "File:Bao Bao.jpg",
            "description": "Giant panda Bao Bao.",
            "categories": ["Bao Bao"],
            "identity_confidence": 0.25,
        }

        candidate = MODULE.candidate_from_commons_discovery(
            source,
            labels={"bao-bao": "Bao Bao", "bao-bao-beijing": "Bao Bao"},
            alias_index={"bao bao": {"bao-bao", "bao-bao-beijing"}},
            discovered_at="2026-07-25",
        )

        self.assertIsNotNone(candidate)
        assert candidate is not None
        self.assertEqual(candidate["subject_id"], "unresolved-commons")
        self.assertEqual(candidate["media_kind"], "unresolved_panda")
        self.assertEqual(candidate["related_subject_ids"], [])

    def test_red_panda_image_is_skipped(self) -> None:
        source = {
            "mime": "image/jpeg",
            "candidate_id": "commons-candidate-red-panda",
            "original_url": "https://example.test/red-panda.jpg",
            "description_url": "https://example.test/source",
            "file_title": "File:Red panda enclosure.jpg",
            "description": "Red panda Ming Ming at Birmingham Nature Centre.",
            "categories": ["Ailurus fulgens"],
        }

        self.assertIsNone(
            MODULE.candidate_from_commons_discovery(
                source,
                labels={"ming-london-1938": "Ming"},
                alias_index={"ming ming": {"ming-london-1938"}},
                discovered_at="2026-07-25",
            )
        )

    def test_short_pan_alias_requires_explicit_giant_panda_context(self) -> None:
        source = {
            "file_title": "File:Sunset Kick.jpg",
            "description": "Pan-na away, Pan-na away.",
            "categories": [],
        }
        self.assertEqual(
            MODULE.resolve_commons_subjects(source, alias_index={"pan": {"pan-bronx"}}),
            [],
        )
        self.assertEqual(
            MODULE.resolve_commons_subjects(
                {"file_title": "File:Pan (giant panda).jpg", "description": "", "categories": []},
                alias_index={"pan": {"pan-bronx"}},
            ),
            ["pan-bronx"],
        )

    def test_panda_cosplay_is_saved_as_cultural_media_not_individual(self) -> None:
        source = {
            "mime": "image/jpeg",
            "candidate_id": "commons-candidate-panda-cosplay",
            "original_url": "https://example.test/cosplay.jpg",
            "description_url": "https://example.test/source",
            "file_title": "File:Giant Panda Cosplay.jpg",
            "description": "Giant Panda Cosplay at a shopping centre.",
            "categories": [],
        }

        candidate = MODULE.candidate_from_commons_discovery(
            source,
            labels={"po-madrid": "Po"},
            alias_index={"po": {"po-madrid"}},
            discovered_at="2026-07-25",
        )

        self.assertIsNotNone(candidate)
        assert candidate is not None
        self.assertEqual(candidate["subject_id"], "topic-panda-costumes")
        self.assertEqual(candidate["media_kind"], "panda_costume")
        self.assertEqual(candidate["related_subject_ids"], [])

    def test_panda_teddy_bear_is_saved_as_cultural_object(self) -> None:
        source = {
            "mime": "image/jpeg",
            "candidate_id": "commons-candidate-teddy",
            "original_url": "https://example.test/teddy.jpg",
            "description_url": "https://example.test/source",
            "file_title": "File:Miao Yin the Panda.jpg",
            "description": "Handmade panda teddybear sewn from mohair and alpaca.",
            "categories": [],
        }

        candidate = MODULE.candidate_from_commons_discovery(
            source,
            labels={"miao-yin": "Miao Yin"},
            alias_index={"miao yin": {"miao-yin"}},
            discovered_at="2026-07-25",
        )

        self.assertIsNotNone(candidate)
        assert candidate is not None
        self.assertEqual(candidate["subject_id"], "topic-panda-cultural-objects")
        self.assertEqual(candidate["media_kind"], "cultural_object")
        self.assertEqual(candidate["related_subject_ids"], [])

    def test_panda_transport_crate_is_saved_as_historical_artifact(self) -> None:
        source = {
            "mime": "image/jpeg",
            "candidate_id": "commons-candidate-transport-crate",
            "original_url": "https://example.test/crate.jpg",
            "description_url": "https://example.test/source",
            "file_title": "File:Original giant panda crate.jpg",
            "description": "Crate used to transport pandas given by China in 1972.",
            "categories": [],
        }

        candidate = MODULE.candidate_from_commons_discovery(
            source,
            labels={},
            alias_index={},
            discovered_at="2026-07-25",
        )

        self.assertIsNotNone(candidate)
        assert candidate is not None
        self.assertEqual(candidate["subject_id"], "topic-1972-panda-transport-crates")
        self.assertEqual(candidate["media_kind"], "historical_artifact")

    def test_non_panda_statue_from_red_panda_bot_category_is_skipped(self) -> None:
        source = {
            "mime": "image/jpeg",
            "candidate_id": "commons-candidate-horse-statue",
            "original_url": "https://example.test/horse.jpg",
            "description_url": "https://example.test/source",
            "file_title": "File:Horseman figurine.jpg",
            "description": "Clay figurine similar to equestrian statues, displayed in Olympia.",
            "categories": ["Flickr files uploaded by Red panda bot"],
        }

        self.assertIsNone(
            MODULE.candidate_from_commons_discovery(
                source,
                labels={"olympia": "Olympia"},
                alias_index={"olympia": {"olympia"}},
                discovered_at="2026-07-25",
            )
        )

    def test_panda_sculpture_is_saved_as_memorial_media(self) -> None:
        source = {
            "mime": "image/jpeg",
            "candidate_id": "commons-candidate-sculpture",
            "original_url": "https://example.test/sculpture.jpg",
            "description_url": "https://example.test/source",
            "file_title": "File:Hehe Xiexie Montreal.jpg",
            "description": "Panda bears He He and Xie Xie in an open-air museum.",
            "categories": ["Panda sculptures"],
        }

        candidate = MODULE.candidate_from_commons_discovery(
            source,
            labels={"he-he-hongshan": "He He"},
            alias_index={"he he": {"he-he-hongshan"}},
            discovered_at="2026-07-25",
        )

        self.assertIsNotNone(candidate)
        assert candidate is not None
        self.assertEqual(candidate["subject_id"], "topic-panda-memorials")
        self.assertEqual(candidate["media_kind"], "panda_memorial")
        self.assertEqual(candidate["related_subject_ids"], [])
        self.assertEqual(candidate["represented_subject_ids"], [])

    def test_named_panda_statue_preserves_represented_subject(self) -> None:
        source = {
            "mime": "image/jpeg",
            "candidate_id": "commons-candidate-pan-pan-statue",
            "original_url": "https://example.test/pan-pan-statue.jpg",
            "description_url": "https://example.test/source",
            "file_title": "File:Statue of Panda Pan Pan at Dujiangyan base.jpg",
            "description": "中国大熊猫保护研究中心都江堰基地内的熊猫盼盼塑像",
            "categories": [],
        }

        candidate = MODULE.candidate_from_commons_discovery(
            source,
            labels={"pan-pan-baoxing": "Pan Pan", "pan-pan-beijing": "Pan Pan"},
            alias_index={"pan pan": {"pan-pan-baoxing", "pan-pan-beijing"}, "盼盼": {"pan-pan-beijing"}},
            identity_hints={"pan-pan-baoxing": {"dujiangyan"}, "pan-pan-beijing": {"beijing"}},
            life_ranges={"pan-pan-baoxing": (1985, 2016), "pan-pan-beijing": (None, None)},
            discovered_at="2026-07-25",
        )

        self.assertIsNotNone(candidate)
        assert candidate is not None
        self.assertEqual(candidate["media_kind"], "panda_memorial")
        self.assertEqual(candidate["represented_subject_ids"], ["pan-pan-baoxing"])

    def test_lun_and_lani_title_resolves_lun_lun_and_mei_lan(self) -> None:
        source = {
            "mime": "image/jpeg",
            "candidate_id": "commons-candidate-lun-lani",
            "original_url": "https://example.test/lun-lani.jpg",
            "description_url": "https://example.test/source",
            "file_title": "File:Lun and Lani playtime7.jpg",
            "description": "Lun and Lani playtime7",
            "categories": ["Ailuropoda melanoleuca in Zoo Atlanta"],
            "identity_confidence": 0.25,
        }

        candidate = MODULE.candidate_from_commons_discovery(
            source,
            labels={"lun-lun": "Lun Lun", "mei-lan": "Mei Lan"},
            alias_index={},
            discovered_at="2026-07-25",
        )

        self.assertIsNotNone(candidate)
        assert candidate is not None
        self.assertEqual(candidate["media_kind"], "panda_group")
        self.assertEqual(candidate["related_subject_ids"], ["lun-lun", "mei-lan"])
        self.assertEqual(candidate["identity_basis"], "community-nickname-crosswalk")
        self.assertEqual(candidate["identity_confidence"], 0.65)

    def test_1992_columbus_loan_description_resolves_qin_qin_and_xing_xing(self) -> None:
        source = {
            "mime": "image/jpeg",
            "candidate_id": "commons-candidate-columbus-1992",
            "original_url": "https://example.test/columbus.jpg",
            "description_url": "https://example.test/source",
            "file_title": "File:Giant pandas Columbus 1992.jpg",
            "description": "The People's Republic of China loaned two pandas named Xing Xing and Qin Qin to the Columbus Zoo in the summer of 1992.",
            "categories": [],
            "identity_confidence": 0.25,
        }

        candidate = MODULE.candidate_from_commons_discovery(
            source,
            labels={
                "qin-qin-xian-1989": "Qin Qin",
                "xing-xing-chengdu-1989": "Xing Xing",
                "xing-xing-macao-death": "Xing Xing",
            },
            alias_index={},
            discovered_at="2026-07-25",
        )

        self.assertIsNotNone(candidate)
        assert candidate is not None
        self.assertEqual(candidate["media_kind"], "panda_group")
        self.assertEqual(
            candidate["related_subject_ids"],
            ["qin-qin-xian-1989", "xing-xing-chengdu-1989"],
        )
        self.assertEqual(candidate["identity_basis"], "historic-loan-description-crosswalk")
        self.assertEqual(candidate["identity_confidence"], 0.9)

    def test_phylogenetic_svg_is_saved_as_research_diagram(self) -> None:
        source = {
            "mime": "image/svg+xml",
            "candidate_id": "commons-candidate-orthomam",
            "original_url": "https://example.test/tree.svg",
            "description_url": "https://example.test/source",
            "file_title": "File:OrthoMaM mammal tree.svg",
            "description": "Phylogenetic tree including Ailuropoda melanoleuca for comparative genomics.",
            "categories": [],
        }

        candidate = MODULE.candidate_from_commons_discovery(
            source,
            labels={},
            alias_index={},
            discovered_at="2026-07-25",
        )

        self.assertIsNotNone(candidate)
        assert candidate is not None
        self.assertEqual(candidate["subject_id"], "topic-panda-research-diagrams")
        self.assertEqual(candidate["media_kind"], "research_diagram")
        self.assertEqual(candidate["related_subject_ids"], [])

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
