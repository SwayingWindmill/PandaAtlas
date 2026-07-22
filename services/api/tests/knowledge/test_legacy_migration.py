from __future__ import annotations

from datetime import UTC, date, datetime
from uuid import UUID

from app.acquisition.contracts import (
    ConflictState,
    CurrentTrustedValue,
    IdentityMatchState,
    SourceLocator,
    SourceLocatorKind,
)
from app.acquisition.curation.models import (
    CurationPatchProposal,
    CuratorDecision,
    DecisionAction,
    IntakeKind,
    PandaReference,
    PatchProvenance,
)
from app.domain.trusted_identity import (
    EvidenceAssertion,
    TrustedIdentity,
)
from app.domain.trusted_identity import (
    ExternalIdentifier as TrustedExternalIdentifier,
)
from app.domain.trusted_identity import (
    IdentityName as TrustedIdentityName,
)
from app.knowledge.contracts import (
    ConfidenceBand,
    EvidenceMode,
    FactPublicationScope,
    SourceAccessBasis,
    SourceEvidence,
    SourceKind,
    evaluate_record_publication,
)
from app.knowledge.migration import (
    migrate_curation_patch_proposal,
    migrate_trusted_profile,
)


def test_migrated_curation_patch_preserves_complete_legacy_provenance() -> None:
    decision = CuratorDecision(
        candidate_id="candidate-legacy-sex",
        evidence_snapshot_id="evidence-legacy-profile",
        reviewer="curator@example.org",
        decided_at=datetime(2026, 7, 22, 12, 0, tzinfo=UTC),
        action=DecisionAction.ACCEPTED,
        note="Accepted source-backed sex value.",
    )
    provenance = PatchProvenance(
        acquisition_bundle_id="bundle-legacy",
        acquisition_run_id="run-legacy",
        candidate_id="candidate-legacy-sex",
        decision=decision,
        source_id="source-legacy-profile",
        evidence_snapshot_id="evidence-legacy-profile",
        evidence_body_sha256="a" * 64,
        parser_name="legacy-profile-parser",
        parser_version="1.0.0",
        source_locator=SourceLocator(
            kind=SourceLocatorKind.CSS_SELECTOR,
            value=".profile-sex",
        ),
        raw_value="Female",
        normalized_value="female",
        prior_trusted_value=CurrentTrustedValue(present=False),
        conflict_state=ConflictState.NEW,
        candidate_notes=("Imported from reviewed acquisition bundle.",),
    )
    proposal = CurationPatchProposal(
        intake_kind=IntakeKind.PANDA,
        subject=PandaReference(
            state=IdentityMatchState.MATCHED,
            source_identity="Xing Xing",
            matched_panda_id="panda-xing-xing",
            matched_canonical_slug="xing-xing",
        ),
        payload={"operation": "set-field", "field": "sex", "value": "female"},
        provenance=provenance,
    )

    assertion = migrate_curation_patch_proposal(
        proposal,
        assertion_id="assertion-xing-sex",
        field_path="identity.sex",
        confidence=ConfidenceBand.HIGH,
        evidence_mode=EvidenceMode.DIRECT,
        last_verified_at=date(2026, 7, 22),
    )

    reference = assertion.evidence[0]
    assert assertion.raw_value == "Female"
    assert assertion.normalized_value == "female"
    assert reference.acquisition_bundle_id == "bundle-legacy"
    assert reference.acquisition_run_id == "run-legacy"
    assert reference.candidate_id == "candidate-legacy-sex"
    assert reference.decision_id == decision.decision_id
    assert reference.proposal_id == proposal.proposal_id
    assert reference.evidence_body_sha256 == "a" * 64
    assert reference.source_locator == {
        "kind": "css-selector",
        "value": ".profile-sex",
        "attribute": None,
        "occurrence": None,
    }
    assert reference.legacy_payload == proposal.to_dict()


def test_migrated_trusted_profile_preserves_identity_and_publication_scope() -> None:
    source = SourceEvidence(
        source_id="source-trusted-profile",
        kind=SourceKind.OFFICIAL_INSTITUTION,
        access_basis=SourceAccessBasis.PUBLIC,
        publisher="Example Zoo",
        title="Trusted panda profile",
        url="https://example.org/pandas/xing-xing",
        original_language="en",
        captured_at=datetime(2026, 7, 22, 13, 0, tzinfo=UTC),
        is_first_hand=True,
    )
    trusted_identity = TrustedIdentity(
        id=UUID("11111111-1111-1111-1111-111111111111"),
        canonical_slug="xing-xing",
        names=(
            TrustedIdentityName(
                value="星星",
                language="zh-Hans",
                kind="official",
                source_ids=(source.source_id,),
            ),
        ),
        aliases=(
            TrustedIdentityName(
                value="Xing Xing",
                language="en",
                kind="romanized",
                source_ids=(source.source_id,),
            ),
        ),
        legacy_slugs=("xingxing",),
        external_identifiers=(
            TrustedExternalIdentifier(
                system="example-studbook",
                value="EX-42",
                source_ids=(source.source_id,),
            ),
        ),
    )
    assertions = (
        EvidenceAssertion(
            id="legacy-published-sex",
            field="identity.sex",
            value="female",
            source_ids=(source.source_id,),
            certainty="confirmed",
            publication_status="published",
            last_verified_at=date(2026, 7, 22),
        ),
        EvidenceAssertion(
            id="legacy-restricted-location",
            field="residency.current",
            value="restricted-facility",
            source_ids=(source.source_id,),
            certainty="provisional",
            publication_status="restricted",
            last_verified_at=date(2026, 7, 22),
        ),
    )

    bundle = migrate_trusted_profile(
        identity=trusted_identity,
        assertions=assertions,
        sources=(source,),
        bundle_id="knowledge-bundle-migrated-trusted-profile",
        created_at=datetime(2026, 7, 22, 13, 5, tzinfo=UTC),
    )

    record = bundle.records[0]
    assert record.identity.canonical_panda_id == str(trusted_identity.id)
    assert record.identity.aliases[0].value == "Xing Xing"
    assert record.identity.legacy_slugs[0].value == "xingxing"
    assert record.identity.external_identifiers[0].value == "EX-42"
    assert record.identity.legacy_records[0].record_id == str(trusted_identity.id)
    assert record.assertions[0].publication_scope is FactPublicationScope.PUBLIC
    assert record.assertions[1].publication_scope is FactPublicationScope.RESTRICTED
    assert record.assertions[1].legacy_records[0].payload["publication_status"] == "restricted"

    decision = evaluate_record_publication(bundle, record.identity.identity_key)

    assert decision.public_assertion_ids == ("legacy-published-sex",)
    assert decision.review_assertion_ids == ("legacy-restricted-location",)
