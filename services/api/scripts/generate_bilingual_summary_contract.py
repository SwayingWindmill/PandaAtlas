from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from generate_fact_enrichment_contract import (
    _fact,
    _resolution,
    _source,
)
from generate_fact_enrichment_contract import (
    build_fixtures as build_fact_fixtures,
)

from app.enrichment import (
    BilingualSummaryBatch,
    build_bilingual_summary_batch,
    build_fact_enrichment_batch,
)
from app.knowledge.contracts import ConfidenceBand, EvidenceMode

ROOT = Path(__file__).resolve().parents[3]
SCHEMA_PATH = ROOT / "contracts" / "panda-bilingual-summary.v1.json"
FIXTURE_DIR = ROOT / "contracts" / "panda-bilingual-summary-fixtures" / "v1"
GENERATED_AT = datetime(2026, 7, 23, 17, 0, tzinfo=UTC)


def build_fixtures() -> dict[str, BilingualSummaryBatch]:
    fact_fixtures = build_fact_fixtures()
    confirmed = build_bilingual_summary_batch(
        fact_enrichment=fact_fixtures["direct-and-review.valid.json"],
        generator_version="bilingual-summary/v1",
        generated_at=GENERATED_AT,
    )
    disputed = build_bilingual_summary_batch(
        fact_enrichment=fact_fixtures["conflict.valid.json"],
        generator_version="bilingual-summary/v1",
        generated_at=GENERATED_AT,
    )

    tentative_source = _source(
        "source-summary-tentative-a",
        confidence=ConfidenceBand.MEDIUM,
        first_hand=True,
        title="Tentative birth year profile",
    )
    tentative_resolution, tentative_record_id = _resolution(
        tentative_source,
        "summary-tentative",
    )
    tentative_fact = _fact(
        record_id=tentative_record_id,
        source_id=tentative_source.source_id,
        fixture_id="summary-tentative",
        field_path="birth.year",
        raw_value="Reported born in 2020",
        normalized_value=2020,
        confidence=ConfidenceBand.MEDIUM,
        evidence_mode=EvidenceMode.DIRECT,
    )
    tentative_fact_batch = build_fact_enrichment_batch(
        created_at=GENERATED_AT,
        identity_resolution=tentative_resolution,
        sources=(tentative_source,),
        facts=(tentative_fact,),
    )
    tentative = build_bilingual_summary_batch(
        fact_enrichment=tentative_fact_batch,
        generator_version="bilingual-summary/v1",
        generated_at=GENERATED_AT,
    )
    return {
        "confirmed-birth.valid.json": confirmed,
        "disputed-birth.valid.json": disputed,
        "tentative-birth.valid.json": tentative,
    }


def write_contract_files() -> None:
    SCHEMA_PATH.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    SCHEMA_PATH.write_text(
        json.dumps(
            BilingualSummaryBatch.model_json_schema(),
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    for name, fixture in build_fixtures().items():
        (FIXTURE_DIR / name).write_text(
            json.dumps(
                fixture.model_dump(mode="json"),
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )


if __name__ == "__main__":
    write_contract_files()
