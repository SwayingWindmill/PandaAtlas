from __future__ import annotations

import unicodedata
from collections import Counter
from collections.abc import Iterable
from datetime import datetime
from hashlib import sha256

from app.acquisition.contracts import canonical_json_bytes
from app.knowledge.contracts import (
    ConfidenceBand,
    IdentityResolutionState,
    PandaIdentity,
    PopulationContext,
)
from app.knowledge.contracts import (
    ExternalIdentifier as KnowledgeExternalIdentifier,
)
from app.knowledge.contracts import (
    IdentityName as KnowledgeIdentityName,
)
from app.knowledge.contracts import (
    IdentityResolution as KnowledgeIdentityResolution,
)

from .contracts import (
    HIGH_MATCH_SCORE,
    MATCH_AMBIGUITY_MARGIN,
    MEDIUM_MATCH_SCORE,
    CanonicalIdentityRecord,
    IdentityBatchSummary,
    IdentityCandidateRecord,
    IdentityDecision,
    IdentityDecisionKind,
    IdentityEvidence,
    IdentityFeatureSet,
    IdentityMatchScore,
    IdentityResolutionBatch,
)


def _build_candidate_index(
    canonical_records: tuple[CanonicalIdentityRecord, ...],
) -> dict[str, tuple[str, ...]]:
    index: dict[str, set[str]] = {}
    for record in canonical_records:
        for key in _identity_index_keys(record.names, record.features):
            index.setdefault(key, set()).add(record.panda_id)
    return {key: tuple(sorted(panda_ids)) for key, panda_ids in index.items()}


def _candidate_panda_ids(
    candidate: IdentityCandidateRecord,
    index: dict[str, tuple[str, ...]],
) -> tuple[str, ...]:
    panda_ids: set[str] = set()
    for key in _identity_index_keys(candidate.names, candidate.features):
        panda_ids.update(index.get(key, ()))
    return tuple(sorted(panda_ids))


def _identity_index_keys(
    names: tuple[object, ...],
    features: IdentityFeatureSet,
) -> tuple[str, ...]:
    keys = {f"name:{value}" for value in _name_forms(names)}
    keys.update(f"identifier:{system}:{value}" for system, value in _identifier_keys(features))
    if features.birth_date is not None:
        keys.add(f"birth-date:{features.birth_date.isoformat()}")
    if features.birth_year is not None:
        keys.add(f"birth-year:{features.birth_year}")
    keys.update(f"parent-id:{value}" for value in features.parent_ids)
    keys.update(f"parent-name:{value}" for value in _normalized_values(features.parent_names))
    keys.update(f"institution:{value}" for value in features.institution_ids)
    keys.update(f"movement:{value}" for value in features.movement_institution_ids)
    keys.update(f"source-relationship:{value}" for value in features.source_relationship_ids)
    return tuple(sorted(keys))


def resolve_identity_batch(
    *,
    batch_id: str,
    created_at: datetime,
    canonical_records: tuple[CanonicalIdentityRecord, ...],
    candidate_records: tuple[IdentityCandidateRecord, ...],
) -> IdentityResolutionBatch:
    """Resolve candidate records without writing canonical or public storage."""

    canonical_by_id = {record.panda_id: record for record in canonical_records}
    if len(canonical_by_id) != len(canonical_records):
        raise ValueError("canonical identity input contains duplicate panda IDs")
    candidate_ids = [record.record_id for record in candidate_records]
    if len(candidate_ids) != len(set(candidate_ids)):
        raise ValueError("identity candidate input contains duplicate record IDs")

    candidate_index = _build_candidate_index(canonical_records)
    decisions = tuple(
        sorted(
            (
                _resolve_candidate(
                    candidate,
                    tuple(
                        canonical_by_id[panda_id]
                        for panda_id in _candidate_panda_ids(candidate, candidate_index)
                    ),
                )
                for candidate in candidate_records
            ),
            key=lambda decision: decision.record_id,
        )
    )
    counts = Counter(decision.kind for decision in decisions)
    candidate_by_id = {record.record_id: record for record in candidate_records}
    validation_candidates = tuple(
        _build_validation_identity(
            candidate_by_id[decision.record_id],
            decision,
            canonical_by_id,
        )
        for decision in decisions
        if decision.public_eligible
    )
    public_ids = tuple(decision.record_id for decision in decisions if decision.public_eligible)
    unresolved_ids = tuple(
        decision.record_id
        for decision in decisions
        if decision.kind is IdentityDecisionKind.UNRESOLVED
    )
    review_ids = tuple(
        decision.record_id for decision in decisions if decision.kind is IdentityDecisionKind.REVIEW
    )
    return IdentityResolutionBatch(
        batch_id=batch_id,
        created_at=created_at,
        decisions=decisions,
        validation_candidates=validation_candidates,
        public_candidate_record_ids=public_ids,
        unresolved_record_ids=unresolved_ids,
        review_record_ids=review_ids,
        summary=IdentityBatchSummary(
            canonical_count=len(canonical_records),
            candidate_count=len(candidate_records),
            merge_count=counts[IdentityDecisionKind.MERGE],
            review_count=counts[IdentityDecisionKind.REVIEW],
            create_count=counts[IdentityDecisionKind.CREATE],
            unresolved_count=counts[IdentityDecisionKind.UNRESOLVED],
            rejected_group_count=counts[IdentityDecisionKind.REJECT_GROUP],
        ),
    )


def _resolve_candidate(
    candidate: IdentityCandidateRecord,
    canonical_records: tuple[CanonicalIdentityRecord, ...],
) -> IdentityDecision:
    if candidate.features.is_group_observation:
        return IdentityDecision(
            record_id=candidate.record_id,
            kind=IdentityDecisionKind.REJECT_GROUP,
            confidence=ConfidenceBand.LOW,
            public_eligible=False,
            rationale=(
                "The source describes a group observation, not a stable individual identity.",
            ),
        )

    scores = tuple(
        sorted(
            (_score_candidate(candidate, canonical) for canonical in canonical_records),
            key=lambda item: (-item.score, item.panda_id),
        )
    )
    plausible_ids = tuple(
        score.panda_id for score in scores if score.confidence is not ConfidenceBand.LOW
    )

    if not candidate.features.has_auxiliary_identity_feature():
        return IdentityDecision(
            record_id=candidate.record_id,
            kind=IdentityDecisionKind.UNRESOLVED,
            confidence=ConfidenceBand.LOW,
            candidate_panda_ids=plausible_ids,
            scores=scores,
            public_eligible=False,
            rationale=(
                "The candidate has a sourced name but no auxiliary identity feature.",
                "Name-only records remain internal until identity evidence is added.",
            ),
        )

    top = scores[0] if scores else None
    second = scores[1] if len(scores) > 1 else None
    if top is not None and top.confidence is ConfidenceBand.HIGH:
        if second is None or second.score <= top.score - MATCH_AMBIGUITY_MARGIN:
            return IdentityDecision(
                record_id=candidate.record_id,
                kind=IdentityDecisionKind.MERGE,
                confidence=ConfidenceBand.HIGH,
                canonical_panda_id=top.panda_id,
                candidate_panda_ids=(top.panda_id,),
                scores=scores,
                public_eligible=True,
                rationale=(
                    f"Unique high-confidence identity match to {top.panda_id}.",
                    *tuple(evidence.detail for evidence in top.evidence),
                ),
            )

    if top is not None and top.confidence is not ConfidenceBand.LOW:
        near_top_ids = tuple(
            score.panda_id
            for score in scores
            if score.score >= top.score - MATCH_AMBIGUITY_MARGIN
            and score.confidence is not ConfidenceBand.LOW
        )
        return IdentityDecision(
            record_id=candidate.record_id,
            kind=IdentityDecisionKind.REVIEW,
            confidence=ConfidenceBand.MEDIUM,
            candidate_panda_ids=near_top_ids,
            scores=scores,
            public_eligible=False,
            rationale=(
                "The best identity match is medium-confidence or not uniquely separated.",
                "A reviewer must choose, reject, or add identity evidence.",
            ),
        )

    if (
        top is not None
        and top.hard_conflicts
        and any(evidence.code == "external-identifier-match" for evidence in top.evidence)
    ):
        return IdentityDecision(
            record_id=candidate.record_id,
            kind=IdentityDecisionKind.REVIEW,
            confidence=ConfidenceBand.MEDIUM,
            candidate_panda_ids=(top.panda_id,),
            scores=scores,
            public_eligible=False,
            rationale=(
                "A stable external identifier matches an existing panda, "
                "but identity fields conflict.",
                "The conflict must be corrected or explicitly split before publication.",
            ),
        )

    created_id = _created_panda_id(candidate)
    conflict_rationale = ()
    if top is not None and top.hard_conflicts:
        conflict_rationale = (
            "Existing same-name candidates contain incompatible identity features: "
            + ", ".join(top.hard_conflicts),
        )
    return IdentityDecision(
        record_id=candidate.record_id,
        kind=IdentityDecisionKind.CREATE,
        confidence=ConfidenceBand.HIGH,
        created_panda_id=created_id,
        candidate_panda_ids=(),
        scores=scores,
        public_eligible=True,
        rationale=(
            "No plausible canonical identity match remained after deterministic scoring.",
            "The candidate has a sourced name and at least one auxiliary identity feature.",
            *conflict_rationale,
        ),
    )


def _score_candidate(
    candidate: IdentityCandidateRecord,
    canonical: CanonicalIdentityRecord,
) -> IdentityMatchScore:
    evidence: list[IdentityEvidence] = []
    hard_conflicts: list[str] = []

    candidate_names = _name_forms(candidate.names)
    canonical_names = _name_forms(canonical.names)
    shared_names = sorted(candidate_names & canonical_names)
    if shared_names:
        evidence.append(
            IdentityEvidence(
                code="name-match",
                label="Name or alias match",
                weight=400,
                detail=f"Shared normalized name form: {shared_names[0]}.",
            )
        )

    candidate_identifiers = _identifier_keys(candidate.features)
    canonical_identifiers = _identifier_keys(canonical.features)
    shared_identifiers = sorted(candidate_identifiers & canonical_identifiers)
    if shared_identifiers:
        system, value = shared_identifiers[0]
        evidence.append(
            IdentityEvidence(
                code="external-identifier-match",
                label="Stable identifier match",
                weight=900,
                detail=f"Shared stable identifier {system}:{value}.",
            )
        )

    _score_birth(candidate.features, canonical.features, evidence, hard_conflicts)
    _score_sex(candidate.features, canonical.features, evidence, hard_conflicts)
    _score_overlap(
        candidate.features.parent_ids,
        canonical.features.parent_ids,
        code="parent-id-match",
        label="Parent identity match",
        weight=180,
        evidence=evidence,
    )
    _score_overlap(
        _normalized_values(candidate.features.parent_names),
        _normalized_values(canonical.features.parent_names),
        code="parent-name-match",
        label="Parent name match",
        weight=140,
        evidence=evidence,
    )
    _score_overlap(
        candidate.features.institution_ids,
        canonical.features.institution_ids,
        code="institution-match",
        label="Institution match",
        weight=90,
        evidence=evidence,
    )
    _score_overlap(
        candidate.features.movement_institution_ids,
        canonical.features.movement_institution_ids,
        code="movement-match",
        label="Movement history match",
        weight=60,
        evidence=evidence,
    )
    _score_overlap(
        candidate.features.source_relationship_ids,
        canonical.features.source_relationship_ids,
        code="source-relationship-match",
        label="Source relationship match",
        weight=100,
        evidence=evidence,
    )
    _score_population_context(candidate, canonical, evidence)

    score = sum(item.weight for item in evidence)
    confidence = _confidence_for_score(score, hard_conflicts)
    return IdentityMatchScore(
        panda_id=canonical.panda_id,
        score=score,
        confidence=confidence,
        evidence=tuple(sorted(evidence, key=lambda item: (item.code, item.detail))),
        hard_conflicts=tuple(sorted(hard_conflicts)),
    )


def _score_birth(
    candidate: IdentityFeatureSet,
    canonical: IdentityFeatureSet,
    evidence: list[IdentityEvidence],
    hard_conflicts: list[str],
) -> None:
    if candidate.birth_date is not None and canonical.birth_date is not None:
        if candidate.birth_date == canonical.birth_date:
            evidence.append(
                IdentityEvidence(
                    code="birth-date-match",
                    label="Birth date match",
                    weight=260,
                    detail=f"Both records state birth date {candidate.birth_date.isoformat()}.",
                )
            )
        else:
            evidence.append(
                IdentityEvidence(
                    code="birth-date-conflict",
                    label="Birth date conflict",
                    weight=-450,
                    detail=(
                        f"Candidate birth date {candidate.birth_date.isoformat()} conflicts with "
                        f"{canonical.birth_date.isoformat()}."
                    ),
                    conflict=True,
                )
            )
            hard_conflicts.append("birth-date-conflict")
        return
    if candidate.birth_year is not None and canonical.birth_year is not None:
        if candidate.birth_year == canonical.birth_year:
            evidence.append(
                IdentityEvidence(
                    code="birth-year-match",
                    label="Birth year match",
                    weight=180,
                    detail=f"Both records state birth year {candidate.birth_year}.",
                )
            )
        else:
            evidence.append(
                IdentityEvidence(
                    code="birth-year-conflict",
                    label="Birth year conflict",
                    weight=-260,
                    detail=(
                        f"Candidate birth year {candidate.birth_year} conflicts with "
                        f"{canonical.birth_year}."
                    ),
                    conflict=True,
                )
            )
            hard_conflicts.append("birth-year-conflict")


def _score_sex(
    candidate: IdentityFeatureSet,
    canonical: IdentityFeatureSet,
    evidence: list[IdentityEvidence],
    hard_conflicts: list[str],
) -> None:
    if candidate.sex is None or canonical.sex is None:
        return
    candidate_sex = _normalize(candidate.sex)
    canonical_sex = _normalize(canonical.sex)
    if candidate_sex == canonical_sex:
        evidence.append(
            IdentityEvidence(
                code="sex-match",
                label="Sex match",
                weight=60,
                detail=f"Both records state sex {candidate.sex}.",
            )
        )
    else:
        evidence.append(
            IdentityEvidence(
                code="sex-conflict",
                label="Sex conflict",
                weight=-150,
                detail=f"Candidate sex {candidate.sex} conflicts with {canonical.sex}.",
                conflict=True,
            )
        )
        hard_conflicts.append("sex-conflict")


def _score_overlap(
    candidate_values: Iterable[str],
    canonical_values: Iterable[str],
    *,
    code: str,
    label: str,
    weight: int,
    evidence: list[IdentityEvidence],
) -> None:
    shared = sorted(set(candidate_values) & set(canonical_values))
    if not shared:
        return
    evidence.append(
        IdentityEvidence(
            code=code,
            label=label,
            weight=weight,
            detail=f"Shared {label.casefold()}: {shared[0]}.",
        )
    )


def _score_population_context(
    candidate: IdentityCandidateRecord,
    canonical: CanonicalIdentityRecord,
    evidence: list[IdentityEvidence],
) -> None:
    if (
        candidate.population_context is PopulationContext.UNKNOWN
        or canonical.population_context is PopulationContext.UNKNOWN
    ):
        return
    if candidate.population_context is canonical.population_context:
        evidence.append(
            IdentityEvidence(
                code="population-context-match",
                label="Population context match",
                weight=30,
                detail=f"Both records use population context {candidate.population_context.value}.",
            )
        )


def _confidence_for_score(score: int, hard_conflicts: list[str]) -> ConfidenceBand:
    if score >= HIGH_MATCH_SCORE and not hard_conflicts:
        return ConfidenceBand.HIGH
    if score >= MEDIUM_MATCH_SCORE and not hard_conflicts:
        return ConfidenceBand.MEDIUM
    return ConfidenceBand.LOW


def _name_forms(names: Iterable[object]) -> set[str]:
    forms: set[str] = set()
    for name in names:
        value = name.value
        forms.add(_normalize(value))
        for normalized_form in name.normalized_forms:
            forms.add(_normalize(normalized_form))
    forms.discard("")
    return forms


def _identifier_keys(features: IdentityFeatureSet) -> set[tuple[str, str]]:
    keys = {
        (_normalize(identifier.system), _normalize(identifier.value))
        for identifier in features.external_identifiers
    }
    if features.stable_wild_identifier is not None:
        keys.add(("stablewildidentifier", _normalize(features.stable_wild_identifier)))
    return keys


def _normalized_values(values: Iterable[str]) -> tuple[str, ...]:
    return tuple(sorted({_normalize(value) for value in values if _normalize(value)}))


def _normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.strip().casefold())
    return "".join(
        character
        for character in decomposed
        if not unicodedata.combining(character) and character.isalnum()
    )


def _created_panda_id(candidate: IdentityCandidateRecord) -> str:
    payload = {
        "record_id": candidate.record_id,
        "names": sorted(_name_forms(candidate.names)),
        "features": candidate.features.model_dump(mode="json"),
        "source_ids": list(candidate.source_ids),
    }
    return f"panda-{sha256(canonical_json_bytes(payload)).hexdigest()[:24]}"


def _build_validation_identity(
    candidate: IdentityCandidateRecord,
    decision: IdentityDecision,
    canonical_by_id: dict[str, CanonicalIdentityRecord],
) -> PandaIdentity:
    if decision.kind is IdentityDecisionKind.MERGE:
        if decision.canonical_panda_id is None:
            raise ValueError("merge decision is missing its canonical panda ID")
        canonical = canonical_by_id[decision.canonical_panda_id]
        names = _knowledge_names(canonical.names, canonical.source_ids)
        aliases = _knowledge_aliases(
            candidate.names,
            candidate.source_ids,
            existing_names=names,
        )
        external_identifiers = _knowledge_identifiers(
            (
                (canonical.features.external_identifiers, canonical.source_ids),
                (candidate.features.external_identifiers, candidate.source_ids),
            )
        )
        source_ids = tuple(sorted(set(canonical.source_ids) | set(candidate.source_ids)))
        population_context = (
            canonical.population_context
            if canonical.population_context is not PopulationContext.UNKNOWN
            else candidate.population_context
        )
        return PandaIdentity(
            identity_key=candidate.record_id,
            canonical_panda_id=canonical.panda_id,
            canonical_slug=canonical.canonical_slug,
            population_context=population_context,
            resolution=KnowledgeIdentityResolution(
                state=IdentityResolutionState.MATCHED,
                confidence=ConfidenceBand.HIGH,
                source_ids=source_ids,
                auxiliary_features={
                    **candidate.features.model_dump(mode="json"),
                    "candidate_record_id": candidate.record_id,
                    "decision_kind": decision.kind.value,
                },
            ),
            names=names,
            aliases=aliases,
            external_identifiers=external_identifiers,
        )

    if decision.kind is IdentityDecisionKind.CREATE:
        if decision.created_panda_id is None:
            raise ValueError("create decision is missing its created panda ID")
        names = _knowledge_names(candidate.names, candidate.source_ids)
        return PandaIdentity(
            identity_key=candidate.record_id,
            canonical_panda_id=decision.created_panda_id,
            canonical_slug=decision.created_panda_id,
            population_context=candidate.population_context,
            resolution=KnowledgeIdentityResolution(
                state=IdentityResolutionState.CREATED,
                confidence=ConfidenceBand.HIGH,
                source_ids=candidate.source_ids,
                auxiliary_features={
                    **candidate.features.model_dump(mode="json"),
                    "candidate_record_id": candidate.record_id,
                    "decision_kind": decision.kind.value,
                },
            ),
            names=names,
            external_identifiers=_knowledge_identifiers(
                ((candidate.features.external_identifiers, candidate.source_ids),)
            ),
        )

    raise ValueError("only merge and create decisions can enter batch validation")


def _knowledge_names(
    names: tuple[object, ...],
    source_ids: tuple[str, ...],
) -> tuple[KnowledgeIdentityName, ...]:
    result: list[KnowledgeIdentityName] = []
    seen: set[tuple[str, str]] = set()
    for index, name in enumerate(names):
        value = str(name.value)
        language = str(name.language)
        key = (language, value.casefold())
        if key in seen:
            continue
        seen.add(key)
        result.append(
            KnowledgeIdentityName(
                value=value,
                language=language,
                kind=str(name.kind),
                is_primary=index == 0,
                source_ids=source_ids,
            )
        )
    if not result:
        raise ValueError("resolved identity requires at least one sourced name")
    return tuple(result)


def _knowledge_aliases(
    names: tuple[object, ...],
    source_ids: tuple[str, ...],
    *,
    existing_names: tuple[KnowledgeIdentityName, ...],
) -> tuple[KnowledgeIdentityName, ...]:
    seen = {(name.language, name.value.casefold()) for name in existing_names}
    aliases: list[KnowledgeIdentityName] = []
    for name in names:
        value = str(name.value)
        language = str(name.language)
        key = (language, value.casefold())
        if key in seen:
            continue
        seen.add(key)
        aliases.append(
            KnowledgeIdentityName(
                value=value,
                language=language,
                kind=str(name.kind),
                is_primary=False,
                source_ids=source_ids,
            )
        )
    return tuple(aliases)


def _knowledge_identifiers(
    groups: tuple[tuple[tuple[object, ...], tuple[str, ...]], ...],
) -> tuple[KnowledgeExternalIdentifier, ...]:
    identifiers: list[KnowledgeExternalIdentifier] = []
    seen: set[tuple[str, str]] = set()
    for claims, source_ids in groups:
        for claim in claims:
            system = str(claim.system)
            value = str(claim.value)
            key = (system.casefold(), value.casefold())
            if key in seen:
                continue
            seen.add(key)
            identifiers.append(
                KnowledgeExternalIdentifier(
                    system=system,
                    value=value,
                    source_ids=source_ids,
                )
            )
    return tuple(sorted(identifiers, key=lambda item: (item.system, item.value)))
