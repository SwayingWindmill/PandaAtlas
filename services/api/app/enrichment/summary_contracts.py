from __future__ import annotations

from datetime import datetime
from hashlib import sha256
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.acquisition.contracts import canonical_json_bytes
from app.knowledge.contracts import (
    AssertionLifecycle,
    ConfidenceBand,
    FactPublicationScope,
    PandaKnowledgeBundle,
    TranslationStatus,
    TranslationValue,
)

from .fact_contracts import FactEnrichmentBatch

BILINGUAL_SUMMARY_SCHEMA_VERSION = "panda-atlas-bilingual-summary/v1"


class SummaryModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, validate_default=True)


def bilingual_value_id(
    *,
    fact_enrichment_batch_id: str,
    generator_version: str,
    record_id: str,
    assertion_id: str,
    field_path: str,
    zh_text: str,
    en_text: str,
) -> str:
    payload = {
        "fact_enrichment_batch_id": fact_enrichment_batch_id,
        "generator_version": generator_version,
        "record_id": record_id,
        "assertion_id": assertion_id,
        "field_path": field_path,
        "zh_text": zh_text,
        "en_text": en_text,
    }
    return f"bilingual-value-{sha256(canonical_json_bytes(payload)).hexdigest()}"


def bilingual_sentence_id(
    *,
    fact_enrichment_batch_id: str,
    generator_version: str,
    record_id: str,
    sentence_key: str,
    field_path: str,
    based_on_assertion_ids: tuple[str, ...],
    zh_text: str,
    en_text: str,
) -> str:
    payload = {
        "fact_enrichment_batch_id": fact_enrichment_batch_id,
        "generator_version": generator_version,
        "record_id": record_id,
        "sentence_key": sentence_key,
        "field_path": field_path,
        "based_on_assertion_ids": list(based_on_assertion_ids),
        "zh_text": zh_text,
        "en_text": en_text,
    }
    return f"bilingual-summary-sentence-{sha256(canonical_json_bytes(payload)).hexdigest()}"


class BilingualNormalizedValue(SummaryModel):
    value_id: str = Field(min_length=1)
    fact_enrichment_batch_id: str = Field(min_length=1)
    generator_version: str = Field(min_length=1)
    record_id: str = Field(min_length=1)
    assertion_id: str = Field(min_length=1)
    field_path: str = Field(min_length=1)
    source_language: str = Field(min_length=1)
    zh_text: str = Field(min_length=1)
    en_text: str = Field(min_length=1)

    @model_validator(mode="after")
    def validate_id(self) -> BilingualNormalizedValue:
        expected = bilingual_value_id(
            fact_enrichment_batch_id=self.fact_enrichment_batch_id,
            generator_version=self.generator_version,
            record_id=self.record_id,
            assertion_id=self.assertion_id,
            field_path=self.field_path,
            zh_text=self.zh_text,
            en_text=self.en_text,
        )
        if self.value_id != expected:
            raise ValueError("bilingual normalized value ID does not match its content")
        return self


class BilingualSummarySentence(SummaryModel):
    sentence_id: str = Field(min_length=1)
    fact_enrichment_batch_id: str = Field(min_length=1)
    generator_version: str = Field(min_length=1)
    record_id: str = Field(min_length=1)
    sentence_key: str = Field(min_length=1)
    field_path: str = Field(min_length=1)
    based_on_assertion_ids: tuple[str, ...] = Field(min_length=1)
    source_language: str = Field(min_length=1)
    zh_text: str = Field(min_length=1)
    en_text: str = Field(min_length=1)

    @model_validator(mode="after")
    def validate_sentence(self) -> BilingualSummarySentence:
        if self.based_on_assertion_ids != tuple(sorted(set(self.based_on_assertion_ids))):
            raise ValueError("summary sentence assertion basis must be unique and sorted")
        expected = bilingual_sentence_id(
            fact_enrichment_batch_id=self.fact_enrichment_batch_id,
            generator_version=self.generator_version,
            record_id=self.record_id,
            sentence_key=self.sentence_key,
            field_path=self.field_path,
            based_on_assertion_ids=self.based_on_assertion_ids,
            zh_text=self.zh_text,
            en_text=self.en_text,
        )
        if self.sentence_id != expected:
            raise ValueError("bilingual summary sentence ID does not match its content")
        return self


def generated_translation_id(
    *,
    fact_enrichment_batch_id: str,
    generator_version: str,
    subject_type: str,
    subject_id: str,
    locale: str,
    text: str,
    based_on_assertion_ids: tuple[str, ...],
) -> str:
    payload = {
        "fact_enrichment_batch_id": fact_enrichment_batch_id,
        "generator_version": generator_version,
        "subject_type": subject_type,
        "subject_id": subject_id,
        "locale": locale,
        "text": text,
        "based_on_assertion_ids": list(based_on_assertion_ids),
    }
    return f"translation-{sha256(canonical_json_bytes(payload)).hexdigest()}"


def build_generated_translations(
    *,
    fact_enrichment_batch_id: str,
    generator_version: str,
    generated_at: datetime,
    normalized_values: tuple[BilingualNormalizedValue, ...],
    sentences: tuple[BilingualSummarySentence, ...],
) -> tuple[tuple[str, TranslationValue], ...]:
    generated: list[tuple[str, TranslationValue]] = []
    for value in normalized_values:
        for locale, text in (("zh", value.zh_text), ("en", value.en_text)):
            translation = TranslationValue(
                translation_id=generated_translation_id(
                    fact_enrichment_batch_id=fact_enrichment_batch_id,
                    generator_version=generator_version,
                    subject_type="fact-normalized-value",
                    subject_id=value.assertion_id,
                    locale=locale,
                    text=text,
                    based_on_assertion_ids=(value.assertion_id,),
                ),
                subject_type="fact-normalized-value",
                subject_id=value.assertion_id,
                locale=locale,
                text=text,
                status=TranslationStatus.GENERATED,
                source_language=value.source_language,
                based_on_assertion_ids=(value.assertion_id,),
                generator_version=generator_version,
                generated_at=generated_at,
            )
            generated.append((value.record_id, translation))
    for sentence in sentences:
        for locale, text in (("zh", sentence.zh_text), ("en", sentence.en_text)):
            translation = TranslationValue(
                translation_id=generated_translation_id(
                    fact_enrichment_batch_id=fact_enrichment_batch_id,
                    generator_version=generator_version,
                    subject_type="summary-sentence",
                    subject_id=sentence.sentence_id,
                    locale=locale,
                    text=text,
                    based_on_assertion_ids=sentence.based_on_assertion_ids,
                ),
                subject_type="summary-sentence",
                subject_id=sentence.sentence_id,
                locale=locale,
                text=text,
                status=TranslationStatus.GENERATED,
                source_language=sentence.source_language,
                based_on_assertion_ids=sentence.based_on_assertion_ids,
                generator_version=generator_version,
                generated_at=generated_at,
            )
            generated.append((sentence.record_id, translation))
    return tuple(sorted(generated, key=lambda item: (item[0], item[1].translation_id)))


def summary_knowledge_bundle_id(
    *,
    fact_enrichment_batch_id: str,
    generator_version: str,
    bundle: PandaKnowledgeBundle,
) -> str:
    payload = {
        "fact_enrichment_batch_id": fact_enrichment_batch_id,
        "generator_version": generator_version,
        "created_at": bundle.created_at.isoformat(),
        "sources": [source.model_dump(mode="json") for source in bundle.sources],
        "records": [record.model_dump(mode="json") for record in bundle.records],
    }
    return f"knowledge-bundle-{sha256(canonical_json_bytes(payload)).hexdigest()}"


def bilingual_summary_batch_id(
    *,
    fact_enrichment: FactEnrichmentBatch,
    generator_version: str,
    generated_at: datetime,
    normalized_values: tuple[BilingualNormalizedValue, ...],
    sentences: tuple[BilingualSummarySentence, ...],
    knowledge_bundle: PandaKnowledgeBundle,
) -> str:
    payload = {
        "fact_enrichment": fact_enrichment.model_dump(mode="json"),
        "generator_version": generator_version,
        "generated_at": generated_at.isoformat(),
        "normalized_values": [value.model_dump(mode="json") for value in normalized_values],
        "sentences": [sentence.model_dump(mode="json") for sentence in sentences],
        "knowledge_bundle": knowledge_bundle.model_dump(mode="json"),
    }
    return f"bilingual-summary-batch-{sha256(canonical_json_bytes(payload)).hexdigest()}"


def _record_without_translations(record: object) -> dict[str, object]:
    payload = record.model_dump(mode="json")
    payload.pop("translations", None)
    return payload


class BilingualSummaryBatch(SummaryModel):
    schema_version: Literal[BILINGUAL_SUMMARY_SCHEMA_VERSION] = BILINGUAL_SUMMARY_SCHEMA_VERSION
    batch_id: str = Field(min_length=1)
    generator_version: str = Field(min_length=1)
    generated_at: datetime
    fact_enrichment: FactEnrichmentBatch
    normalized_values: tuple[BilingualNormalizedValue, ...]
    sentences: tuple[BilingualSummarySentence, ...]
    knowledge_bundle: PandaKnowledgeBundle
    write_boundary: dict[str, tuple[str, ...]] = Field(
        default_factory=lambda: {
            "trusted_write_targets": (),
            "publication_write_targets": (),
        }
    )

    @model_validator(mode="after")
    def validate_batch(self) -> BilingualSummaryBatch:
        if self.generated_at.tzinfo is None or self.generated_at.utcoffset() is None:
            raise ValueError("bilingual summary generation timestamp must be timezone-aware")
        if self.write_boundary != {
            "trusted_write_targets": (),
            "publication_write_targets": (),
        }:
            raise ValueError("bilingual summary batches cannot write trusted or public data")

        fact_enrichment_batch_id = self.fact_enrichment.batch_id
        base_knowledge_bundle = self.fact_enrichment.knowledge_bundle
        value_ids = tuple(value.value_id for value in self.normalized_values)
        if value_ids != tuple(sorted(set(value_ids))):
            raise ValueError("bilingual normalized values must be unique and sorted")
        sentence_ids = tuple(sentence.sentence_id for sentence in self.sentences)
        if sentence_ids != tuple(sorted(set(sentence_ids))):
            raise ValueError("bilingual summary sentences must be unique and sorted")
        if any(
            value.fact_enrichment_batch_id != fact_enrichment_batch_id
            or value.generator_version != self.generator_version
            for value in self.normalized_values
        ):
            raise ValueError("bilingual normalized value generation basis drifted")
        if any(
            sentence.fact_enrichment_batch_id != fact_enrichment_batch_id
            or sentence.generator_version != self.generator_version
            for sentence in self.sentences
        ):
            raise ValueError("bilingual summary sentence generation basis drifted")

        if base_knowledge_bundle.sources != self.knowledge_bundle.sources:
            raise ValueError("summary generation cannot change knowledge sources")
        if len(base_knowledge_bundle.records) != len(self.knowledge_bundle.records):
            raise ValueError("summary generation cannot add or remove panda records")
        for base_record, generated_record in zip(
            base_knowledge_bundle.records,
            self.knowledge_bundle.records,
            strict=True,
        ):
            if _record_without_translations(base_record) != _record_without_translations(
                generated_record
            ):
                raise ValueError("summary generation can only change translations")

        assertions_by_record = {
            record.identity.identity_key: {
                assertion.assertion_id: assertion for assertion in record.assertions
            }
            for record in base_knowledge_bundle.records
        }
        for value in self.normalized_values:
            assertion = assertions_by_record.get(value.record_id, {}).get(value.assertion_id)
            if assertion is None or assertion.field_path != value.field_path:
                raise ValueError("bilingual normalized value references an unknown assertion")
            if (
                assertion.lifecycle is not AssertionLifecycle.ACTIVE
                or assertion.confidence not in {ConfidenceBand.HIGH, ConfidenceBand.MEDIUM}
                or assertion.publication_scope is not FactPublicationScope.PUBLIC
            ):
                raise ValueError("bilingual normalized values require publishable assertions")
        for sentence in self.sentences:
            record_assertions = assertions_by_record.get(sentence.record_id, {})
            for assertion_id in sentence.based_on_assertion_ids:
                assertion = record_assertions.get(assertion_id)
                if assertion is None or assertion.field_path != sentence.field_path:
                    raise ValueError("summary sentence references an unsupported assertion")
                if (
                    assertion.lifecycle is not AssertionLifecycle.ACTIVE
                    or assertion.confidence not in {ConfidenceBand.HIGH, ConfidenceBand.MEDIUM}
                    or assertion.publication_scope is not FactPublicationScope.PUBLIC
                ):
                    raise ValueError("summary sentences require publishable assertions")

        from .bilingual_summary import build_bilingual_summary_content

        expected_values, expected_sentences = build_bilingual_summary_content(
            fact_enrichment=self.fact_enrichment,
            generator_version=self.generator_version,
        )
        if self.normalized_values != expected_values:
            raise ValueError("bilingual normalized values do not match the fact enrichment input")
        if self.sentences != expected_sentences:
            raise ValueError("summary sentences do not match the fact enrichment input")

        expected_generated = build_generated_translations(
            fact_enrichment_batch_id=fact_enrichment_batch_id,
            generator_version=self.generator_version,
            generated_at=self.generated_at,
            normalized_values=self.normalized_values,
            sentences=self.sentences,
        )
        expected_by_record: dict[str, list[TranslationValue]] = {}
        for record_id, translation in expected_generated:
            expected_by_record.setdefault(record_id, []).append(translation)
        for base_record, generated_record in zip(
            base_knowledge_bundle.records,
            self.knowledge_bundle.records,
            strict=True,
        ):
            expected = tuple(
                sorted(
                    (
                        *base_record.translations,
                        *expected_by_record.get(base_record.identity.identity_key, ()),
                    ),
                    key=lambda translation: translation.translation_id,
                )
            )
            if generated_record.translations != expected:
                raise ValueError("generated translations do not match bilingual summary pairs")

        expected_bundle_id = summary_knowledge_bundle_id(
            fact_enrichment_batch_id=fact_enrichment_batch_id,
            generator_version=self.generator_version,
            bundle=self.knowledge_bundle,
        )
        if self.knowledge_bundle.bundle_id != expected_bundle_id:
            raise ValueError("summary knowledge bundle ID does not match its content")
        expected_batch_id = bilingual_summary_batch_id(
            fact_enrichment=self.fact_enrichment,
            generator_version=self.generator_version,
            generated_at=self.generated_at,
            normalized_values=self.normalized_values,
            sentences=self.sentences,
            knowledge_bundle=self.knowledge_bundle,
        )
        if self.batch_id != expected_batch_id:
            raise ValueError("bilingual summary batch ID does not match its content")
        return self
