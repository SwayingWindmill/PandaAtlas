from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from app.enrichment import (
    ExtractedFact,
    ExtractedRelationship,
    FactDerivationExtraction,
    FactEnrichmentBatch,
    IdentityFieldEvidence,
    IdentitySubjectExtraction,
    build_fact_enrichment_batch,
    build_identity_candidate_batch,
)
from app.identity_resolution import (
    IdentityFeatureSet,
    IdentityNameClaim,
    IdentityResolutionBatch,
    resolve_identity_batch,
)
from app.knowledge.contracts import (
    AssertionLifecycle,
    ConfidenceBand,
    EvidenceMode,
    RelationshipType,
    SourceAccessBasis,
    SourceAssessment,
    SourceEvidence,
    SourceKind,
)

ROOT = Path(__file__).resolve().parents[3]
SCHEMA_PATH = ROOT / "contracts" / "panda-fact-enrichment.v1.json"
FIXTURE_DIR = ROOT / "contracts" / "panda-fact-enrichment-fixtures" / "v1"
CREATED_AT = datetime(2026, 7, 23, 12, 0, tzinfo=UTC)


def _source(
    source_id: str,
    *,
    confidence: ConfidenceBand,
    first_hand: bool,
    title: str,
) -> SourceEvidence:
    return SourceEvidence(
        source_id=source_id,
        kind=(SourceKind.OFFICIAL_INSTITUTION if first_hand else SourceKind.MAINSTREAM_MEDIA),
        access_basis=SourceAccessBasis.PUBLIC,
        publisher="Panda Fixture Publisher",
        title=title,
        url=f"https://example.org/{source_id}",
        original_language="en",
        captured_at=CREATED_AT,
        is_first_hand=first_hand,
        assessment=SourceAssessment(
            confidence=confidence,
            authority_score=90 if first_hand else 40,
            recency_score=85,
            specificity_score=95 if first_hand else 60,
            consistency_score=90 if first_hand else 55,
            corroboration_score=70 if first_hand else 30,
            rationale=("fixture-source-assessment",),
        ),
    )


def _identity_evidence(field_path: str, normalized_value: object) -> IdentityFieldEvidence:
    return IdentityFieldEvidence(
        evidence_snapshot_id="snapshot-identity",
        evidence_body_sha256="a" * 64,
        field_path=field_path,
        raw_value=str(normalized_value),
        normalized_value=normalized_value,
        language="en",
        source_locator={"field_path": field_path},
        parser_name="fixture-identity-parser",
        parser_version="1.0.0",
    )


def _resolution(source: SourceEvidence, fixture_id: str) -> tuple[IdentityResolutionBatch, str]:
    intake = build_identity_candidate_batch(
        (
            IdentitySubjectExtraction(
                source_id=source.source_id,
                intake_candidate_id=f"intake-{fixture_id}",
                subject_key=f"profile:{fixture_id}",
                names=(
                    IdentityNameClaim(
                        value=f"Fixture Panda {fixture_id}",
                        language="en",
                        kind="primary",
                        normalized_forms=(f"fixture panda {fixture_id}",),
                    ),
                ),
                features=IdentityFeatureSet(sex="female"),
                evidence=(
                    _identity_evidence(
                        "identity.names",
                        f"Fixture Panda {fixture_id}",
                    ),
                    _identity_evidence("identity.sex", "female"),
                ),
            ),
        )
    )
    resolution = resolve_identity_batch(
        batch_id=f"identity-resolution-{fixture_id}",
        created_at=CREATED_AT,
        canonical_records=(),
        candidate_records=intake.candidates,
    )
    return resolution, intake.candidates[0].record_id


def _fact(
    *,
    record_id: str,
    source_id: str,
    fixture_id: str,
    field_path: str,
    raw_value: object,
    normalized_value: object,
    confidence: ConfidenceBand,
    evidence_mode: EvidenceMode = EvidenceMode.DIRECT,
    derivation: FactDerivationExtraction | None = None,
    lifecycle: AssertionLifecycle = AssertionLifecycle.ACTIVE,
    superseded_by_fact_id: str | None = None,
) -> ExtractedFact:
    return ExtractedFact(
        record_id=record_id,
        source_id=source_id,
        intake_candidate_id=f"intake-{fixture_id}",
        field_path=field_path,
        raw_value=raw_value,
        normalized_value=normalized_value,
        language="en",
        confidence=confidence,
        evidence_mode=evidence_mode,
        last_verified_at=CREATED_AT.date(),
        lifecycle=lifecycle,
        superseded_by_fact_id=superseded_by_fact_id,
        evidence_snapshot_id=f"snapshot-{fixture_id}-{source_id}",
        evidence_body_sha256=(source_id[-1] if source_id[-1] in "abcdef" else "b") * 64,
        source_locator={"fixture": fixture_id, "field_path": field_path},
        parser_name="fixture-fact-parser",
        parser_version="1.0.0",
        derivation=derivation,
    )


def build_fixtures() -> dict[str, FactEnrichmentBatch]:
    direct_source = _source(
        "source-direct-a",
        confidence=ConfidenceBand.HIGH,
        first_hand=True,
        title="Direct and review profile",
    )
    direct_resolution, direct_record_id = _resolution(direct_source, "direct-review")
    direct = build_fact_enrichment_batch(
        created_at=CREATED_AT,
        identity_resolution=direct_resolution,
        sources=(direct_source,),
        facts=(
            _fact(
                record_id=direct_record_id,
                source_id=direct_source.source_id,
                fixture_id="direct-review",
                field_path="birth.date",
                raw_value="Born on July 4, 2020",
                normalized_value="2020-07-04",
                confidence=ConfidenceBand.HIGH,
            ),
            _fact(
                record_id=direct_record_id,
                source_id=direct_source.source_id,
                fixture_id="direct-review",
                field_path="behavior.favorite_food",
                raw_value="May enjoy apples",
                normalized_value="apples",
                confidence=ConfidenceBand.LOW,
            ),
        ),
    )

    conflict_primary_source = _source(
        "source-conflict-a",
        confidence=ConfidenceBand.HIGH,
        first_hand=True,
        title="Primary birth profile",
    )
    conflict_secondary_source = _source(
        "source-conflict-b",
        confidence=ConfidenceBand.LOW,
        first_hand=False,
        title="Secondary birth report",
    )
    conflict_resolution, conflict_record_id = _resolution(
        conflict_primary_source,
        "conflict",
    )
    conflict = build_fact_enrichment_batch(
        created_at=CREATED_AT,
        identity_resolution=conflict_resolution,
        sources=(conflict_primary_source, conflict_secondary_source),
        facts=(
            _fact(
                record_id=conflict_record_id,
                source_id=conflict_primary_source.source_id,
                fixture_id="conflict",
                field_path="birth.date",
                raw_value="Born on July 4, 2020",
                normalized_value="2020-07-04",
                confidence=ConfidenceBand.MEDIUM,
            ),
            _fact(
                record_id=conflict_record_id,
                source_id=conflict_secondary_source.source_id,
                fixture_id="conflict",
                field_path="birth.date",
                raw_value="Born on July 5, 2020",
                normalized_value="2020-07-05",
                confidence=ConfidenceBand.MEDIUM,
            ),
        ),
    )

    inferred_source = _source(
        "source-inferred-a",
        confidence=ConfidenceBand.HIGH,
        first_hand=True,
        title="Age and birth profile",
    )
    inferred_resolution, inferred_record_id = _resolution(inferred_source, "inferred")
    direct_birth_year = _fact(
        record_id=inferred_record_id,
        source_id=inferred_source.source_id,
        fixture_id="inferred",
        field_path="birth.year",
        raw_value="Born in 2020",
        normalized_value=2020,
        confidence=ConfidenceBand.MEDIUM,
    )
    inferred_birth_year = _fact(
        record_id=inferred_record_id,
        source_id=inferred_source.source_id,
        fixture_id="inferred",
        field_path="birth.year",
        raw_value="Turned seven in 2026",
        normalized_value=2019,
        confidence=ConfidenceBand.HIGH,
        evidence_mode=EvidenceMode.INFERRED,
        derivation=FactDerivationExtraction(
            rule="subtract-age-from-reference-year",
            input_fact_ids=(direct_birth_year.fact_id,),
            explanation="2026 minus seven gives an inferred 2019 birth year.",
        ),
    )
    inferred = build_fact_enrichment_batch(
        created_at=CREATED_AT,
        identity_resolution=inferred_resolution,
        sources=(inferred_source,),
        facts=(direct_birth_year, inferred_birth_year),
    )

    correction_source = _source(
        "source-correction-a",
        confidence=ConfidenceBand.HIGH,
        first_hand=True,
        title="Corrected birth profile",
    )
    correction_resolution, correction_record_id = _resolution(
        correction_source,
        "correction",
    )
    replacement = _fact(
        record_id=correction_record_id,
        source_id=correction_source.source_id,
        fixture_id="correction",
        field_path="birth.year",
        raw_value="Correction: born in 2020",
        normalized_value=2020,
        confidence=ConfidenceBand.HIGH,
    )
    superseded = _fact(
        record_id=correction_record_id,
        source_id=correction_source.source_id,
        fixture_id="correction-old",
        field_path="birth.year",
        raw_value="Earlier profile said 2019",
        normalized_value=2019,
        confidence=ConfidenceBand.HIGH,
        lifecycle=AssertionLifecycle.SUPERSEDED,
        superseded_by_fact_id=replacement.fact_id,
    )
    correction = build_fact_enrichment_batch(
        created_at=CREATED_AT,
        identity_resolution=correction_resolution,
        sources=(correction_source,),
        facts=(superseded, replacement),
    )

    relationship_source = _source(
        "source-relationship-a",
        confidence=ConfidenceBand.MEDIUM,
        first_hand=False,
        title="Parentage record",
    )
    relationship_resolution, relationship_record_id = _resolution(
        relationship_source,
        "relationship",
    )
    relationship = build_fact_enrichment_batch(
        created_at=CREATED_AT,
        identity_resolution=relationship_resolution,
        sources=(relationship_source,),
        facts=(),
        relationships=(
            ExtractedRelationship(
                record_id=relationship_record_id,
                object_panda_id="panda-fixture-mother",
                relationship_type=RelationshipType.MOTHER,
                source_id=relationship_source.source_id,
                intake_candidate_id="intake-relationship",
                raw_value="Mother: panda-fixture-mother",
                language="en",
                confidence=ConfidenceBand.MEDIUM,
                last_verified_at=CREATED_AT.date(),
                evidence_snapshot_id="snapshot-relationship",
                evidence_body_sha256="e" * 64,
                source_locator={"section": "family", "label": "Mother"},
                parser_name="fixture-parentage-parser",
                parser_version="1.0.0",
            ),
        ),
    )

    return {
        "conflict.valid.json": conflict,
        "correction.valid.json": correction,
        "direct-and-review.valid.json": direct,
        "inferred.valid.json": inferred,
        "tentative-relationship.valid.json": relationship,
    }


def write_contract_files() -> None:
    SCHEMA_PATH.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    SCHEMA_PATH.write_text(
        json.dumps(
            FactEnrichmentBatch.model_json_schema(),
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
