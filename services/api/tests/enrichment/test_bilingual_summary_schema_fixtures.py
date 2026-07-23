from __future__ import annotations

import json
from pathlib import Path

from app.enrichment import BilingualSummaryBatch
from app.knowledge.contracts import ConclusionStatus, TranslationStatus

ROOT = Path(__file__).resolve().parents[4]
SCHEMA_PATH = ROOT / "contracts" / "panda-bilingual-summary.v1.json"
FIXTURE_DIR = ROOT / "contracts" / "panda-bilingual-summary-fixtures" / "v1"


def test_checked_in_bilingual_summary_schema_matches_runtime_contract() -> None:
    checked_in = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    assert checked_in == BilingualSummaryBatch.model_json_schema()


def test_bilingual_summary_acceptance_fixtures_cover_generation_routes() -> None:
    expected_names = {
        "confirmed-birth.valid.json",
        "disputed-birth.valid.json",
        "tentative-birth.valid.json",
    }
    fixture_paths = sorted(FIXTURE_DIR.glob("*.json"))
    assert {path.name for path in fixture_paths} == expected_names
    fixtures = {
        path.name: BilingualSummaryBatch.model_validate_json(path.read_text(encoding="utf-8"))
        for path in fixture_paths
    }

    confirmed = fixtures["confirmed-birth.valid.json"]
    assert (
        confirmed.normalized_values[0].fact_enrichment_batch_id
        == confirmed.fact_enrichment.batch_id
    )
    assert confirmed.sentences[0].zh_text == "出生日期：2020年7月4日。"
    assert confirmed.sentences[0].en_text == "Birth date: July 4, 2020."
    assert len(confirmed.knowledge_bundle.records[0].translations) == 4

    tentative = fixtures["tentative-birth.valid.json"]
    assert tentative.sentences[0].zh_text == "据报道，出生年份：2020年。"
    assert tentative.sentences[0].en_text == "Reported birth year: 2020."
    assert all(
        translation.status is TranslationStatus.GENERATED
        for translation in tentative.knowledge_bundle.records[0].translations
    )

    disputed = fixtures["disputed-birth.valid.json"]
    assert disputed.sentences == ()
    assert len(disputed.normalized_values) == 2
    assert (
        disputed.fact_enrichment.knowledge_bundle.records[0].conclusions[0].status
        is ConclusionStatus.DISPUTED
    )
