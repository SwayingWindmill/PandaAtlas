from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
MODULE_PATH = ROOT / "scripts" / "research" / "runners" / "extract_local_panda_media_facts.py"
SPEC = importlib.util.spec_from_file_location("extract_local_panda_media_facts", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class ExtractLocalPandaMediaFactsTests(unittest.TestCase):
    def test_parse_capture_date_handles_iso_and_named_dates(self) -> None:
        self.assertEqual(MODULE.parse_capture_date("2025-10-04 16:03"), "2025-10-04")
        self.assertEqual(MODULE.parse_capture_date("Taken on 21 May 2013"), "2013-05-21")
        self.assertIsNone(MODULE.parse_capture_date("unknown"))

    def test_life_stage_detection_is_conservative(self) -> None:
        self.assertEqual(MODULE.detect_life_stage("Giant Panda cub Mei Sheng"), "cub")
        self.assertEqual(MODULE.detect_life_stage("Baby panda, all grown up"), "adult")
        self.assertIsNone(MODULE.detect_life_stage("Giant panda at the zoo"))

    def test_mao_sun_metadata_yields_location_sex_and_date(self) -> None:
        candidate = {
            "media_id": "local-media-mao-sun",
            "media_kind": "individual_panda",
            "subject_id": "mao-sun",
            "subject_label": "Mao Sun",
            "asset_url": "https://upload.wikimedia.org/example.jpg",
            "source_page_url": "https://commons.wikimedia.org/wiki/File:Mao_Sun.jpg",
            "captured_at": "2025-10-04 16:03",
            "description": "Hunpandaen Mao Sun i Zoologisk Have København på Frederiksberg.",
            "identity_confidence": 0.95,
            "credit": "Photographer",
            "rights_label": "CC BY-SA 4.0",
            "rights_state": "open_license",
            "related_subject_ids": ["mao-sun"],
        }
        raw = {
            "file_title": "File:Ailuropoda melanoleuca (Mao Sun).jpg",
            "description": candidate["description"],
            "categories": ["Ailuropoda melanoleuca in Copenhagen Zoo"],
        }

        records = MODULE.derive_records(
            [candidate],
            {candidate["asset_url"]: raw},
            {"mao-sun": "毛笋"},
        )

        predicates = {record["predicate"] for record in records}
        self.assertIn("depicted_in_collected_media", predicates)
        self.assertIn("photographed_on", predicates)
        self.assertIn("observed_at_location_in_media", predicates)
        self.assertIn("sex_as_described_in_media_metadata", predicates)
        sex_record = next(record for record in records if record["predicate"] == "sex_as_described_in_media_metadata")
        self.assertEqual(sex_record["value"], "female")

    def test_legacy_candidate_without_media_kind_is_inferred_as_individual(self) -> None:
        candidate = {
            "media_id": "local-media-le-bao",
            "subject_id": "le-bao",
            "subject_label": "Le Bao",
            "asset_url": "https://upload.wikimedia.org/le-bao.jpg",
            "source_page_url": "https://commons.wikimedia.org/wiki/File:Le_Bao.jpg",
            "captured_at": "2024-01-15",
            "description": "러바오가 자고있는 모습",
            "identity_confidence": 0.85,
            "related_subject_ids": ["le-bao"],
        }

        records = MODULE.derive_records([candidate], {}, {"le-bao": "乐宝"})

        self.assertTrue(all(record["subject"]["type"] == "panda" for record in records))
        self.assertIn("observed_sleeping", {record["predicate"] for record in records})

    def test_group_media_creates_one_record_per_named_panda(self) -> None:
        candidate = {
            "media_id": "local-media-group",
            "media_kind": "panda_group",
            "subject_id": "group-test",
            "subject_label": "Lei Lei / Xiao Xiao",
            "asset_url": "https://upload.wikimedia.org/group.jpg",
            "source_page_url": "https://commons.wikimedia.org/wiki/File:Group.jpg",
            "captured_at": "2022-06-10",
            "description": "Lei Lei and Xiao Xiao at Ueno Zoo.",
            "identity_confidence": 0.75,
            "related_subject_ids": ["lei-lei", "xiao-xiao"],
        }

        records = MODULE.derive_records(
            [candidate],
            {},
            {"lei-lei": "蕾蕾", "xiao-xiao": "晓晓"},
        )

        depicted = [record for record in records if record["predicate"] == "depicted_in_collected_media"]
        self.assertEqual({record["subject"]["id"] for record in depicted}, {"lei-lei", "xiao-xiao"})
        for record in depicted:
            self.assertEqual(len(record["value"]["co_depicted_subject_ids"]), 1)

    def test_memorial_creates_cultural_context_record_with_represented_panda(self) -> None:
        candidate = {
            "media_id": "local-media-memorial",
            "media_kind": "panda_memorial",
            "subject_id": "topic-panda-memorials",
            "subject_label": "Panda statues and memorials",
            "asset_url": "https://upload.wikimedia.org/memorial.jpg",
            "source_page_url": "https://commons.wikimedia.org/wiki/File:Memorial.jpg",
            "captured_at": "2023-09-14",
            "description": "Statue of Pan Pan at Dujiangyan base.",
            "identity_confidence": 0.95,
            "related_subject_ids": [],
            "represented_subject_ids": ["pan-pan-baoxing"],
        }

        records = MODULE.derive_records([candidate], {}, {"pan-pan-baoxing": "盼盼"})
        memorial = next(record for record in records if record["predicate"] == "panda_memorial_documented")
        self.assertEqual(memorial["category"], "cultural_context")
        self.assertEqual(memorial["value"]["represented_subject_ids"], ["pan-pan-baoxing"])

    def test_research_diagram_creates_research_record(self) -> None:
        candidate = {
            "media_id": "local-media-research-diagram",
            "media_kind": "research_diagram",
            "subject_id": "topic-panda-research-diagrams",
            "subject_label": "Panda-related research diagrams",
            "asset_url": "https://upload.wikimedia.org/tree.svg",
            "source_page_url": "https://commons.wikimedia.org/wiki/File:Tree.svg",
            "captured_at": "2019-01-18",
            "description": "Phylogenetic tree including Ailuropoda melanoleuca.",
            "identity_confidence": 0.95,
            "related_subject_ids": [],
        }

        records = MODULE.derive_records([candidate], {}, {})
        research = next(record for record in records if record["predicate"] == "research_diagram_documented")
        self.assertEqual(research["category"], "research")
        self.assertEqual(research["subject"]["type"], "research_programme")

    def test_panda_costume_creates_cultural_context_record(self) -> None:
        candidate = {
            "media_id": "local-media-costume",
            "media_kind": "panda_costume",
            "subject_id": "topic-panda-costumes",
            "subject_label": "Panda costumes and cosplay",
            "asset_url": "https://upload.wikimedia.org/cosplay.jpg",
            "source_page_url": "https://commons.wikimedia.org/wiki/File:Cosplay.jpg",
            "captured_at": "2008-01-12",
            "description": "Giant Panda Cosplay at a shopping centre.",
            "identity_confidence": 0.95,
            "related_subject_ids": [],
        }

        records = MODULE.derive_records([candidate], {}, {})
        costume = next(record for record in records if record["predicate"] == "panda_costume_or_cosplay_documented")
        self.assertEqual(costume["category"], "cultural_context")
        self.assertEqual(costume["subject"]["id"], "topic-panda-costumes")

    def test_cultural_object_creates_cultural_context_record(self) -> None:
        candidate = {
            "media_id": "local-media-cultural-object",
            "media_kind": "cultural_object",
            "subject_id": "topic-panda-cultural-objects",
            "subject_label": "Panda-themed cultural objects",
            "asset_url": "https://upload.wikimedia.org/teddy.jpg",
            "source_page_url": "https://commons.wikimedia.org/wiki/File:Teddy.jpg",
            "captured_at": "2016-06-02",
            "description": "Handmade panda teddybear sewn from mohair.",
            "identity_confidence": 0.95,
            "related_subject_ids": [],
        }

        records = MODULE.derive_records([candidate], {}, {})
        cultural = next(record for record in records if record["predicate"] == "panda_cultural_object_documented")
        self.assertEqual(cultural["category"], "cultural_context")
        self.assertEqual(cultural["subject"]["id"], "topic-panda-cultural-objects")

    def test_1992_columbus_loan_creates_diplomacy_record(self) -> None:
        candidate = {
            "media_id": "local-media-columbus-1992",
            "media_kind": "panda_group",
            "subject_id": "group-columbus-1992",
            "subject_label": "Qin Qin / Xing Xing",
            "asset_url": "https://upload.wikimedia.org/columbus.jpg",
            "source_page_url": "https://commons.wikimedia.org/wiki/File:Columbus.jpg",
            "captured_at": "1992",
            "description": "The People's Republic of China loaned two pandas named Xing Xing and Qin Qin to the Columbus Zoo in the summer of 1992.",
            "identity_confidence": 0.9,
            "related_subject_ids": ["qin-qin-xian-1989", "xing-xing-chengdu-1989"],
        }

        records = MODULE.derive_records(
            [candidate],
            {},
            {
                "qin-qin-xian-1989": "琴琴",
                "xing-xing-chengdu-1989": "星星",
            },
        )
        loan = next(record for record in records if record["predicate"] == "temporary_panda_loan_documented")
        self.assertEqual(loan["category"], "diplomacy")
        self.assertEqual(loan["value"]["destination"], "Columbus Zoo")
        self.assertEqual(
            loan["value"]["panda_ids"],
            ["qin-qin-xian-1989", "xing-xing-chengdu-1989"],
        )

    def test_1972_nixon_peking_zoo_photo_creates_visit_not_transport_crate_record(self) -> None:
        candidate = {
            "media_id": "local-media-nixon-1972",
            "media_kind": "historical_artifact",
            "subject_id": "historic-1972-nixon-peking-zoo-visit",
            "subject_label": "1972 Nixon-party Peking Zoo panda visit",
            "asset_url": "https://upload.wikimedia.org/nixon.tiff",
            "source_page_url": "https://commons.wikimedia.org/wiki/File:Nixon.jpg",
            "captured_at": "1972-02-22",
            "description": "Pat Nixon, Chinese interpreters and officials view a panda at Peking Zoo in 1972.",
            "identity_confidence": 0.99,
            "related_subject_ids": [],
        }

        records = MODULE.derive_records([candidate], {}, {})
        predicates = {record["predicate"] for record in records}
        self.assertIn("panda_diplomacy_zoo_visit_documented", predicates)
        self.assertNotIn("transport_crate_documented", predicates)

    def test_historic_chongqing_photo_creates_cultural_context_record(self) -> None:
        candidate = {
            "media_id": "local-media-1941",
            "media_kind": "unresolved_panda",
            "subject_id": "unresolved-commons",
            "subject_label": "Unresolved panda",
            "asset_url": "https://upload.wikimedia.org/1941.jpg",
            "source_page_url": "https://commons.wikimedia.org/wiki/File:1941.jpg",
            "captured_at": "1941-11-09",
            "description": "Madam Chiang and Mr. Tee Van with baby Panda in Madam Chiang's yard in Chongqing, November 9, 1941.",
            "identity_confidence": 0.25,
            "related_subject_ids": [],
        }

        records = MODULE.derive_records([candidate], {}, {})
        historic = next(record for record in records if record["predicate"] == "historic_baby_panda_photograph")
        self.assertEqual(historic["category"], "cultural_context")
        self.assertEqual(historic["value"]["date"], "1941-11-09")

    def test_record_ids_are_deterministic(self) -> None:
        self.assertEqual(MODULE.record_id("same-key"), MODULE.record_id("same-key"))
        self.assertNotEqual(MODULE.record_id("same-key"), MODULE.record_id("other-key"))


if __name__ == "__main__":
    unittest.main()
