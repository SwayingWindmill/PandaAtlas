from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from datetime import UTC, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MODULE_PATH = REPO_ROOT / "scripts" / "curation" / "build_local_research_release.py"
SPEC = importlib.util.spec_from_file_location("build_local_research_release", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def base_source() -> dict:
    return {
        "contract_version": "1.0.0",
        "dataset": {
            "access_policy": {
                "public_property": "public",
                "restricted_never_projected": True,
                "restricted_property": "restricted",
            },
            "base_dataset_version": "2026.07.24.2",
            "core_panda_count": 1,
            "expansion_panda_ids": [],
            "fixture_consumers": ["domain", "api", "projection", "snapshot", "browser"],
            "id": "panda-atlas-public",
            "licenses": {
                "original_text": "CC-BY-4.0",
                "structured_data": "ODC-By-1.0",
                "third_party_media": "per-item",
            },
            "partial_profile_panda_ids": [],
            "public_schema_version": "1.3.0",
            "title": "test",
            "version": "2026.07.31.1",
        },
        "events": [],
        "facilities": [],
        "facts": [],
        "institutions": [],
        "media": [
            {
                "id": "media-existing-none",
                "publication_status": "published",
                "public": {
                    "panda_id": "11111111-1111-4111-8111-111111111111",
                    "license_state": "no_licensed_media",
                    "display_mode": "designed_empty_state",
                    "source_ids": [],
                },
                "restricted": {},
            }
        ],
        "pandas": [
            {
                "id": "11111111-1111-4111-8111-111111111111",
                "publication_status": "published",
                "public": {
                    "aliases": [],
                    "canonical_slug": "he-hua",
                    "content": [],
                    "external_identifiers": [],
                    "legacy_slugs": [],
                    "life_status": "alive",
                    "names": [
                        {
                            "kind": "official",
                            "language": "zh-Hans",
                            "primary": True,
                            "source_ids": [],
                            "value": "和花",
                        },
                        {
                            "kind": "official_romanization",
                            "language": "en",
                            "primary": True,
                            "source_ids": [],
                            "value": "He Hua",
                        },
                    ],
                    "record_tier": "identity_first_pass",
                    "revision_summaries": [],
                    "sex": "female",
                },
                "restricted": {},
            }
        ],
        "parentage_assertions": [],
        "places": [],
        "related_pandas": [],
        "residencies": [],
        "sources": [],
    }


def source(source_id: str = "src-test") -> dict:
    return {
        "source_id": source_id,
        "publisher": "Test Zoo",
        "title": "Test profile",
        "url": "https://example.test/panda",
        "language": "en",
        "authority": "primary",
        "source_type": "institution_primary",
        "rights_status": "facts_only",
        "retrieved_at": "2026-08-11T12:00:00Z",
    }


def record(
    record_id: str,
    subject_id: str,
    label: str,
    predicate: str,
    value,
    *,
    source_id: str = "src-test",
    category: str = "identity",
) -> dict:
    return {
        "record_id": record_id,
        "subject": {"type": "panda", "id": subject_id, "label": label},
        "category": category,
        "predicate": predicate,
        "value": value,
        "source_id": source_id,
        "source_language": "en",
        "summary_zh": "测试记录",
        "evidence_level": "direct",
        "confidence": "high",
        "review_status": "captured",
        "publication_status": "local_only",
        "collected_at": "2026-08-11T12:00:00Z",
        "tags": [subject_id],
    }


class LocalResearchReleaseTests(unittest.TestCase):
    def test_existing_panda_is_preserved_and_receives_local_facts(self) -> None:
        records = [
            record("r1", "he-hua-chengdu", "He Hua / 和花", "birth_date", "2020-07-04")
        ]
        result = MODULE.merge_local_research(
            base_source(),
            records,
            [source()],
            release_version="2026.08.12.1",
            released_at=datetime(2026, 8, 12, tzinfo=UTC),
        )
        self.assertEqual(len(result.source_state["pandas"]), 1)
        self.assertEqual(result.subject_id_map["he-hua-chengdu"], "11111111-1111-4111-8111-111111111111")
        panda = result.source_state["pandas"][0]
        self.assertEqual(panda["public"]["canonical_slug"], "he-hua")
        self.assertTrue(any(f["public"]["field"] == "birth_date" for f in result.source_state["facts"]))
        self.assertTrue(any(f["public"]["field"] == "local:birth_date" for f in result.source_state["facts"]))

    def test_new_panda_uses_stable_uuid_and_structured_names(self) -> None:
        records = [record("r1", "ai-lin-2022", "Ai Lin / 艾琳", "sex", "female")]
        first = MODULE.merge_local_research(
            base_source(), records, [source()], release_version="2026.08.12.1",
            released_at=datetime(2026, 8, 12, tzinfo=UTC),
        )
        second = MODULE.merge_local_research(
            base_source(), records, [source()], release_version="2026.08.12.1",
            released_at=datetime(2026, 8, 12, tzinfo=UTC),
        )
        panda_id = first.subject_id_map["ai-lin-2022"]
        self.assertEqual(panda_id, second.subject_id_map["ai-lin-2022"])
        panda = next(item for item in first.source_state["pandas"] if item["id"] == panda_id)
        self.assertEqual(panda["public"]["canonical_slug"], "ai-lin-2022")
        names = {(item["language"], item["value"]) for item in panda["public"]["names"]}
        self.assertIn(("en", "Ai Lin"), names)
        self.assertIn(("zh-Hans", "艾琳"), names)
        self.assertEqual(panda["public"]["sex"], "female")
        merged_source = next(item for item in first.source_state["sources"] if item["id"] == "src-test")
        self.assertIsNone(merged_source["public"]["published_at"])

    def test_existing_identity_conflict_is_preserved_without_overwrite(self) -> None:
        result = MODULE.merge_local_research(
            base_source(),
            [record("r1", "he-hua-chengdu", "He Hua / 和花", "sex", "male")],
            [source()],
            release_version="2026.08.12.1",
            released_at=datetime(2026, 8, 12, tzinfo=UTC),
        )
        panda = result.source_state["pandas"][0]
        self.assertEqual(panda["public"]["sex"], "female")
        self.assertIn("he-hua-chengdu", result.report["conflicts"]["sex_subject_ids"])
        quality = next(
            item
            for item in result.source_state["facts"]
            if item["public"]["subject_id"] == panda["id"] and item["public"]["field"] == "data_quality"
        )
        self.assertEqual(quality["public"]["value"], "uncertain")

    def test_ambiguous_name_does_not_merge_into_existing_namesake(self) -> None:
        base = base_source()
        other = MODULE.make_panda_record(
            panda_id="22222222-2222-4222-8222-222222222222",
            slug="he-ye",
            names=[("en", "An An"), ("zh-Hans", "安安")],
            source_ids=[],
            sex="unknown",
            life_status="unknown",
        )
        base["pandas"].append(other)
        another = MODULE.make_panda_record(
            panda_id="33333333-3333-4333-8333-333333333333",
            slug="an-an-historic",
            names=[("en", "An An"), ("zh-Hans", "安安")],
            source_ids=[],
            sex="unknown",
            life_status="deceased",
        )
        base["pandas"].append(another)
        records = [record("r1", "an-an-new", "An An / 安安", "sex", "male")]
        result = MODULE.merge_local_research(
            base, records, [source()], release_version="2026.08.12.1",
            released_at=datetime(2026, 8, 12, tzinfo=UTC),
        )
        self.assertNotIn(
            result.subject_id_map["an-an-new"],
            {"22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"},
        )

    def test_conflicting_birth_dates_are_preserved_without_false_canonical_date(self) -> None:
        records = [
            record("r1", "new-panda", "New Panda / 新熊", "birth_date", "2020-07-04"),
            record("r2", "new-panda", "New Panda / 新熊", "birth_date", "2020-07-05"),
        ]
        result = MODULE.merge_local_research(
            base_source(), records, [source()], release_version="2026.08.12.1",
            released_at=datetime(2026, 8, 12, tzinfo=UTC),
        )
        panda_id = result.subject_id_map["new-panda"]
        fields = [
            item["public"]["field"]
            for item in result.source_state["facts"]
            if item["public"]["subject_id"] == panda_id
        ]
        self.assertNotIn("birth_date", fields)
        self.assertEqual(fields.count("local:birth_date"), 2)
        self.assertIn("new-panda", result.report["conflicts"]["birth_date_subject_ids"])

    def test_unique_mother_name_becomes_parentage_assertion(self) -> None:
        records = [
            record("r1", "mother-panda", "Mother Panda / 熊妈", "sex", "female"),
            record("r2", "cub-panda", "Cub Panda / 熊崽", "mother", "熊妈", category="lineage"),
        ]
        result = MODULE.merge_local_research(
            base_source(), records, [source()], release_version="2026.08.12.1",
            released_at=datetime(2026, 8, 12, tzinfo=UTC),
        )
        child_id = result.subject_id_map["cub-panda"]
        parent_id = result.subject_id_map["mother-panda"]
        assertion = next(
            item
            for item in result.source_state["parentage_assertions"]
            if item["public"]["child_id"] == child_id and item["public"]["role"] == "mother"
        )
        self.assertEqual(assertion["public"]["parent_id"], parent_id)
        self.assertEqual(assertion["public"]["status"], "confirmed")

    def test_bilingual_parent_reference_resolves_without_guessing(self) -> None:
        records = [
            record("r1", "mother-panda", "Mother Panda / 熊妈", "sex", "female"),
            record("r2", "cub-panda", "Cub Panda / 熊崽", "mother", "Mother Panda / 熊妈", category="lineage"),
        ]
        result = MODULE.merge_local_research(
            base_source(), records, [source()], release_version="2026.08.12.1",
            released_at=datetime(2026, 8, 12, tzinfo=UTC),
        )
        child_id = result.subject_id_map["cub-panda"]
        parent_id = result.subject_id_map["mother-panda"]
        self.assertTrue(
            any(
                item["public"]["child_id"] == child_id
                and item["public"]["parent_id"] == parent_id
                and item["public"]["role"] == "mother"
                for item in result.source_state["parentage_assertions"]
            )
        )

    def test_duplicate_record_ids_are_imported_once(self) -> None:
        duplicated = record("same-id", "new-panda", "New Panda / 新熊", "birth_date", "2020-07-04")
        result = MODULE.merge_local_research(
            base_source(), [duplicated, duplicated], [source(), source()],
            release_version="2026.08.12.1", released_at=datetime(2026, 8, 12, tzinfo=UTC),
        )
        local_facts = [
            item for item in result.source_state["facts"] if item["public"]["field"] == "local:birth_date"
        ]
        self.assertEqual(len(local_facts), 1)
        self.assertEqual(result.report["deduplication"]["duplicate_record_ids"], 1)


if __name__ == "__main__":
    unittest.main()
