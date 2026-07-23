from __future__ import annotations

from datetime import date, datetime

from app.knowledge.contracts import (
    AssertionLifecycle,
    ConclusionStatus,
    ConfidenceBand,
    EvidenceMode,
    FactAssertion,
    FactPublicationScope,
    PandaKnowledgeBundle,
    PandaKnowledgeRecord,
)

from .fact_contracts import FactEnrichmentBatch
from .summary_contracts import (
    BilingualNormalizedValue,
    BilingualSummaryBatch,
    BilingualSummarySentence,
    bilingual_sentence_id,
    bilingual_summary_batch_id,
    bilingual_value_id,
    build_generated_translations,
    summary_knowledge_bundle_id,
)

_MONTH_NAMES = (
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
)

_SEX_VALUES = {
    "female": ("雌性", "female"),
    "male": ("雄性", "male"),
    "unknown": ("未知", "unknown"),
}

_STATUS_VALUES = {
    "alive": ("存活", "alive"),
    "deceased": ("已死亡", "deceased"),
    "captive": ("圈养", "captive"),
    "released": ("已放归", "released"),
    "wild": ("野生", "wild"),
    "unknown": ("未知", "unknown"),
}


def build_bilingual_summary_batch(
    *,
    fact_enrichment: FactEnrichmentBatch,
    generator_version: str,
    generated_at: datetime,
) -> BilingualSummaryBatch:
    """Generate deterministic Chinese and English values and traceable summary sentences."""

    if generated_at.tzinfo is None or generated_at.utcoffset() is None:
        raise ValueError("bilingual summary generation timestamp must be timezone-aware")

    base_bundle = fact_enrichment.knowledge_bundle
    ordered_values, ordered_sentences = build_bilingual_summary_content(
        fact_enrichment=fact_enrichment,
        generator_version=generator_version,
    )
    generated_translations = build_generated_translations(
        fact_enrichment_batch_id=fact_enrichment.batch_id,
        generator_version=generator_version,
        generated_at=generated_at,
        normalized_values=ordered_values,
        sentences=ordered_sentences,
    )
    generated_by_record: dict[str, list[object]] = {}
    for record_id, translation in generated_translations:
        generated_by_record.setdefault(record_id, []).append(translation)

    records = tuple(
        PandaKnowledgeRecord(
            **{
                **record.model_dump(mode="python"),
                "translations": tuple(
                    sorted(
                        (
                            *record.translations,
                            *generated_by_record.get(record.identity.identity_key, ()),
                        ),
                        key=lambda translation: translation.translation_id,
                    )
                ),
            }
        )
        for record in base_bundle.records
    )
    draft_bundle = PandaKnowledgeBundle(
        bundle_id="knowledge-bundle-pending",
        created_at=generated_at,
        sources=base_bundle.sources,
        records=records,
    )
    knowledge_bundle = PandaKnowledgeBundle(
        bundle_id=summary_knowledge_bundle_id(
            fact_enrichment_batch_id=fact_enrichment.batch_id,
            generator_version=generator_version,
            bundle=draft_bundle,
        ),
        created_at=generated_at,
        sources=base_bundle.sources,
        records=records,
    )
    return BilingualSummaryBatch(
        batch_id=bilingual_summary_batch_id(
            fact_enrichment=fact_enrichment,
            generator_version=generator_version,
            generated_at=generated_at,
            normalized_values=ordered_values,
            sentences=ordered_sentences,
            knowledge_bundle=knowledge_bundle,
        ),
        generator_version=generator_version,
        generated_at=generated_at,
        fact_enrichment=fact_enrichment,
        normalized_values=ordered_values,
        sentences=ordered_sentences,
        knowledge_bundle=knowledge_bundle,
    )


def build_bilingual_summary_content(
    *,
    fact_enrichment: FactEnrichmentBatch,
    generator_version: str,
) -> tuple[tuple[BilingualNormalizedValue, ...], tuple[BilingualSummarySentence, ...]]:
    """Recompute bilingual values and sentences from one immutable fact batch."""

    if not generator_version.strip():
        raise ValueError("bilingual summary generator version cannot be empty")

    base_bundle = fact_enrichment.knowledge_bundle
    source_language_by_assertion = {fact.fact_id: fact.language for fact in fact_enrichment.facts}
    normalized_values: list[BilingualNormalizedValue] = []
    sentences: list[BilingualSummarySentence] = []

    for record in base_bundle.records:
        assertions_by_id = {assertion.assertion_id: assertion for assertion in record.assertions}
        localized_by_assertion: dict[str, tuple[str, str]] = {}
        for assertion in record.assertions:
            if not _is_publishable(assertion):
                continue
            localized = _localize_value(assertion.field_path, assertion.normalized_value)
            if localized is None:
                continue
            zh_text, en_text = localized
            localized_by_assertion[assertion.assertion_id] = localized
            normalized_values.append(
                BilingualNormalizedValue(
                    value_id=bilingual_value_id(
                        fact_enrichment_batch_id=fact_enrichment.batch_id,
                        generator_version=generator_version,
                        record_id=record.identity.identity_key,
                        assertion_id=assertion.assertion_id,
                        field_path=assertion.field_path,
                        zh_text=zh_text,
                        en_text=en_text,
                    ),
                    fact_enrichment_batch_id=fact_enrichment.batch_id,
                    generator_version=generator_version,
                    record_id=record.identity.identity_key,
                    assertion_id=assertion.assertion_id,
                    field_path=assertion.field_path,
                    source_language=source_language_by_assertion.get(
                        assertion.assertion_id,
                        "und",
                    ),
                    zh_text=zh_text,
                    en_text=en_text,
                )
            )

        for conclusion in record.conclusions:
            if conclusion.status not in {
                ConclusionStatus.CONFIRMED,
                ConclusionStatus.TENTATIVE,
            }:
                continue
            if conclusion.primary_assertion_id is None:
                continue
            assertion = assertions_by_id.get(conclusion.primary_assertion_id)
            localized = localized_by_assertion.get(conclusion.primary_assertion_id)
            if assertion is None or localized is None:
                continue
            sentence_text = _summary_sentence(
                assertion=assertion,
                status=conclusion.status,
                zh_value=localized[0],
                en_value=localized[1],
            )
            if sentence_text is None:
                continue
            zh_text, en_text = sentence_text
            basis = (assertion.assertion_id,)
            sentence_key = f"summary.{assertion.field_path}"
            sentences.append(
                BilingualSummarySentence(
                    sentence_id=bilingual_sentence_id(
                        fact_enrichment_batch_id=fact_enrichment.batch_id,
                        generator_version=generator_version,
                        record_id=record.identity.identity_key,
                        sentence_key=sentence_key,
                        field_path=assertion.field_path,
                        based_on_assertion_ids=basis,
                        zh_text=zh_text,
                        en_text=en_text,
                    ),
                    fact_enrichment_batch_id=fact_enrichment.batch_id,
                    generator_version=generator_version,
                    record_id=record.identity.identity_key,
                    sentence_key=sentence_key,
                    field_path=assertion.field_path,
                    based_on_assertion_ids=basis,
                    source_language=source_language_by_assertion.get(
                        assertion.assertion_id,
                        "und",
                    ),
                    zh_text=zh_text,
                    en_text=en_text,
                )
            )

    return (
        tuple(sorted(normalized_values, key=lambda value: value.value_id)),
        tuple(sorted(sentences, key=lambda sentence: sentence.sentence_id)),
    )


def _is_publishable(assertion: FactAssertion) -> bool:
    return (
        assertion.lifecycle is AssertionLifecycle.ACTIVE
        and assertion.confidence in {ConfidenceBand.HIGH, ConfidenceBand.MEDIUM}
        and assertion.publication_scope is FactPublicationScope.PUBLIC
    )


def _localize_value(field_path: str, value: object) -> tuple[str, str] | None:
    if field_path in {"birth.date", "death.date"}:
        parsed = _parse_iso_date(value)
        if parsed is None:
            return None
        return (
            f"{parsed.year}年{parsed.month}月{parsed.day}日",
            f"{_MONTH_NAMES[parsed.month]} {parsed.day}, {parsed.year}",
        )
    if field_path == "birth.year":
        year = _parse_year(value)
        if year is None:
            return None
        return (f"{year}年", str(year))
    if field_path == "identity.sex" and isinstance(value, str):
        return _SEX_VALUES.get(value.casefold())
    if field_path == "status.current" and isinstance(value, str):
        return _STATUS_VALUES.get(value.casefold())
    if field_path in {"residence.current", "death.cause"}:
        return _explicit_bilingual_value(value)
    return None


def _summary_sentence(
    *,
    assertion: FactAssertion,
    status: ConclusionStatus,
    zh_value: str,
    en_value: str,
) -> tuple[str, str] | None:
    labels = {
        "birth.date": ("出生日期", "Birth date"),
        "birth.year": ("出生年份", "Birth year"),
        "identity.sex": ("性别", "Sex"),
        "status.current": ("当前状态", "Current status"),
        "residence.current": ("当前居住地", "Current residence"),
        "death.date": ("死亡日期", "Death date"),
        "death.cause": ("死亡原因", "Cause of death"),
    }
    labels_for_field = labels.get(assertion.field_path)
    if labels_for_field is None:
        return None
    zh_label, en_label = labels_for_field
    if assertion.evidence_mode is EvidenceMode.INFERRED:
        return (
            f"推断{zh_label}：{zh_value}。",
            f"Inferred {en_label.casefold()}: {en_value}.",
        )
    if status is ConclusionStatus.TENTATIVE:
        return (
            f"据报道，{zh_label}：{zh_value}。",
            f"Reported {en_label.casefold()}: {en_value}.",
        )
    return (f"{zh_label}：{zh_value}。", f"{en_label}: {en_value}.")


def _parse_iso_date(value: object) -> date | None:
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _parse_year(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int) and 1800 <= value <= 2200:
        return value
    if isinstance(value, str) and value.isdigit():
        year = int(value)
        if 1800 <= year <= 2200:
            return year
    return None


def _explicit_bilingual_value(value: object) -> tuple[str, str] | None:
    if not isinstance(value, dict):
        return None
    zh_text = value.get("zh")
    en_text = value.get("en")
    if not isinstance(zh_text, str) or not zh_text.strip():
        return None
    if not isinstance(en_text, str) or not en_text.strip():
        return None
    return (zh_text.strip(), en_text.strip())
