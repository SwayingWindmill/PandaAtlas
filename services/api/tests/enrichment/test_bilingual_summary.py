from __future__ import annotations

from datetime import UTC, date, datetime

import pytest
from pydantic import ValidationError

from app.enrichment import (
    BilingualNormalizedValue,
    BilingualSummaryBatch,
    ExtractedFact,
    IdentityFieldEvidence,
    IdentitySubjectExtraction,
    build_bilingual_summary_batch,
    build_fact_enrichment_batch,
    build_identity_candidate_batch,
)
from app.enrichment.summary_contracts import (
    bilingual_summary_batch_id,
    bilingual_value_id,
    build_generated_translations,
    summary_knowledge_bundle_id,
)
from app.identity_resolution import IdentityFeatureSet, IdentityNameClaim, resolve_identity_batch
from app.knowledge.contracts import (
    ConfidenceBand,
    EvidenceMode,
    PandaKnowledgeBundle,
    PandaKnowledgeRecord,
    SourceAccessBasis,
    SourceAssessment,
    SourceEvidence,
    SourceKind,
    TranslationStatus,
)


def test_bilingual_summary_uses_only_publishable_assertions_with_sentence_traceability() -> None:
    source = _source()
    resolution, record_id = _resolution(source)
    birth = _fact(
        record_id=record_id,
        source_id=source.source_id,
        field_path="birth.date",
        raw_value="Born on July 4, 2020",
        normalized_value="2020-07-04",
        confidence=ConfidenceBand.HIGH,
    )
    review_only = _fact(
        record_id=record_id,
        source_id=source.source_id,
        field_path="behavior.favorite_food",
        raw_value="May enjoy apples",
        normalized_value="apples",
        confidence=ConfidenceBand.LOW,
    )
    facts = build_fact_enrichment_batch(
        created_at=datetime(2026, 7, 23, 13, 0, tzinfo=UTC),
        identity_resolution=resolution,
        sources=(source,),
        facts=(review_only, birth),
    )

    summary = build_bilingual_summary_batch(
        fact_enrichment=facts,
        generator_version="bilingual-summary/v1",
        generated_at=datetime(2026, 7, 23, 13, 5, tzinfo=UTC),
    )

    assert summary.schema_version == "panda-atlas-bilingual-summary/v1"
    assert summary.fact_enrichment == facts
    assert summary.write_boundary == {
        "trusted_write_targets": (),
        "publication_write_targets": (),
    }
    assert len(summary.normalized_values) == 1
    normalized = summary.normalized_values[0]
    assert normalized.assertion_id == birth.fact_id
    assert normalized.zh_text == "2020年7月4日"
    assert normalized.en_text == "July 4, 2020"

    assert len(summary.sentences) == 1
    sentence = summary.sentences[0]
    assert sentence.field_path == "birth.date"
    assert sentence.based_on_assertion_ids == (birth.fact_id,)
    assert sentence.zh_text == "出生日期：2020年7月4日。"
    assert sentence.en_text == "Birth date: July 4, 2020."
    assert review_only.fact_id not in sentence.based_on_assertion_ids

    record = summary.knowledge_bundle.records[0]
    generated = tuple(
        translation
        for translation in record.translations
        if translation.status is TranslationStatus.GENERATED
    )
    assert len(generated) == 4
    assert all(translation.generator_version == "bilingual-summary/v1" for translation in generated)
    assert all(translation.based_on_assertion_ids == (birth.fact_id,) for translation in generated)


def test_disputed_and_unsupported_fields_do_not_generate_summary_sentences() -> None:
    source = _source()
    resolution, record_id = _resolution(source)
    primary = _fact(
        record_id=record_id,
        source_id=source.source_id,
        field_path="birth.year",
        raw_value="Born in 2020",
        normalized_value=2020,
        confidence=ConfidenceBand.HIGH,
    )
    alternative_source = SourceEvidence(
        source_id="source-alternative",
        kind=SourceKind.MAINSTREAM_MEDIA,
        access_basis=SourceAccessBasis.PUBLIC,
        publisher="Alternative Publisher",
        title="Alternative birth report",
        url="https://example.org/alternative",
        original_language="en",
        captured_at=datetime(2026, 7, 23, 12, 0, tzinfo=UTC),
        is_first_hand=False,
    )
    alternative = _fact(
        record_id=record_id,
        source_id=alternative_source.source_id,
        field_path="birth.year",
        raw_value="Born in 2019",
        normalized_value=2019,
        confidence=ConfidenceBand.MEDIUM,
    )
    unsupported = _fact(
        record_id=record_id,
        source_id=source.source_id,
        field_path="behavior.favorite_food",
        raw_value="Enjoys apples",
        normalized_value="apples",
        confidence=ConfidenceBand.HIGH,
    )
    facts = build_fact_enrichment_batch(
        created_at=datetime(2026, 7, 23, 14, 0, tzinfo=UTC),
        identity_resolution=resolution,
        sources=(source, alternative_source),
        facts=(primary, alternative, unsupported),
    )

    summary = build_bilingual_summary_batch(
        fact_enrichment=facts,
        generator_version="bilingual-summary/v1",
        generated_at=datetime(2026, 7, 23, 14, 5, tzinfo=UTC),
    )

    assert summary.sentences == ()
    normalized_ids = {value.assertion_id for value in summary.normalized_values}
    assert normalized_ids == {primary.fact_id, alternative.fact_id}
    assert unsupported.fact_id not in normalized_ids


def test_summary_regenerates_when_fact_confidence_changes_even_if_evidence_id_is_stable() -> None:
    source = _source()
    resolution, record_id = _resolution(source)
    high_fact = _fact(
        record_id=record_id,
        source_id=source.source_id,
        field_path="birth.year",
        raw_value="Born in 2020",
        normalized_value=2020,
        confidence=ConfidenceBand.HIGH,
    )
    medium_payload = high_fact.model_dump(mode="json")
    medium_payload["confidence"] = ConfidenceBand.MEDIUM.value
    medium_fact = ExtractedFact.model_validate(medium_payload)
    assert medium_fact.fact_id == high_fact.fact_id

    high_batch = build_fact_enrichment_batch(
        created_at=datetime(2026, 7, 23, 15, 0, tzinfo=UTC),
        identity_resolution=resolution,
        sources=(source,),
        facts=(high_fact,),
    )
    medium_batch = build_fact_enrichment_batch(
        created_at=datetime(2026, 7, 23, 15, 0, tzinfo=UTC),
        identity_resolution=resolution,
        sources=(source,),
        facts=(medium_fact,),
    )
    high_summary = build_bilingual_summary_batch(
        fact_enrichment=high_batch,
        generator_version="bilingual-summary/v1",
        generated_at=datetime(2026, 7, 23, 15, 5, tzinfo=UTC),
    )
    medium_summary = build_bilingual_summary_batch(
        fact_enrichment=medium_batch,
        generator_version="bilingual-summary/v1",
        generated_at=datetime(2026, 7, 23, 15, 5, tzinfo=UTC),
    )

    assert high_summary.batch_id != medium_summary.batch_id
    assert high_summary.sentences[0].sentence_id != medium_summary.sentences[0].sentence_id
    assert high_summary.sentences[0].en_text == "Birth year: 2020."
    assert medium_summary.sentences[0].en_text == "Reported birth year: 2020."


def test_bilingual_summary_batch_rejects_tampered_sentence_basis() -> None:
    source = _source()
    resolution, record_id = _resolution(source)
    fact = _fact(
        record_id=record_id,
        source_id=source.source_id,
        field_path="birth.year",
        raw_value="Born in 2020",
        normalized_value=2020,
        confidence=ConfidenceBand.HIGH,
    )
    fact_batch = build_fact_enrichment_batch(
        created_at=datetime(2026, 7, 23, 16, 0, tzinfo=UTC),
        identity_resolution=resolution,
        sources=(source,),
        facts=(fact,),
    )
    summary = build_bilingual_summary_batch(
        fact_enrichment=fact_batch,
        generator_version="bilingual-summary/v1",
        generated_at=datetime(2026, 7, 23, 16, 5, tzinfo=UTC),
    )
    payload = summary.model_dump(mode="json")
    payload["sentences"][0]["based_on_assertion_ids"] = ["unsupported-assertion"]

    with pytest.raises(ValidationError):
        BilingualSummaryBatch.model_validate(payload)


def test_bilingual_summary_rejects_semantically_wrong_but_rehashed_text() -> None:
    source = _source()
    resolution, record_id = _resolution(source)
    fact = _fact(
        record_id=record_id,
        source_id=source.source_id,
        field_path="birth.date",
        raw_value="Born on July 4, 2020",
        normalized_value="2020-07-04",
        confidence=ConfidenceBand.HIGH,
    )
    fact_batch = build_fact_enrichment_batch(
        created_at=datetime(2026, 7, 23, 16, 30, tzinfo=UTC),
        identity_resolution=resolution,
        sources=(source,),
        facts=(fact,),
    )
    summary = build_bilingual_summary_batch(
        fact_enrichment=fact_batch,
        generator_version="bilingual-summary/v1",
        generated_at=datetime(2026, 7, 23, 16, 35, tzinfo=UTC),
    )
    original = summary.normalized_values[0]
    wrong_value = BilingualNormalizedValue(
        value_id=bilingual_value_id(
            fact_enrichment_batch_id=fact_batch.batch_id,
            generator_version=summary.generator_version,
            record_id=original.record_id,
            assertion_id=original.assertion_id,
            field_path=original.field_path,
            zh_text=original.zh_text,
            en_text="July 5, 2020",
        ),
        fact_enrichment_batch_id=fact_batch.batch_id,
        generator_version=summary.generator_version,
        record_id=original.record_id,
        assertion_id=original.assertion_id,
        field_path=original.field_path,
        source_language=original.source_language,
        zh_text=original.zh_text,
        en_text="July 5, 2020",
    )
    wrong_values = (wrong_value,)
    generated = build_generated_translations(
        fact_enrichment_batch_id=fact_batch.batch_id,
        generator_version=summary.generator_version,
        generated_at=summary.generated_at,
        normalized_values=wrong_values,
        sentences=summary.sentences,
    )
    generated_by_record: dict[str, list[object]] = {}
    for generated_record_id, translation in generated:
        generated_by_record.setdefault(generated_record_id, []).append(translation)

    base_bundle = fact_batch.knowledge_bundle
    records = tuple(
        PandaKnowledgeRecord(
            **{
                **record.model_dump(mode="python"),
                "translations": tuple(
                    sorted(
                        generated_by_record.get(record.identity.identity_key, ()),
                        key=lambda translation: translation.translation_id,
                    )
                ),
            }
        )
        for record in base_bundle.records
    )
    draft_bundle = PandaKnowledgeBundle(
        bundle_id="knowledge-bundle-pending",
        created_at=summary.generated_at,
        sources=base_bundle.sources,
        records=records,
    )
    wrong_bundle = PandaKnowledgeBundle(
        bundle_id=summary_knowledge_bundle_id(
            fact_enrichment_batch_id=fact_batch.batch_id,
            generator_version=summary.generator_version,
            bundle=draft_bundle,
        ),
        created_at=summary.generated_at,
        sources=base_bundle.sources,
        records=records,
    )

    with pytest.raises(
        ValidationError,
        match="normalized values do not match the fact enrichment input",
    ):
        BilingualSummaryBatch(
            batch_id=bilingual_summary_batch_id(
                fact_enrichment=fact_batch,
                generator_version=summary.generator_version,
                generated_at=summary.generated_at,
                normalized_values=wrong_values,
                sentences=summary.sentences,
                knowledge_bundle=wrong_bundle,
            ),
            generator_version=summary.generator_version,
            generated_at=summary.generated_at,
            fact_enrichment=fact_batch,
            normalized_values=wrong_values,
            sentences=summary.sentences,
            knowledge_bundle=wrong_bundle,
        )


def _source() -> SourceEvidence:
    return SourceEvidence(
        source_id="source-summary",
        kind=SourceKind.OFFICIAL_INSTITUTION,
        access_basis=SourceAccessBasis.PUBLIC,
        publisher="Summary Fixture Institution",
        title="Summary fixture profile",
        url="https://example.org/summary-profile",
        original_language="en",
        captured_at=datetime(2026, 7, 23, 12, 0, tzinfo=UTC),
        is_first_hand=True,
        assessment=SourceAssessment(
            confidence=ConfidenceBand.HIGH,
            authority_score=90,
            recency_score=90,
            specificity_score=95,
            consistency_score=90,
            corroboration_score=70,
            rationale=("reviewed-summary-source",),
        ),
    )


def _resolution(source: SourceEvidence):
    intake = build_identity_candidate_batch(
        (
            IdentitySubjectExtraction(
                source_id=source.source_id,
                intake_candidate_id="intake-summary",
                subject_key="profile:summary-panda",
                names=(
                    IdentityNameClaim(
                        value="Summary Panda",
                        language="en",
                        kind="primary",
                        normalized_forms=("summary panda",),
                    ),
                ),
                features=IdentityFeatureSet(sex="female"),
                evidence=(
                    _identity_evidence("identity.names", "Summary Panda"),
                    _identity_evidence("identity.sex", "female"),
                ),
            ),
        )
    )
    resolution = resolve_identity_batch(
        batch_id="identity-resolution-summary",
        created_at=datetime(2026, 7, 23, 12, 30, tzinfo=UTC),
        canonical_records=(),
        candidate_records=intake.candidates,
    )
    return resolution, intake.candidates[0].record_id


def _identity_evidence(field_path: str, normalized_value: object) -> IdentityFieldEvidence:
    return IdentityFieldEvidence(
        evidence_snapshot_id="snapshot-summary-identity",
        evidence_body_sha256="a" * 64,
        field_path=field_path,
        raw_value=str(normalized_value),
        normalized_value=normalized_value,
        language="en",
        source_locator={"field_path": field_path},
        parser_name="summary-identity-parser",
        parser_version="1.0.0",
    )


def _fact(
    *,
    record_id: str,
    source_id: str,
    field_path: str,
    raw_value: object,
    normalized_value: object,
    confidence: ConfidenceBand,
) -> ExtractedFact:
    return ExtractedFact(
        record_id=record_id,
        source_id=source_id,
        intake_candidate_id="intake-summary",
        field_path=field_path,
        raw_value=raw_value,
        normalized_value=normalized_value,
        language="en",
        confidence=confidence,
        evidence_mode=EvidenceMode.DIRECT,
        last_verified_at=date(2026, 7, 23),
        evidence_snapshot_id=f"snapshot-{source_id}",
        evidence_body_sha256="b" * 64,
        source_locator={"field_path": field_path, "source_id": source_id},
        parser_name="summary-fact-parser",
        parser_version="1.0.0",
    )
