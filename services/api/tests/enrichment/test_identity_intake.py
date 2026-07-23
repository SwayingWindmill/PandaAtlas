from __future__ import annotations

from datetime import UTC, date, datetime

import pytest
from pydantic import ValidationError

from app.enrichment import (
    IdentityCandidateBatch,
    IdentityFieldEvidence,
    IdentitySubjectExtraction,
    build_identity_candidate_batch,
)
from app.identity_resolution import (
    IdentityDecisionKind,
    IdentityFeatureSet,
    IdentityIdentifierClaim,
    IdentityNameClaim,
    resolve_identity_batch,
)
from app.knowledge.contracts import PopulationContext


def test_build_identity_candidate_batch_preserves_multilingual_identity_evidence() -> None:
    extraction = IdentitySubjectExtraction(
        source_id="source-chengdu-profile",
        intake_candidate_id="intake-chengdu-he-hua",
        subject_key="chengdu:和花",
        names=(
            IdentityNameClaim(
                value="和花",
                language="zh",
                kind="primary",
                normalized_forms=("he hua",),
            ),
            IdentityNameClaim(
                value="He Hua",
                language="en",
                kind="translated",
                normalized_forms=("he hua",),
            ),
        ),
        features=IdentityFeatureSet(
            birth_date=date(2020, 7, 4),
            sex="female",
            parent_names=("成功", "美兰"),
            institution_ids=("chengdu-base",),
            external_identifiers=(
                IdentityIdentifierClaim(system="institution-profile", value="he-hua"),
            ),
        ),
        population_context=PopulationContext.CAPTIVE,
        evidence=(
            IdentityFieldEvidence(
                evidence_snapshot_id="snapshot-he-hua-profile",
                evidence_body_sha256="a" * 64,
                field_path="identity.names",
                raw_value="大熊猫和花（英文名 He Hua）",
                normalized_value=["和花", "He Hua"],
                language="zh",
                source_locator={"section": "profile-heading"},
                parser_name="official-profile-html",
                parser_version="1.0.0",
            ),
            IdentityFieldEvidence(
                evidence_snapshot_id="snapshot-he-hua-profile",
                evidence_body_sha256="a" * 64,
                field_path="identity.birth_date",
                raw_value="2020年7月4日出生",
                normalized_value="2020-07-04",
                language="zh",
                source_locator={"section": "profile-facts", "label": "出生日期"},
                parser_name="official-profile-html",
                parser_version="1.0.0",
            ),
            IdentityFieldEvidence(
                evidence_snapshot_id="snapshot-he-hua-profile",
                evidence_body_sha256="a" * 64,
                field_path="identity.sex",
                raw_value="雌性",
                normalized_value="female",
                language="zh",
                source_locator={"section": "profile-facts", "label": "性别"},
                parser_name="official-profile-html",
                parser_version="1.0.0",
            ),
            IdentityFieldEvidence(
                evidence_snapshot_id="snapshot-he-hua-profile",
                evidence_body_sha256="a" * 64,
                field_path="identity.parent_names",
                raw_value="父亲美兰，母亲成功",
                normalized_value=["成功", "美兰"],
                language="zh",
                source_locator={"section": "profile-facts", "label": "父母"},
                parser_name="official-profile-html",
                parser_version="1.0.0",
            ),
            IdentityFieldEvidence(
                evidence_snapshot_id="snapshot-he-hua-profile",
                evidence_body_sha256="a" * 64,
                field_path="identity.institution_ids",
                raw_value="成都大熊猫繁育研究基地",
                normalized_value=["chengdu-base"],
                language="zh",
                source_locator={"section": "profile-facts", "label": "机构"},
                parser_name="official-profile-html",
                parser_version="1.0.0",
            ),
            IdentityFieldEvidence(
                evidence_snapshot_id="snapshot-he-hua-profile",
                evidence_body_sha256="a" * 64,
                field_path="identity.external_identifiers",
                raw_value="机构档案 he-hua",
                normalized_value={
                    "system": "institution-profile",
                    "value": "he-hua",
                },
                language="zh",
                source_locator={"section": "profile-metadata", "label": "档案编号"},
                parser_name="official-profile-html",
                parser_version="1.0.0",
            ),
            IdentityFieldEvidence(
                evidence_snapshot_id="snapshot-he-hua-profile",
                evidence_body_sha256="a" * 64,
                field_path="identity.population_context",
                raw_value="圈养大熊猫",
                normalized_value="captive",
                language="zh",
                source_locator={"section": "profile-metadata", "label": "种群背景"},
                parser_name="official-profile-html",
                parser_version="1.0.0",
            ),
        ),
    )

    batch = build_identity_candidate_batch((extraction,))

    assert batch.schema_version == "panda-atlas-identity-extraction/v1"
    assert batch.write_boundary == {
        "trusted_write_targets": (),
        "publication_write_targets": (),
    }
    assert batch.extractions == (extraction,)
    assert len(batch.candidates) == 1

    candidate = batch.candidates[0]
    assert candidate.record_id.startswith("identity-record-")
    assert candidate.names == extraction.names
    assert candidate.features == extraction.features
    assert candidate.source_ids == ("source-chengdu-profile",)
    assert candidate.population_context is PopulationContext.CAPTIVE
    assert extraction.evidence[1].source_locator == {
        "section": "profile-facts",
        "label": "出生日期",
    }


def test_identity_candidate_batch_is_independent_of_input_order() -> None:
    alpha = _extraction(
        source_id="source-alpha",
        subject_key="alpha:panda",
        name="Alpha",
        features=IdentityFeatureSet(sex="female"),
    )
    beta = _extraction(
        source_id="source-beta",
        subject_key="beta:panda",
        name="Beta",
        features=IdentityFeatureSet(birth_year=2022),
    )

    forward = build_identity_candidate_batch((alpha, beta))
    reverse = build_identity_candidate_batch((beta, alpha))

    assert forward == reverse
    assert forward.batch_id.startswith("identity-extraction-batch-")
    assert tuple(item.record_id for item in forward.extractions) == tuple(
        sorted((alpha.record_id, beta.record_id))
    )


def test_identity_candidates_feed_create_unresolved_and_group_routes() -> None:
    create = _extraction(
        source_id="source-create",
        subject_key="create:new-panda",
        name="New Panda",
        features=IdentityFeatureSet(sex="female"),
    )
    unresolved = _extraction(
        source_id="source-unresolved",
        subject_key="unresolved:name-only",
        name="Name Only",
        features=IdentityFeatureSet(),
    )
    group = _extraction(
        source_id="source-group",
        subject_key="group:wild-observation",
        name="Mountain Group",
        features=IdentityFeatureSet(
            institution_ids=("qinling-field-team",),
            is_group_observation=True,
        ),
        population_context=PopulationContext.WILD,
    )
    intake = build_identity_candidate_batch((create, unresolved, group))

    resolved = resolve_identity_batch(
        batch_id="identity-resolution-from-extraction",
        created_at=datetime(2026, 7, 23, 12, 0, tzinfo=UTC),
        canonical_records=(),
        candidate_records=intake.candidates,
    )
    decisions = {decision.record_id: decision.kind for decision in resolved.decisions}

    assert decisions[create.record_id] is IdentityDecisionKind.CREATE
    assert decisions[unresolved.record_id] is IdentityDecisionKind.UNRESOLVED
    assert decisions[group.record_id] is IdentityDecisionKind.REJECT_GROUP
    assert resolved.summary.create_count == 1
    assert resolved.summary.unresolved_count == 1
    assert resolved.summary.rejected_group_count == 1


def test_identity_extraction_rejects_untraced_scoring_features() -> None:
    with pytest.raises(ValidationError, match="identity.sex"):
        IdentitySubjectExtraction(
            source_id="source-untraced",
            intake_candidate_id="intake-untraced",
            subject_key="profile:untraced",
            names=(
                IdentityNameClaim(
                    value="Untraced",
                    language="en",
                    kind="primary",
                ),
            ),
            features=IdentityFeatureSet(sex="female"),
            evidence=(
                _evidence(
                    subject_key="profile:untraced",
                    field_path="identity.names",
                    normalized_value="Untraced",
                ),
            ),
        )


def test_identity_extraction_rejects_untraced_population_context() -> None:
    with pytest.raises(ValidationError, match="identity.population_context"):
        IdentitySubjectExtraction(
            source_id="source-wild-context",
            intake_candidate_id="intake-wild-context",
            subject_key="observation:wild-context",
            names=(
                IdentityNameClaim(
                    value="Wild Context",
                    language="en",
                    kind="primary",
                ),
            ),
            features=IdentityFeatureSet(),
            population_context=PopulationContext.WILD,
            evidence=(
                _evidence(
                    subject_key="observation:wild-context",
                    field_path="identity.names",
                    normalized_value="Wild Context",
                ),
            ),
        )


def test_identity_extraction_rejects_normalized_evidence_drift() -> None:
    with pytest.raises(ValidationError, match="identity.sex normalized evidence"):
        IdentitySubjectExtraction(
            source_id="source-drifted",
            intake_candidate_id="intake-drifted",
            subject_key="profile:drifted",
            names=(
                IdentityNameClaim(
                    value="Drifted",
                    language="en",
                    kind="primary",
                ),
            ),
            features=IdentityFeatureSet(sex="female"),
            evidence=(
                _evidence(
                    subject_key="profile:drifted",
                    field_path="identity.names",
                    normalized_value="Drifted",
                ),
                _evidence(
                    subject_key="profile:drifted",
                    field_path="identity.sex",
                    normalized_value="male",
                ),
            ),
        )


def test_identity_extraction_batch_rejects_tampered_batch_id() -> None:
    batch = build_identity_candidate_batch(
        (
            _extraction(
                source_id="source-integrity",
                subject_key="profile:integrity",
                name="Integrity",
                features=IdentityFeatureSet(birth_year=2021),
            ),
        )
    )
    payload = batch.model_dump(mode="json")
    payload["batch_id"] = "identity-extraction-batch-tampered"

    with pytest.raises(ValidationError, match="batch ID does not match"):
        IdentityCandidateBatch.model_validate(payload)


def _extraction(
    *,
    source_id: str,
    subject_key: str,
    name: str,
    features: IdentityFeatureSet,
    population_context: PopulationContext = PopulationContext.UNKNOWN,
) -> IdentitySubjectExtraction:
    evidence = [
        _evidence(
            subject_key=subject_key,
            field_path="identity.names",
            normalized_value=name,
        )
    ]
    if features.birth_date is not None:
        evidence.append(
            _evidence(
                subject_key=subject_key,
                field_path="identity.birth_date",
                normalized_value=features.birth_date.isoformat(),
            )
        )
    elif features.birth_year is not None:
        evidence.append(
            _evidence(
                subject_key=subject_key,
                field_path="identity.birth_year",
                normalized_value=features.birth_year,
            )
        )
    if features.sex is not None:
        evidence.append(
            _evidence(
                subject_key=subject_key,
                field_path="identity.sex",
                normalized_value=features.sex,
            )
        )
    if features.parent_ids:
        evidence.append(
            _evidence(
                subject_key=subject_key,
                field_path="identity.parent_ids",
                normalized_value=list(features.parent_ids),
            )
        )
    if features.parent_names:
        evidence.append(
            _evidence(
                subject_key=subject_key,
                field_path="identity.parent_names",
                normalized_value=list(features.parent_names),
            )
        )
    if features.institution_ids:
        evidence.append(
            _evidence(
                subject_key=subject_key,
                field_path="identity.institution_ids",
                normalized_value=list(features.institution_ids),
            )
        )
    if features.movement_institution_ids:
        evidence.append(
            _evidence(
                subject_key=subject_key,
                field_path="identity.movement_institution_ids",
                normalized_value=list(features.movement_institution_ids),
            )
        )
    if features.source_relationship_ids:
        evidence.append(
            _evidence(
                subject_key=subject_key,
                field_path="identity.source_relationship_ids",
                normalized_value=list(features.source_relationship_ids),
            )
        )
    if features.external_identifiers:
        evidence.append(
            _evidence(
                subject_key=subject_key,
                field_path="identity.external_identifiers",
                normalized_value=[
                    {"system": item.system, "value": item.value}
                    for item in features.external_identifiers
                ],
            )
        )
    if features.stable_wild_identifier is not None:
        evidence.append(
            _evidence(
                subject_key=subject_key,
                field_path="identity.stable_wild_identifier",
                normalized_value=features.stable_wild_identifier,
            )
        )
    if features.is_group_observation:
        evidence.append(
            _evidence(
                subject_key=subject_key,
                field_path="identity.group_observation",
                normalized_value=True,
            )
        )
    if population_context is not PopulationContext.UNKNOWN:
        evidence.append(
            _evidence(
                subject_key=subject_key,
                field_path="identity.population_context",
                normalized_value=population_context.value,
            )
        )

    return IdentitySubjectExtraction(
        source_id=source_id,
        intake_candidate_id=f"intake-{subject_key}",
        subject_key=subject_key,
        names=(
            IdentityNameClaim(
                value=name,
                language="en",
                kind="primary",
                normalized_forms=(name.casefold(),),
            ),
        ),
        features=features,
        population_context=population_context,
        evidence=tuple(evidence),
    )


def _evidence(
    *,
    subject_key: str,
    field_path: str,
    normalized_value: object,
) -> IdentityFieldEvidence:
    return IdentityFieldEvidence(
        evidence_snapshot_id=f"snapshot-{subject_key}",
        evidence_body_sha256="b" * 64,
        field_path=field_path,
        raw_value=str(normalized_value),
        normalized_value=normalized_value,
        language="en",
        source_locator={"subject_key": subject_key, "field_path": field_path},
        parser_name="test-identity-parser",
        parser_version="1.0.0",
    )
