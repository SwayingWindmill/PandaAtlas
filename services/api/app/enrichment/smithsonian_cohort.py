from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from hashlib import sha256

from app.acquisition.contracts import (
    AcquisitionBundle,
    AcquisitionRunState,
    CandidateKind,
    ConflictState,
    FieldCandidate,
    IdentityMatchState,
    canonical_json_bytes,
)
from app.acquisition.smithsonian_pandas import ADAPTER_ID, SOURCE_ID
from app.identity_resolution import (
    CanonicalIdentityRecord,
    IdentityDecisionKind,
    IdentityFeatureSet,
    IdentityNameClaim,
    IdentityResolutionBatch,
    resolve_identity_batch,
)
from app.knowledge.contracts import (
    ConfidenceBand,
    EvidenceMode,
    SourceAccessBasis,
    SourceAssessment,
    SourceEvidence,
    SourceKind,
)

from .bilingual_summary import build_bilingual_summary_batch
from .contracts import IdentityCandidateBatch, IdentityFieldEvidence, IdentitySubjectExtraction
from .fact_contracts import ExtractedFact, FactEnrichmentBatch
from .fact_enrichment import build_fact_enrichment_batch
from .identity_intake import build_identity_candidate_batch
from .summary_contracts import BilingualSummaryBatch

_SELECTED_SLUGS = ("bao-li", "qing-bao")
_SELECTED_SUBJECT_KEYS = ("smithsonian:bao-li", "smithsonian:qing-bao")
_SUBJECT_KEY_TO_SLUG = dict(zip(_SELECTED_SUBJECT_KEYS, _SELECTED_SLUGS, strict=True))
_SUPPORTED_FACT_PATHS = {
    "identity.sex": "identity.sex",
    "identity.birth_date": "birth.date",
    "identity.birthplace": "birth.place",
    "residency.current_location": "residence.current",
}


@dataclass(frozen=True, slots=True)
class SmithsonianCurrentPairCohort:
    acquisition_bundle: AcquisitionBundle
    selected_slugs: tuple[str, ...]
    selected_candidate_ids: tuple[str, ...]
    deferred_candidate_ids: tuple[str, ...]
    out_of_scope_candidate_ids: tuple[str, ...]
    identity_candidates: IdentityCandidateBatch
    identity_resolution: IdentityResolutionBatch
    fact_enrichment: FactEnrichmentBatch
    bilingual_summary: BilingualSummaryBatch

    def __post_init__(self) -> None:
        if self.selected_slugs != _SELECTED_SLUGS:
            raise ValueError("Smithsonian current-pair cohort scope drifted")
        partitions = (
            self.selected_candidate_ids,
            self.deferred_candidate_ids,
            self.out_of_scope_candidate_ids,
        )
        for values in partitions:
            if values != tuple(sorted(set(values))):
                raise ValueError(
                    "Smithsonian cohort candidate partitions must be sorted and unique"
                )
        if any(
            set(left) & set(right)
            for index, left in enumerate(partitions)
            for right in partitions[index + 1 :]
        ):
            raise ValueError("Smithsonian cohort candidate partitions overlap")
        acquisition_ids = {
            candidate.candidate_id for candidate in self.acquisition_bundle.candidates
        }
        partition_ids = set().union(*(set(values) for values in partitions))
        if partition_ids != acquisition_ids:
            raise ValueError(
                "Smithsonian cohort candidate partitions do not cover the acquisition bundle"
            )
        if self.identity_resolution.batch_id != self.fact_enrichment.identity_resolution_batch_id:
            raise ValueError("Smithsonian cohort fact enrichment identity basis drifted")
        if self.bilingual_summary.fact_enrichment != self.fact_enrichment:
            raise ValueError("Smithsonian cohort bilingual summary fact basis drifted")

    @property
    def write_boundary(self) -> dict[str, tuple[str, ...]]:
        return {
            "trusted_write_targets": (),
            "publication_write_targets": (),
        }


def build_smithsonian_current_pair_cohort(
    *,
    acquisition_bundle: AcquisitionBundle,
    canonical_records: tuple[CanonicalIdentityRecord, ...],
    canonical_sources: tuple[SourceEvidence, ...],
    created_at: datetime,
    generated_at: datetime,
    generator_version: str,
) -> SmithsonianCurrentPairCohort:
    """Run the reviewed Smithsonian current pair through the enrichment contracts."""

    _validate_acquisition_bundle(acquisition_bundle)
    canonical_by_slug = {record.canonical_slug: record for record in canonical_records}
    if len(canonical_by_slug) != len(canonical_records):
        raise ValueError("Smithsonian current-pair canonical identities contain duplicate slugs")
    if set(canonical_by_slug) != set(_SELECTED_SLUGS):
        raise ValueError("Smithsonian current-pair cohort requires exactly Bao Li and Qing Bao")
    canonical_source_by_id = {source.source_id: source for source in canonical_sources}
    if len(canonical_source_by_id) != len(canonical_sources):
        raise ValueError("Smithsonian current-pair canonical sources contain duplicate IDs")
    required_canonical_source_ids = {
        source_id for record in canonical_records for source_id in record.source_ids
    }
    if set(canonical_source_by_id) != required_canonical_source_ids:
        raise ValueError(
            "Smithsonian current-pair canonical source inventory does not match identity provenance"
        )
    if SOURCE_ID in canonical_source_by_id:
        raise ValueError("Smithsonian source must not be duplicated in canonical source inventory")

    selected_candidates = tuple(
        candidate
        for candidate in acquisition_bundle.candidates
        if candidate.subject_key in _SELECTED_SUBJECT_KEYS
    )
    out_of_scope = tuple(
        candidate
        for candidate in acquisition_bundle.candidates
        if candidate.subject_key not in _SELECTED_SUBJECT_KEYS
    )
    if not selected_candidates:
        raise ValueError("Smithsonian current-pair acquisition produced no selected candidates")
    _validate_selected_identity_matches(selected_candidates)
    contradictions = tuple(
        candidate.candidate_id
        for candidate in selected_candidates
        if candidate.conflict_state is ConflictState.CONTRADICTION
    )
    if contradictions:
        raise ValueError("Smithsonian current-pair acquisition contains contradictions")

    identity_extractions = tuple(
        _identity_extraction_for_slug(selected_candidates, slug) for slug in _SELECTED_SLUGS
    )
    identity_candidates = build_identity_candidate_batch(identity_extractions)
    resolution = resolve_identity_batch(
        batch_id=_identity_resolution_batch_id(
            acquisition_bundle=acquisition_bundle,
            identity_candidates=identity_candidates,
        ),
        created_at=created_at,
        canonical_records=tuple(canonical_by_slug[slug] for slug in _SELECTED_SLUGS),
        candidate_records=identity_candidates.candidates,
    )
    if any(decision.kind is not IdentityDecisionKind.MERGE for decision in resolution.decisions):
        raise ValueError(
            "Smithsonian current-pair identities did not resolve as high-confidence merges"
        )
    expected_panda_ids = {canonical_by_slug[slug].panda_id for slug in _SELECTED_SLUGS}
    if {decision.canonical_panda_id for decision in resolution.decisions} != expected_panda_ids:
        raise ValueError(
            "Smithsonian current-pair identities merged into unexpected canonical records"
        )

    record_id_by_slug = {
        slug: extraction.record_id
        for slug, extraction in zip(_SELECTED_SLUGS, identity_extractions, strict=True)
    }
    facts: list[ExtractedFact] = []
    selected_ids: set[str] = set()
    deferred_ids: set[str] = set()
    snapshot_by_id = {
        snapshot.snapshot_id: snapshot for snapshot in acquisition_bundle.evidence_snapshots
    }
    for candidate in selected_candidates:
        mapped = _fact_from_candidate(
            candidate,
            record_id=record_id_by_slug[_required_matched_slug(candidate)],
            snapshot_captured_at=snapshot_by_id[candidate.evidence_snapshot_id].captured_at,
        )
        if mapped is None:
            deferred_ids.add(candidate.candidate_id)
        else:
            facts.append(mapped)
            selected_ids.add(candidate.candidate_id)

    identity_source_ids = {
        evidence.source_locator["acquisition_candidate_id"]
        for extraction in identity_extractions
        for evidence in extraction.evidence
    }
    selected_ids.update(str(candidate_id) for candidate_id in identity_source_ids)
    deferred_ids.difference_update(selected_ids)

    source = _source_evidence(acquisition_bundle)
    fact_enrichment = build_fact_enrichment_batch(
        created_at=created_at,
        identity_resolution=resolution,
        sources=tuple(sorted((*canonical_sources, source), key=lambda item: item.source_id)),
        facts=tuple(facts),
    )
    bilingual_summary = build_bilingual_summary_batch(
        fact_enrichment=fact_enrichment,
        generator_version=generator_version,
        generated_at=generated_at,
    )
    return SmithsonianCurrentPairCohort(
        acquisition_bundle=acquisition_bundle,
        selected_slugs=_SELECTED_SLUGS,
        selected_candidate_ids=tuple(sorted(selected_ids)),
        deferred_candidate_ids=tuple(sorted(deferred_ids)),
        out_of_scope_candidate_ids=tuple(
            sorted(candidate.candidate_id for candidate in out_of_scope)
        ),
        identity_candidates=identity_candidates,
        identity_resolution=resolution,
        fact_enrichment=fact_enrichment,
        bilingual_summary=bilingual_summary,
    )


def _validate_acquisition_bundle(bundle: AcquisitionBundle) -> None:
    if bundle.run.source_id != SOURCE_ID or bundle.run.adapter_id != ADAPTER_ID:
        raise ValueError("Smithsonian cohort requires the reviewed Smithsonian adapter bundle")
    if bundle.run.state is not AcquisitionRunState.COMPLETED:
        raise ValueError("Smithsonian cohort requires a completed acquisition run")
    if bundle.trusted_write_targets or bundle.publication_write_targets:
        raise ValueError("Smithsonian acquisition bundle exposed forbidden write targets")


def _validate_selected_identity_matches(candidates: tuple[FieldCandidate, ...]) -> None:
    subject_keys = {candidate.subject_key for candidate in candidates}
    if subject_keys != set(_SELECTED_SUBJECT_KEYS):
        raise ValueError("Smithsonian current-pair source-local subjects are incomplete")
    for candidate in candidates:
        expected_slug = _SUBJECT_KEY_TO_SLUG[candidate.subject_key]
        if (
            candidate.identity_match.state is not IdentityMatchState.MATCHED
            or candidate.identity_match.matched_canonical_slug != expected_slug
        ):
            raise ValueError(
                "Smithsonian current-pair selected candidates lack "
                "conservative source reconciliation"
            )


def _identity_extraction_for_slug(
    candidates: tuple[FieldCandidate, ...],
    slug: str,
) -> IdentitySubjectExtraction:
    subject_candidates = tuple(
        candidate
        for candidate in candidates
        if candidate.identity_match.matched_canonical_slug == slug
    )
    subject_keys = {candidate.subject_key for candidate in subject_candidates}
    if len(subject_keys) != 1:
        raise ValueError(f"Smithsonian subject {slug} did not have one source-local key")
    subject_key = next(iter(subject_keys))

    name_candidates = tuple(
        candidate
        for candidate in subject_candidates
        if candidate.field_path == "identity.names.official.en"
        and _value_present(candidate.normalized_value)
    )
    name_values = tuple(sorted({str(candidate.normalized_value) for candidate in name_candidates}))
    if len(name_values) != 1:
        raise ValueError(f"Smithsonian subject {slug} did not have one official English name")
    sex_candidates = tuple(
        candidate
        for candidate in subject_candidates
        if candidate.field_path == "identity.sex" and _value_present(candidate.normalized_value)
    )
    sex_values = tuple(
        sorted({_normalized_sex(candidate.normalized_value) for candidate in sex_candidates})
    )
    if len(sex_values) != 1:
        raise ValueError(f"Smithsonian subject {slug} did not have one sex value")
    birth_candidates = tuple(
        candidate
        for candidate in subject_candidates
        if candidate.field_path == "identity.birth_date"
        and _value_present(candidate.normalized_value)
    )
    birth_values = tuple(
        sorted({_normalized_day(candidate.normalized_value) for candidate in birth_candidates})
    )
    if len(birth_values) != 1:
        raise ValueError(f"Smithsonian subject {slug} did not have one day-precision birth date")

    evidence = tuple(
        sorted(
            (
                *(
                    _identity_evidence(
                        candidate, field_path="identity.names", normalized_value=name_values[0]
                    )
                    for candidate in name_candidates
                ),
                *(
                    _identity_evidence(
                        candidate, field_path="identity.sex", normalized_value=sex_values[0]
                    )
                    for candidate in sex_candidates
                ),
                *(
                    _identity_evidence(
                        candidate,
                        field_path="identity.birth_date",
                        normalized_value=birth_values[0],
                    )
                    for candidate in birth_candidates
                ),
            ),
            key=lambda item: (
                item.field_path,
                item.evidence_snapshot_id,
                str(item.source_locator["value"]),
            ),
        )
    )
    return IdentitySubjectExtraction(
        source_id=SOURCE_ID,
        intake_candidate_id=min(candidate.candidate_id for candidate in name_candidates),
        subject_key=subject_key,
        names=(
            IdentityNameClaim(
                value=name_values[0],
                language="en",
                kind="official",
                normalized_forms=(name_values[0].casefold(),),
            ),
        ),
        features=IdentityFeatureSet(
            birth_date=date.fromisoformat(birth_values[0]),
            sex=sex_values[0],
        ),
        evidence=evidence,
    )


def _identity_evidence(
    candidate: FieldCandidate,
    *,
    field_path: str,
    normalized_value: object,
) -> IdentityFieldEvidence:
    return IdentityFieldEvidence(
        evidence_snapshot_id=candidate.evidence_snapshot_id,
        evidence_body_sha256=candidate.evidence_body_sha256,
        field_path=field_path,
        raw_value=candidate.raw_value,
        normalized_value=normalized_value,
        language="en",
        source_locator=_source_locator(candidate),
        parser_name=candidate.parser_name,
        parser_version=candidate.parser_version,
    )


def _fact_from_candidate(
    candidate: FieldCandidate,
    *,
    record_id: str,
    snapshot_captured_at: datetime,
) -> ExtractedFact | None:
    if not _value_present(candidate.normalized_value):
        return None
    if candidate.candidate_kind is CandidateKind.RELATIONSHIP:
        return None
    if candidate.field_path.startswith("identity.names."):
        return None

    if candidate.candidate_kind is CandidateKind.EVENT or candidate.field_path == "event":
        if not isinstance(candidate.normalized_value, dict):
            raise ValueError("Smithsonian event candidate did not normalize to an object")
        event_type = candidate.normalized_value.get("event_type")
        if not isinstance(event_type, str) or not event_type.strip():
            raise ValueError("Smithsonian event candidate is missing its event type")
        field_path = f"events.{event_type.strip().casefold()}"
        normalized_value = candidate.normalized_value
    else:
        field_path = _SUPPORTED_FACT_PATHS.get(candidate.field_path)
        if field_path is None:
            return None
        if candidate.field_path == "identity.birth_date":
            normalized_value = _normalized_day(candidate.normalized_value)
        elif candidate.field_path == "identity.sex":
            normalized_value = _normalized_sex(candidate.normalized_value)
        else:
            normalized_value = candidate.normalized_value

    return ExtractedFact(
        record_id=record_id,
        source_id=SOURCE_ID,
        intake_candidate_id=candidate.candidate_id,
        field_path=field_path,
        raw_value=candidate.raw_value,
        normalized_value=normalized_value,
        language="en",
        confidence=_confidence(candidate.conflict_state),
        evidence_mode=EvidenceMode.DIRECT,
        last_verified_at=snapshot_captured_at.date(),
        evidence_snapshot_id=candidate.evidence_snapshot_id,
        evidence_body_sha256=candidate.evidence_body_sha256,
        source_locator=_source_locator(candidate),
        parser_name=candidate.parser_name,
        parser_version=candidate.parser_version,
    )


def _confidence(conflict_state: ConflictState) -> ConfidenceBand:
    if conflict_state is ConflictState.CONTRADICTION:
        raise ValueError("contradictory Smithsonian candidates cannot enter fact enrichment")
    if conflict_state in {ConflictState.UNCHANGED, ConflictState.ENRICHMENT}:
        return ConfidenceBand.HIGH
    return ConfidenceBand.MEDIUM


def _source_evidence(bundle: AcquisitionBundle) -> SourceEvidence:
    profile = next(
        (
            snapshot
            for snapshot in bundle.evidence_snapshots
            if snapshot.final_url.rstrip("/").endswith("/animals/giant-panda")
        ),
        None,
    )
    if profile is None:
        raise ValueError("Smithsonian cohort is missing the reviewed giant panda profile snapshot")
    return SourceEvidence(
        source_id=SOURCE_ID,
        kind=SourceKind.OFFICIAL_INSTITUTION,
        access_basis=SourceAccessBasis.PUBLIC,
        publisher="Smithsonian's National Zoo and Conservation Biology Institute",
        title="Reviewed Smithsonian giant panda profile, FAQ, and history pages",
        url=profile.final_url,
        original_language="en",
        captured_at=max(snapshot.captured_at for snapshot in bundle.evidence_snapshots),
        is_first_hand=True,
        assessment=SourceAssessment(
            confidence=ConfidenceBand.HIGH,
            authority_score=100,
            recency_score=90,
            specificity_score=95,
            consistency_score=100,
            corroboration_score=85,
            rationale=(
                "reviewed-exact-url-official-institution",
                "fixture-locked-production-parser",
            ),
        ),
    )


def _source_locator(candidate: FieldCandidate) -> dict[str, object]:
    return {
        "kind": candidate.source_locator.kind.value,
        "value": candidate.source_locator.value,
        "acquisition_candidate_id": candidate.candidate_id,
        "acquisition_field_path": candidate.field_path,
        "acquisition_normalized_value": candidate.normalized_value,
    }


def _required_matched_slug(candidate: FieldCandidate) -> str:
    slug = candidate.identity_match.matched_canonical_slug
    if slug is None:
        raise ValueError("Smithsonian selected candidate is missing its matched slug")
    return slug


def _normalized_day(value: object) -> str:
    if not isinstance(value, dict):
        raise ValueError("Smithsonian date candidate did not normalize to an object")
    normalized = value.get("value")
    precision = value.get("precision")
    if not isinstance(normalized, str) or precision != "day":
        raise ValueError("Smithsonian current-pair dates require day precision")
    date.fromisoformat(normalized)
    return normalized


def _normalized_sex(value: object) -> str:
    if not isinstance(value, str):
        raise ValueError("Smithsonian sex candidate did not normalize to text")
    normalized = value.strip().casefold()
    if normalized not in {"male", "female"}:
        raise ValueError("Smithsonian current-pair sex value is outside the reviewed vocabulary")
    return normalized


def _value_present(value: object) -> bool:
    return value is not None and value != "" and value != [] and value != {}


def _identity_resolution_batch_id(
    *,
    acquisition_bundle: AcquisitionBundle,
    identity_candidates: IdentityCandidateBatch,
) -> str:
    digest = sha256(
        canonical_json_bytes(
            {
                "acquisition_run_id": acquisition_bundle.run.run_id,
                "identity_candidate_batch_id": identity_candidates.batch_id,
                "selected_slugs": list(_SELECTED_SLUGS),
            }
        )
    ).hexdigest()
    return f"identity-resolution-smithsonian-current-pair-{digest}"


__all__ = [
    "SmithsonianCurrentPairCohort",
    "build_smithsonian_current_pair_cohort",
]
