from __future__ import annotations

import json
from datetime import UTC, date, datetime
from pathlib import Path

from app.knowledge.contracts import (
    AssertionDerivation,
    AssertionLifecycle,
    ConclusionStatus,
    ConfidenceBand,
    EvidenceMode,
    FactAssertion,
    FactConclusion,
    IdentityName,
    IdentityResolution,
    IdentityResolutionState,
    PandaIdentity,
    PandaKnowledgeBundle,
    PandaKnowledgeRecord,
    RelationshipAssertion,
    RelationshipStatus,
    RelationshipType,
    SourceAccessBasis,
    SourceEvidence,
    SourceKind,
)

ROOT = Path(__file__).resolve().parents[3]
SCHEMA_PATH = ROOT / "contracts" / "panda-knowledge.v1.json"
FIXTURE_DIR = ROOT / "contracts" / "panda-knowledge-fixtures" / "v1"
CREATED_AT = datetime(2026, 7, 23, 0, 0, tzinfo=UTC)
VERIFIED_AT = date(2026, 7, 23)


def _source(source_id: str = "source-example") -> SourceEvidence:
    return SourceEvidence(
        source_id=source_id,
        kind=SourceKind.OFFICIAL_INSTITUTION,
        access_basis=SourceAccessBasis.PUBLIC,
        publisher="Example Panda Institution",
        title="Example panda profile",
        url=f"https://example.org/pandas/{source_id}",
        original_language="en",
        captured_at=CREATED_AT,
        is_first_hand=True,
    )


def _identity(
    source_id: str = "source-example",
    *,
    identity_key: str = "panda-xing-xing",
) -> PandaIdentity:
    return PandaIdentity(
        identity_key=identity_key,
        canonical_panda_id=identity_key,
        canonical_slug=identity_key.removeprefix("panda-"),
        resolution=IdentityResolution(
            state=IdentityResolutionState.MATCHED,
            confidence=ConfidenceBand.HIGH,
            source_ids=(source_id,),
        ),
        names=(
            IdentityName(
                value="Xing Xing",
                language="en",
                kind="display",
                is_primary=True,
                source_ids=(source_id,),
            ),
        ),
    )


def _bundle(
    fixture_id: str,
    record: PandaKnowledgeRecord,
    *,
    sources: tuple[SourceEvidence, ...] | None = None,
) -> PandaKnowledgeBundle:
    return PandaKnowledgeBundle(
        bundle_id=f"knowledge-fixture-{fixture_id}",
        created_at=CREATED_AT,
        sources=sources or (_source(),),
        records=(record,),
    )


def build_fixtures() -> dict[str, PandaKnowledgeBundle]:
    direct = FactAssertion(
        assertion_id="assertion-direct-sex",
        subject_id="panda-xing-xing",
        field_path="identity.sex",
        raw_value="Female",
        normalized_value="female",
        source_ids=("source-example",),
        confidence=ConfidenceBand.HIGH,
        evidence_mode=EvidenceMode.DIRECT,
        last_verified_at=VERIFIED_AT,
    )

    age = FactAssertion(
        assertion_id="assertion-age-2024",
        subject_id="panda-xing-xing",
        field_path="age.at_date",
        raw_value="turned five in 2024",
        normalized_value={"age": 5, "year": 2024},
        source_ids=("source-example",),
        confidence=ConfidenceBand.MEDIUM,
        evidence_mode=EvidenceMode.DIRECT,
        last_verified_at=VERIFIED_AT,
    )
    inferred = FactAssertion(
        assertion_id="assertion-inferred-birth-year",
        subject_id="panda-xing-xing",
        field_path="birth.year",
        raw_value="turned five in 2024",
        normalized_value=2019,
        source_ids=("source-example",),
        confidence=ConfidenceBand.MEDIUM,
        evidence_mode=EvidenceMode.INFERRED,
        derivation=AssertionDerivation(
            rule="subtract-age-from-year",
            input_assertion_ids=(age.assertion_id,),
            explanation="2024 minus five years",
        ),
        last_verified_at=VERIFIED_AT,
    )

    conflict_primary = FactAssertion(
        assertion_id="assertion-conflict-primary",
        subject_id="panda-xing-xing",
        field_path="birth.date",
        raw_value="2019-08-08",
        normalized_value="2019-08-08",
        source_ids=("source-primary",),
        confidence=ConfidenceBand.HIGH,
        evidence_mode=EvidenceMode.DIRECT,
        last_verified_at=VERIFIED_AT,
    )
    conflict_alternative = FactAssertion(
        assertion_id="assertion-conflict-alternative",
        subject_id="panda-xing-xing",
        field_path="birth.date",
        raw_value="2019-08-09",
        normalized_value="2019-08-09",
        source_ids=("source-alternative",),
        confidence=ConfidenceBand.MEDIUM,
        evidence_mode=EvidenceMode.DIRECT,
        last_verified_at=VERIFIED_AT,
    )
    conflict_sources = (
        _source("source-primary"),
        SourceEvidence(
            source_id="source-alternative",
            kind=SourceKind.MAINSTREAM_MEDIA,
            access_basis=SourceAccessBasis.PUBLIC,
            publisher="Example News",
            title="Example birthday report",
            url="https://example.org/news/xing-xing-birthday",
            original_language="en",
            captured_at=CREATED_AT,
            is_first_hand=False,
        ),
    )

    corrected_old = FactAssertion(
        assertion_id="assertion-old-status",
        subject_id="panda-xing-xing",
        field_path="life.status",
        raw_value="alive",
        normalized_value="alive",
        source_ids=("source-example",),
        confidence=ConfidenceBand.HIGH,
        evidence_mode=EvidenceMode.DIRECT,
        last_verified_at=date(2025, 1, 1),
        lifecycle=AssertionLifecycle.SUPERSEDED,
        superseded_by="assertion-corrected-status",
    )
    corrected_new = FactAssertion(
        assertion_id="assertion-corrected-status",
        subject_id="panda-xing-xing",
        field_path="life.status",
        raw_value="deceased",
        normalized_value="deceased",
        source_ids=("source-example",),
        confidence=ConfidenceBand.HIGH,
        evidence_mode=EvidenceMode.DIRECT,
        last_verified_at=VERIFIED_AT,
    )

    withdrawn = FactAssertion(
        assertion_id="assertion-withdrawn-location",
        subject_id="panda-xing-xing",
        field_path="residency.current",
        raw_value="Example Zoo",
        normalized_value="example-zoo",
        source_ids=("source-example",),
        confidence=ConfidenceBand.MEDIUM,
        evidence_mode=EvidenceMode.DIRECT,
        last_verified_at=VERIFIED_AT,
        lifecycle=AssertionLifecycle.WITHDRAWN,
        withdrawal_reason="The source retracted the location claim.",
    )

    tentative_relationship = RelationshipAssertion(
        relationship_id="relationship-tentative-mother",
        subject_id="panda-xing-xing",
        object_id="panda-mother",
        relationship_type=RelationshipType.MOTHER,
        status=RelationshipStatus.TENTATIVE,
        confidence=ConfidenceBand.MEDIUM,
        source_ids=("source-example",),
        last_verified_at=VERIFIED_AT,
    )

    unresolved_identity = PandaIdentity(
        identity_key="unresolved-xing-record",
        resolution=IdentityResolution(
            state=IdentityResolutionState.UNRESOLVED,
            confidence=ConfidenceBand.MEDIUM,
            source_ids=("source-example",),
            candidate_panda_ids=("panda-xing-xing", "panda-xingxing-2"),
        ),
    )

    return {
        "direct-evidence.valid.json": _bundle(
            "direct-evidence",
            PandaKnowledgeRecord(
                identity=_identity(),
                assertions=(direct,),
                conclusions=(
                    FactConclusion(
                        field_path="identity.sex",
                        status=ConclusionStatus.CONFIRMED,
                        primary_assertion_id=direct.assertion_id,
                    ),
                ),
            ),
        ),
        "inferred-value.valid.json": _bundle(
            "inferred-value",
            PandaKnowledgeRecord(
                identity=_identity(),
                assertions=(age, inferred),
                conclusions=(
                    FactConclusion(
                        field_path="birth.year",
                        status=ConclusionStatus.TENTATIVE,
                        primary_assertion_id=inferred.assertion_id,
                    ),
                ),
            ),
        ),
        "conflict.valid.json": _bundle(
            "conflict",
            PandaKnowledgeRecord(
                identity=_identity("source-primary"),
                assertions=(conflict_primary, conflict_alternative),
                conclusions=(
                    FactConclusion(
                        field_path="birth.date",
                        status=ConclusionStatus.DISPUTED,
                        primary_assertion_id=conflict_primary.assertion_id,
                        alternative_assertion_ids=(conflict_alternative.assertion_id,),
                    ),
                ),
            ),
            sources=conflict_sources,
        ),
        "correction.valid.json": _bundle(
            "correction",
            PandaKnowledgeRecord(
                identity=_identity(),
                assertions=(corrected_old, corrected_new),
                conclusions=(
                    FactConclusion(
                        field_path="life.status",
                        status=ConclusionStatus.CONFIRMED,
                        primary_assertion_id=corrected_new.assertion_id,
                    ),
                ),
            ),
        ),
        "withdrawal.valid.json": _bundle(
            "withdrawal",
            PandaKnowledgeRecord(identity=_identity(), assertions=(withdrawn,)),
        ),
        "tentative-lineage.valid.json": _bundle(
            "tentative-lineage",
            PandaKnowledgeRecord(
                identity=_identity(),
                relationships=(tentative_relationship,),
            ),
        ),
        "unresolved-identity.valid.json": _bundle(
            "unresolved-identity",
            PandaKnowledgeRecord(identity=unresolved_identity),
        ),
        "missing-media.valid.json": _bundle(
            "missing-media",
            PandaKnowledgeRecord(identity=_identity()),
        ),
    }


def write_contract_files() -> None:
    SCHEMA_PATH.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    SCHEMA_PATH.write_text(
        json.dumps(
            PandaKnowledgeBundle.model_json_schema(),
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )
    for name, bundle in build_fixtures().items():
        (FIXTURE_DIR / name).write_text(
            json.dumps(
                bundle.model_dump(mode="json"),
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )


if __name__ == "__main__":
    write_contract_files()
