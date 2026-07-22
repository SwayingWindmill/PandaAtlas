from __future__ import annotations

from datetime import UTC, date, datetime

import pytest
from pydantic import ValidationError

from app.knowledge.contracts import (
    AssertionDerivation,
    ConclusionStatus,
    ConfidenceBand,
    ContributionKind,
    ContributionRecord,
    ContributionState,
    EvidenceMode,
    ExternalIdentifier,
    FactAssertion,
    FactConclusion,
    FactQualifier,
    IdentityName,
    IdentityResolution,
    IdentityResolutionState,
    LegacySlug,
    LocationDisclosure,
    LocationDisclosureState,
    LocationPrecision,
    LocationValue,
    MediaAsset,
    MediaLibrary,
    MediaRightsStatus,
    PandaIdentity,
    PandaKnowledgeBundle,
    PandaKnowledgeRecord,
    PopulationContext,
    PublicationState,
    RelationshipAssertion,
    RelationshipStatus,
    RelationshipType,
    SourceAccessBasis,
    SourceAssessment,
    SourceEvidence,
    SourceKind,
    TranslationStatus,
    TranslationValue,
    evaluate_record_publication,
)


def test_minimum_sourced_identity_publishes_without_cleared_media() -> None:
    source = SourceEvidence(
        source_id="source-zoo-profile",
        kind=SourceKind.OFFICIAL_INSTITUTION,
        access_basis=SourceAccessBasis.PUBLIC,
        publisher="Example Zoo",
        title="Panda profile",
        url="https://example.org/pandas/xing-xing",
        original_language="en",
        captured_at=datetime(2026, 7, 23, 1, 0, tzinfo=UTC),
        is_first_hand=True,
    )
    identity = PandaIdentity(
        identity_key="panda-xing-xing",
        canonical_panda_id="panda-xing-xing",
        canonical_slug="xing-xing",
        resolution=IdentityResolution(
            state=IdentityResolutionState.CREATED,
            confidence=ConfidenceBand.HIGH,
            source_ids=(source.source_id,),
            auxiliary_features={"institution": "Example Zoo"},
        ),
        names=(
            IdentityName(
                value="Xing Xing",
                language="en",
                kind="official",
                is_primary=True,
                source_ids=(source.source_id,),
            ),
        ),
    )
    record = PandaKnowledgeRecord(identity=identity)
    bundle = PandaKnowledgeBundle(
        bundle_id="knowledge-bundle-minimum-profile",
        created_at=datetime(2026, 7, 23, 1, 5, tzinfo=UTC),
        sources=(source,),
        records=(record,),
    )

    decision = evaluate_record_publication(bundle, record.identity.identity_key)

    assert decision.state is PublicationState.AUTO_PUBLISH
    assert decision.public_assertion_ids == ()
    assert decision.public_media_ids == ()
    assert decision.warnings == ("missing-cleared-media",)


def test_inferred_assertion_requires_explicit_derivation() -> None:
    with pytest.raises(ValidationError, match="inferred assertions require derivation"):
        FactAssertion(
            assertion_id="assertion-inferred-birth-year",
            subject_id="panda-xing-xing",
            field_path="birth.year",
            raw_value="turned five in 2024",
            normalized_value=2019,
            source_ids=("source-zoo-profile",),
            confidence=ConfidenceBand.MEDIUM,
            evidence_mode=EvidenceMode.INFERRED,
            last_verified_at=date(2026, 7, 23),
        )


def test_high_and_medium_facts_publish_while_low_confidence_waits_for_review() -> None:
    source = SourceEvidence(
        source_id="source-zoo-profile",
        kind=SourceKind.OFFICIAL_INSTITUTION,
        access_basis=SourceAccessBasis.PUBLIC,
        publisher="Example Zoo",
        title="Panda profile",
        url="https://example.org/pandas/xing-xing",
        original_language="en",
        captured_at=datetime(2026, 7, 23, 1, 0, tzinfo=UTC),
        is_first_hand=True,
    )
    identity = PandaIdentity(
        identity_key="panda-xing-xing",
        canonical_panda_id="panda-xing-xing",
        canonical_slug="xing-xing",
        resolution=IdentityResolution(
            state=IdentityResolutionState.CREATED,
            confidence=ConfidenceBand.HIGH,
            source_ids=(source.source_id,),
            auxiliary_features={"institution": "Example Zoo"},
        ),
        names=(
            IdentityName(
                value="Xing Xing",
                language="en",
                kind="official",
                is_primary=True,
                source_ids=(source.source_id,),
            ),
        ),
    )
    assertions = (
        FactAssertion(
            assertion_id="assertion-sex",
            subject_id="panda-xing-xing",
            field_path="identity.sex",
            raw_value="female",
            normalized_value="female",
            source_ids=(source.source_id,),
            confidence=ConfidenceBand.HIGH,
            evidence_mode=EvidenceMode.DIRECT,
            last_verified_at=date(2026, 7, 23),
        ),
        FactAssertion(
            assertion_id="assertion-birth-year",
            subject_id="panda-xing-xing",
            field_path="birth.year",
            raw_value="turned five in 2024",
            normalized_value=2019,
            source_ids=(source.source_id,),
            confidence=ConfidenceBand.MEDIUM,
            evidence_mode=EvidenceMode.INFERRED,
            derivation=AssertionDerivation(
                rule="subtract-age-from-year",
                input_assertion_ids=("assertion-sex",),
                explanation="2024 minus five years",
            ),
            last_verified_at=date(2026, 7, 23),
        ),
        FactAssertion(
            assertion_id="assertion-favorite-food",
            subject_id="panda-xing-xing",
            field_path="behavior.favorite_food",
            raw_value="apples",
            normalized_value="apples",
            source_ids=(source.source_id,),
            confidence=ConfidenceBand.LOW,
            evidence_mode=EvidenceMode.DIRECT,
            last_verified_at=date(2026, 7, 23),
        ),
    )
    record = PandaKnowledgeRecord(identity=identity, assertions=assertions)
    bundle = PandaKnowledgeBundle(
        bundle_id="knowledge-bundle-confidence",
        created_at=datetime(2026, 7, 23, 1, 5, tzinfo=UTC),
        sources=(source,),
        records=(record,),
    )

    decision = evaluate_record_publication(bundle, identity.identity_key)

    assert decision.public_assertion_ids == (
        "assertion-birth-year",
        "assertion-sex",
    )
    assert decision.review_assertion_ids == ("assertion-favorite-food",)


def test_conflicting_facts_keep_a_primary_value_and_visible_alternative() -> None:
    sources = (
        SourceEvidence(
            source_id="source-primary",
            kind=SourceKind.OFFICIAL_INSTITUTION,
            access_basis=SourceAccessBasis.PUBLIC,
            publisher="Example Zoo",
            title="Official profile",
            url="https://example.org/official/xing-xing",
            original_language="en",
            captured_at=datetime(2026, 7, 23, 2, 0, tzinfo=UTC),
            is_first_hand=True,
        ),
        SourceEvidence(
            source_id="source-secondary",
            kind=SourceKind.MAINSTREAM_MEDIA,
            access_basis=SourceAccessBasis.PUBLIC,
            publisher="Example News",
            title="Birthday report",
            url="https://news.example.org/xing-xing-birthday",
            original_language="en",
            captured_at=datetime(2026, 7, 23, 2, 5, tzinfo=UTC),
            is_first_hand=False,
        ),
    )
    identity = PandaIdentity(
        identity_key="panda-xing-xing",
        canonical_panda_id="panda-xing-xing",
        canonical_slug="xing-xing",
        resolution=IdentityResolution(
            state=IdentityResolutionState.MATCHED,
            confidence=ConfidenceBand.HIGH,
            source_ids=("source-primary",),
        ),
        names=(
            IdentityName(
                value="Xing Xing",
                language="en",
                kind="official",
                is_primary=True,
                source_ids=("source-primary",),
            ),
        ),
    )
    assertions = (
        FactAssertion(
            assertion_id="assertion-birth-primary",
            subject_id="panda-xing-xing",
            field_path="birth.date",
            raw_value="2019-08-08",
            normalized_value="2019-08-08",
            source_ids=("source-primary",),
            confidence=ConfidenceBand.HIGH,
            evidence_mode=EvidenceMode.DIRECT,
            last_verified_at=date(2026, 7, 23),
        ),
        FactAssertion(
            assertion_id="assertion-birth-alternative",
            subject_id="panda-xing-xing",
            field_path="birth.date",
            raw_value="2019-08-09",
            normalized_value="2019-08-09",
            source_ids=("source-secondary",),
            confidence=ConfidenceBand.MEDIUM,
            evidence_mode=EvidenceMode.DIRECT,
            last_verified_at=date(2026, 7, 23),
        ),
    )
    conclusion = FactConclusion(
        field_path="birth.date",
        status=ConclusionStatus.DISPUTED,
        primary_assertion_id="assertion-birth-primary",
        alternative_assertion_ids=("assertion-birth-alternative",),
    )

    record = PandaKnowledgeRecord(
        identity=identity,
        assertions=assertions,
        conclusions=(conclusion,),
    )
    bundle = PandaKnowledgeBundle(
        bundle_id="knowledge-bundle-conflict",
        created_at=datetime(2026, 7, 23, 2, 10, tzinfo=UTC),
        sources=sources,
        records=(record,),
    )

    assert bundle.records[0].conclusions[0].primary_assertion_id == "assertion-birth-primary"
    assert bundle.records[0].conclusions[0].alternative_assertion_ids == (
        "assertion-birth-alternative",
    )


def test_medium_confidence_relationship_publishes_as_tentative_lineage() -> None:
    source = SourceEvidence(
        source_id="source-parentage",
        kind=SourceKind.MATURE_DATABASE,
        access_basis=SourceAccessBasis.PUBLIC,
        publisher="Panda Records",
        title="Parentage record",
        url="https://example.org/records/xing-xing",
        original_language="en",
        captured_at=datetime(2026, 7, 23, 3, 0, tzinfo=UTC),
        is_first_hand=False,
    )
    identity = PandaIdentity(
        identity_key="panda-xing-xing",
        canonical_panda_id="panda-xing-xing",
        canonical_slug="xing-xing",
        resolution=IdentityResolution(
            state=IdentityResolutionState.MATCHED,
            confidence=ConfidenceBand.HIGH,
            source_ids=(source.source_id,),
        ),
        names=(
            IdentityName(
                value="Xing Xing",
                language="en",
                kind="display",
                is_primary=True,
                source_ids=(source.source_id,),
            ),
        ),
    )
    relationship = RelationshipAssertion(
        relationship_id="relationship-xing-mother",
        subject_id="panda-xing-xing",
        object_id="panda-mother",
        relationship_type=RelationshipType.MOTHER,
        status=RelationshipStatus.TENTATIVE,
        confidence=ConfidenceBand.MEDIUM,
        source_ids=(source.source_id,),
        last_verified_at=date(2026, 7, 23),
    )
    record = PandaKnowledgeRecord(identity=identity, relationships=(relationship,))
    bundle = PandaKnowledgeBundle(
        bundle_id="knowledge-bundle-tentative-lineage",
        created_at=datetime(2026, 7, 23, 3, 5, tzinfo=UTC),
        sources=(source,),
        records=(record,),
    )

    decision = evaluate_record_publication(bundle, identity.identity_key)

    assert decision.public_relationship_ids == ("relationship-xing-mother",)
    assert decision.review_relationship_ids == ()


def test_unknown_rights_media_cannot_enter_the_public_library() -> None:
    with pytest.raises(ValidationError, match="cleared rights"):
        MediaAsset(
            media_id="media-unknown-rights",
            panda_id="panda-xing-xing",
            source_id="source-photo",
            source_url="https://photos.example.org/xing-xing.jpg",
            library=MediaLibrary.PUBLIC,
            rights_status=MediaRightsStatus.UNKNOWN,
            panda_match_confidence=ConfidenceBand.HIGH,
            is_main=False,
        )


def test_cleared_main_image_publishes_and_removes_missing_media_warning() -> None:
    source = SourceEvidence(
        source_id="source-photo",
        kind=SourceKind.PHOTOGRAPHER,
        access_basis=SourceAccessBasis.MANUAL_PERMISSION,
        publisher="Example Photographer",
        title="Xing Xing portrait",
        url="https://photos.example.org/xing-xing",
        original_language="en",
        captured_at=datetime(2026, 7, 23, 4, 0, tzinfo=UTC),
        is_first_hand=True,
    )
    identity = PandaIdentity(
        identity_key="panda-xing-xing",
        canonical_panda_id="panda-xing-xing",
        canonical_slug="xing-xing",
        resolution=IdentityResolution(
            state=IdentityResolutionState.MATCHED,
            confidence=ConfidenceBand.HIGH,
            source_ids=(source.source_id,),
        ),
        names=(
            IdentityName(
                value="Xing Xing",
                language="en",
                kind="display",
                is_primary=True,
                source_ids=(source.source_id,),
            ),
        ),
    )
    media = MediaAsset(
        media_id="media-xing-main",
        panda_id="panda-xing-xing",
        source_id=source.source_id,
        source_url="https://photos.example.org/xing-xing.jpg",
        library=MediaLibrary.PUBLIC,
        rights_status=MediaRightsStatus.OPEN_LICENSE,
        license_name="CC BY 4.0",
        license_url="https://creativecommons.org/licenses/by/4.0/",
        author="Example Photographer",
        panda_match_confidence=ConfidenceBand.HIGH,
        is_main=True,
    )
    record = PandaKnowledgeRecord(identity=identity, media=(media,))
    bundle = PandaKnowledgeBundle(
        bundle_id="knowledge-bundle-cleared-media",
        created_at=datetime(2026, 7, 23, 4, 5, tzinfo=UTC),
        sources=(source,),
        records=(record,),
    )

    decision = evaluate_record_publication(bundle, identity.identity_key)

    assert decision.public_media_ids == ("media-xing-main",)
    assert decision.warnings == ()


def test_generated_translation_requires_assertion_basis_and_generator_version() -> None:
    with pytest.raises(ValidationError, match="generated translations require assertion basis"):
        TranslationValue(
            translation_id="translation-summary-en",
            subject_type="summary",
            subject_id="panda-xing-xing",
            locale="en",
            text="A giant panda profile.",
            status=TranslationStatus.GENERATED,
            source_language="zh-CN",
            based_on_assertion_ids=(),
            generator_version="summary-generator/v1",
            generated_at=datetime(2026, 7, 23, 5, 0, tzinfo=UTC),
        )


def test_wild_panda_location_cannot_publish_exact_coordinates() -> None:
    source = SourceEvidence(
        source_id="source-wild-observation",
        kind=SourceKind.RESEARCH,
        access_basis=SourceAccessBasis.PUBLIC,
        publisher="Example Conservation Institute",
        title="Wild panda observation",
        url="https://example.org/research/wild-panda-42",
        original_language="zh-CN",
        captured_at=datetime(2026, 7, 23, 5, 30, tzinfo=UTC),
        is_first_hand=True,
    )
    identity = PandaIdentity(
        identity_key="wild-panda-42",
        canonical_panda_id="wild-panda-42",
        canonical_slug="wild-panda-42",
        population_context=PopulationContext.WILD,
        resolution=IdentityResolution(
            state=IdentityResolutionState.CREATED,
            confidence=ConfidenceBand.HIGH,
            source_ids=(source.source_id,),
            auxiliary_features={"field_identifier": "WP-42"},
        ),
        names=(
            IdentityName(
                value="WP-42",
                language="und",
                kind="field-identifier",
                is_primary=True,
                source_ids=(source.source_id,),
            ),
        ),
    )
    location = LocationDisclosure(
        location_id="location-wild-panda-42",
        panda_id="wild-panda-42",
        source_ids=(source.source_id,),
        state=LocationDisclosureState.PUBLIC,
        public_location=LocationValue(
            label="Observation point",
            precision=LocationPrecision.EXACT,
            coordinates=(103.1234, 30.5678),
        ),
    )

    with pytest.raises(ValidationError, match="wild panda locations cannot expose exact"):
        PandaKnowledgeBundle(
            bundle_id="knowledge-bundle-sensitive-location",
            created_at=datetime(2026, 7, 23, 5, 35, tzinfo=UTC),
            sources=(source,),
            records=(PandaKnowledgeRecord(identity=identity, locations=(location,)),),
        )


def test_aliases_legacy_slugs_and_external_identifiers_preserve_source_provenance() -> None:
    identity = PandaIdentity(
        identity_key="panda-xing-xing",
        canonical_panda_id="panda-xing-xing",
        canonical_slug="xing-xing",
        resolution=IdentityResolution(
            state=IdentityResolutionState.MATCHED,
            confidence=ConfidenceBand.HIGH,
            source_ids=("source-identity",),
        ),
        names=(
            IdentityName(
                value="星星",
                language="zh-Hans",
                kind="official",
                is_primary=True,
                source_ids=("source-identity",),
            ),
        ),
        aliases=(
            IdentityName(
                value="Xing Xing",
                language="en",
                kind="romanized",
                source_ids=("source-identity",),
            ),
        ),
        legacy_slugs=(LegacySlug(value="xingxing", source_ids=("source-identity",)),),
        external_identifiers=(
            ExternalIdentifier(
                system="example-studbook",
                value="EX-42",
                source_ids=("source-identity",),
            ),
        ),
    )

    assert identity.aliases[0].value == "Xing Xing"
    assert identity.legacy_slugs[0].value == "xingxing"
    assert identity.external_identifiers[0].value == "EX-42"


def test_photo_upload_contribution_requires_rights_declaration() -> None:
    with pytest.raises(ValidationError, match="photo uploads require a rights declaration"):
        ContributionRecord(
            contribution_id="contribution-photo-xing",
            panda_id="panda-xing-xing",
            kind=ContributionKind.PHOTO_UPLOAD,
            state=ContributionState.SUBMITTED,
            submitter_id="user-42",
            submitted_at=datetime(2026, 7, 23, 6, 0, tzinfo=UTC),
            payload={"filename": "xing-xing.jpg"},
        )


def test_source_quality_is_separate_from_assertion_confidence() -> None:
    source = SourceEvidence(
        source_id="source-secondary",
        kind=SourceKind.COMMUNITY,
        access_basis=SourceAccessBasis.PUBLIC,
        publisher="Example Community Database",
        title="Panda record",
        url="https://example.org/community/xing-xing",
        original_language="en",
        captured_at=datetime(2026, 7, 23, 6, 15, tzinfo=UTC),
        is_first_hand=False,
        assessment=SourceAssessment(
            confidence=ConfidenceBand.LOW,
            authority_score=20,
            recency_score=80,
            specificity_score=70,
            consistency_score=30,
            corroboration_score=0,
            rationale=("newly discovered source",),
        ),
    )
    assertion = FactAssertion(
        assertion_id="assertion-medium-name",
        subject_id="panda-xing-xing",
        field_path="identity.alias",
        raw_value="Xing Xing",
        normalized_value="Xing Xing",
        source_ids=(source.source_id,),
        confidence=ConfidenceBand.MEDIUM,
        evidence_mode=EvidenceMode.DIRECT,
        last_verified_at=date(2026, 7, 23),
    )

    assert source.assessment.confidence is ConfidenceBand.LOW
    assert assertion.confidence is ConfidenceBand.MEDIUM


def test_medium_confidence_death_cause_requires_public_qualifier() -> None:
    with pytest.raises(ValidationError, match="death causes require a reported qualifier"):
        FactAssertion(
            assertion_id="assertion-death-cause",
            subject_id="panda-xing-xing",
            field_path="death.cause",
            raw_value="illness",
            normalized_value="illness",
            source_ids=("source-report",),
            confidence=ConfidenceBand.MEDIUM,
            evidence_mode=EvidenceMode.DIRECT,
            last_verified_at=date(2026, 7, 23),
        )

    qualified = FactAssertion(
        assertion_id="assertion-qualified-death-cause",
        subject_id="panda-xing-xing",
        field_path="death.cause",
        raw_value="illness",
        normalized_value="illness",
        source_ids=("source-report",),
        confidence=ConfidenceBand.MEDIUM,
        evidence_mode=EvidenceMode.DIRECT,
        qualifier=FactQualifier.REPORTED,
        last_verified_at=date(2026, 7, 23),
    )

    assert qualified.qualifier is FactQualifier.REPORTED


def test_unresolved_identity_keeps_all_content_out_of_public_outputs() -> None:
    source = SourceEvidence(
        source_id="source-unresolved",
        kind=SourceKind.MATURE_DATABASE,
        access_basis=SourceAccessBasis.PUBLIC,
        publisher="Example Panda Database",
        title="Ambiguous panda record",
        url="https://example.org/pandas/ambiguous-xing",
        original_language="en",
        captured_at=datetime(2026, 7, 23, 6, 30, tzinfo=UTC),
        is_first_hand=False,
    )
    identity = PandaIdentity(
        identity_key="unresolved-xing",
        resolution=IdentityResolution(
            state=IdentityResolutionState.UNRESOLVED,
            confidence=ConfidenceBand.MEDIUM,
            source_ids=(source.source_id,),
            candidate_panda_ids=("panda-xing-xing", "panda-xingxing-2"),
        ),
    )
    assertion = FactAssertion(
        assertion_id="assertion-unresolved-sex",
        subject_id=identity.identity_key,
        field_path="identity.sex",
        raw_value="female",
        normalized_value="female",
        source_ids=(source.source_id,),
        confidence=ConfidenceBand.HIGH,
        evidence_mode=EvidenceMode.DIRECT,
        last_verified_at=date(2026, 7, 23),
    )
    bundle = PandaKnowledgeBundle(
        bundle_id="knowledge-bundle-unresolved-content",
        created_at=datetime(2026, 7, 23, 6, 35, tzinfo=UTC),
        sources=(source,),
        records=(PandaKnowledgeRecord(identity=identity, assertions=(assertion,)),),
    )

    decision = evaluate_record_publication(bundle, identity.identity_key)

    assert decision.state is PublicationState.BLOCKED
    assert decision.public_assertion_ids == ()
    assert decision.review_assertion_ids == ("assertion-unresolved-sex",)
