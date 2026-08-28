from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, JsonValue, model_validator

SCHEMA_VERSION = "panda-atlas-knowledge-bundle/v1"


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, validate_default=True)


class ConfidenceBand(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class EvidenceMode(StrEnum):
    DIRECT = "direct"
    INFERRED = "inferred"


class FactQualifier(StrEnum):
    REPORTED = "reported"
    UNCONFIRMED = "unconfirmed"
    APPROXIMATE = "approximate"
    ESTIMATED = "estimated"


class FactPublicationScope(StrEnum):
    PUBLIC = "public"
    REVIEW_ONLY = "review-only"
    RESTRICTED = "restricted"


class AssertionLifecycle(StrEnum):
    ACTIVE = "active"
    SUPERSEDED = "superseded"
    WITHDRAWN = "withdrawn"


class ConclusionStatus(StrEnum):
    CONFIRMED = "confirmed"
    TENTATIVE = "tentative"
    DISPUTED = "disputed"
    SUPERSEDED = "superseded"
    UNKNOWN = "unknown"


class RelationshipType(StrEnum):
    MOTHER = "mother"
    FATHER = "father"
    PARENT = "parent"
    CHILD = "child"
    SIBLING = "sibling"
    MATE = "mate"
    TWIN = "twin"
    OTHER = "other"


class RelationshipStatus(StrEnum):
    CONFIRMED = "confirmed"
    TENTATIVE = "tentative"
    DISPUTED = "disputed"
    REVIEW_ONLY = "review-only"


class MediaLibrary(StrEnum):
    INTERNAL_CANDIDATE = "internal-candidate"
    PUBLIC = "public"


class MediaRightsStatus(StrEnum):
    PUBLIC_DOMAIN = "public-domain"
    OPEN_LICENSE = "open-license"
    EXPLICIT_AUTHORIZATION = "explicit-authorization"
    UNKNOWN = "unknown"
    PROHIBITED = "prohibited"
    WITHDRAWN = "withdrawn"


class PopulationContext(StrEnum):
    CAPTIVE = "captive"
    WILD = "wild"
    RELEASED = "released"
    UNKNOWN = "unknown"


class TranslationStatus(StrEnum):
    SOURCE = "source"
    GENERATED = "generated"
    REVIEWED = "reviewed"
    OUTDATED = "outdated"
    WITHDRAWN = "withdrawn"


class LocationDisclosureState(StrEnum):
    PUBLIC = "public"
    GENERALIZED = "generalized"
    RESTRICTED = "restricted"


class LocationPrecision(StrEnum):
    EXACT = "exact"
    FACILITY = "facility"
    LOCALITY = "locality"
    REGION = "region"
    COUNTRY = "country"
    UNKNOWN = "unknown"


class ContributionKind(StrEnum):
    CORRECTION = "correction"
    SOURCE = "source"
    MEDIA_RIGHTS_LEAD = "media-rights-lead"
    PHOTO_UPLOAD = "photo-upload"


class ContributionState(StrEnum):
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class RightsDeclarationBasis(StrEnum):
    COPYRIGHT_OWNER = "copyright-owner"
    AUTHORIZED_BY_OWNER = "authorized-by-owner"


class SourceKind(StrEnum):
    OFFICIAL_INSTITUTION = "official-institution"
    GOVERNMENT = "government"
    RESEARCH = "research"
    MAINSTREAM_MEDIA = "mainstream-media"
    OFFICIAL_SOCIAL = "official-social"
    PHOTOGRAPHER = "photographer"
    MATURE_DATABASE = "mature-database"
    COMMUNITY = "community"
    UNKNOWN = "unknown"


class SourceAccessBasis(StrEnum):
    PUBLIC = "public"
    LICENSED_API = "licensed-api"
    AUTHORIZED_ACCOUNT = "authorized-account"
    MANUAL_PERMISSION = "manual-permission"


class IdentityResolutionState(StrEnum):
    MATCHED = "matched"
    CREATED = "created"
    MERGED = "merged"
    SPLIT = "split"
    UNRESOLVED = "unresolved"


class PublicationState(StrEnum):
    AUTO_PUBLISH = "auto-publish"
    REVIEW_REQUIRED = "review-required"
    BLOCKED = "blocked"


class SourceAssessment(ContractModel):
    confidence: ConfidenceBand = ConfidenceBand.LOW
    authority_score: int = Field(default=0, ge=0, le=100)
    recency_score: int = Field(default=0, ge=0, le=100)
    specificity_score: int = Field(default=0, ge=0, le=100)
    consistency_score: int = Field(default=0, ge=0, le=100)
    corroboration_score: int = Field(default=0, ge=0, le=100)
    rationale: tuple[str, ...] = ("unreviewed-source-default",)


class SourceEvidence(ContractModel):
    source_id: str = Field(min_length=1)
    kind: SourceKind
    access_basis: SourceAccessBasis
    publisher: str = Field(min_length=1)
    title: str = Field(min_length=1)
    url: HttpUrl
    original_language: str = Field(min_length=1)
    captured_at: datetime
    is_first_hand: bool
    assessment: SourceAssessment = Field(default_factory=SourceAssessment)


class IdentityName(ContractModel):
    value: str = Field(min_length=1)
    language: str = Field(min_length=1)
    kind: str = Field(min_length=1)
    is_primary: bool = False
    source_ids: tuple[str, ...] = Field(min_length=1)


class LegacySlug(ContractModel):
    value: str = Field(min_length=1)
    source_ids: tuple[str, ...] = Field(min_length=1)


class ExternalIdentifier(ContractModel):
    system: str = Field(min_length=1)
    value: str = Field(min_length=1)
    source_ids: tuple[str, ...] = Field(min_length=1)


class LegacyRecordReference(ContractModel):
    contract: str = Field(min_length=1)
    record_type: str = Field(min_length=1)
    record_id: str = Field(min_length=1)
    payload_sha256: str = Field(pattern="^[0-9a-f]{64}$")
    payload: dict[str, JsonValue]


class IdentityResolution(ContractModel):
    state: IdentityResolutionState
    confidence: ConfidenceBand
    source_ids: tuple[str, ...] = Field(min_length=1)
    auxiliary_features: dict[str, JsonValue] = Field(default_factory=dict)
    candidate_panda_ids: tuple[str, ...] = ()
    merged_from_ids: tuple[str, ...] = ()
    split_from_id: str | None = None

    @model_validator(mode="after")
    def validate_state(self) -> IdentityResolution:
        if self.state is IdentityResolutionState.CREATED and not self.auxiliary_features:
            raise ValueError("created identities require at least one auxiliary identity feature")
        if self.state is IdentityResolutionState.UNRESOLVED:
            if not self.candidate_panda_ids:
                raise ValueError("unresolved identities require at least one candidate identity")
        elif self.candidate_panda_ids:
            raise ValueError("candidate panda IDs are only valid for unresolved identities")
        if self.state is IdentityResolutionState.MERGED and not self.merged_from_ids:
            raise ValueError("merged identities require merged_from_ids")
        if self.state is not IdentityResolutionState.MERGED and self.merged_from_ids:
            raise ValueError("merged_from_ids are only valid for merged identities")
        if self.state is IdentityResolutionState.SPLIT and self.split_from_id is None:
            raise ValueError("split identities require split_from_id")
        if self.state is not IdentityResolutionState.SPLIT and self.split_from_id is not None:
            raise ValueError("split_from_id is only valid for split identities")
        return self


class PandaIdentity(ContractModel):
    identity_key: str = Field(min_length=1)
    canonical_panda_id: str | None = None
    canonical_slug: str | None = None
    population_context: PopulationContext = PopulationContext.UNKNOWN
    resolution: IdentityResolution
    names: tuple[IdentityName, ...] = ()
    aliases: tuple[IdentityName, ...] = ()
    legacy_slugs: tuple[LegacySlug, ...] = ()
    external_identifiers: tuple[ExternalIdentifier, ...] = ()
    legacy_records: tuple[LegacyRecordReference, ...] = ()

    @model_validator(mode="after")
    def validate_identity(self) -> PandaIdentity:
        unresolved = self.resolution.state is IdentityResolutionState.UNRESOLVED
        if unresolved:
            if self.canonical_panda_id is not None or self.canonical_slug is not None:
                raise ValueError("unresolved identities cannot expose canonical identity fields")
            return self
        if not self.canonical_panda_id or not self.canonical_slug:
            raise ValueError("resolved identities require canonical panda ID and canonical slug")
        if not self.names:
            raise ValueError("resolved identities require at least one sourced name")
        if not any(name.is_primary for name in self.names):
            raise ValueError("resolved identities require a primary name")
        if any(alias.is_primary for alias in self.aliases):
            raise ValueError("aliases cannot be marked as primary names")
        name_keys = [
            (name.language, name.value.casefold()) for name in (*self.names, *self.aliases)
        ]
        if len(name_keys) != len(set(name_keys)):
            raise ValueError("identity contains duplicate names or aliases")
        legacy_values = [slug.value for slug in self.legacy_slugs]
        if len(legacy_values) != len(set(legacy_values)):
            raise ValueError("identity contains duplicate legacy slugs")
        identifier_keys = [
            (identifier.system, identifier.value) for identifier in self.external_identifiers
        ]
        if len(identifier_keys) != len(set(identifier_keys)):
            raise ValueError("identity contains duplicate external identifiers")
        legacy_record_keys = [
            (record.contract, record.record_type, record.record_id)
            for record in self.legacy_records
        ]
        if len(legacy_record_keys) != len(set(legacy_record_keys)):
            raise ValueError("identity contains duplicate legacy record references")
        return self


class AssertionDerivation(ContractModel):
    rule: str = Field(min_length=1)
    input_assertion_ids: tuple[str, ...] = Field(min_length=1)
    explanation: str = Field(min_length=1)


class EvidenceReference(ContractModel):
    source_id: str = Field(min_length=1)
    evidence_snapshot_id: str = Field(min_length=1)
    evidence_body_sha256: str = Field(pattern="^[0-9a-f]{64}$")
    source_locator: dict[str, JsonValue]
    acquisition_bundle_id: str | None = None
    acquisition_run_id: str | None = None
    candidate_id: str | None = None
    decision_id: str | None = None
    proposal_id: str | None = None
    parser_name: str | None = None
    parser_version: str | None = None
    legacy_payload: dict[str, JsonValue] | None = None


class FactAssertion(ContractModel):
    assertion_id: str = Field(min_length=1)
    subject_id: str = Field(min_length=1)
    field_path: str = Field(min_length=1)
    raw_value: JsonValue
    normalized_value: JsonValue
    source_ids: tuple[str, ...] = Field(min_length=1)
    evidence: tuple[EvidenceReference, ...] = ()
    legacy_records: tuple[LegacyRecordReference, ...] = ()
    confidence: ConfidenceBand
    publication_scope: FactPublicationScope = FactPublicationScope.PUBLIC
    evidence_mode: EvidenceMode
    qualifier: FactQualifier | None = None
    last_verified_at: date
    lifecycle: AssertionLifecycle = AssertionLifecycle.ACTIVE
    derivation: AssertionDerivation | None = None
    superseded_by: str | None = None
    withdrawal_reason: str | None = None

    @model_validator(mode="after")
    def validate_evidence_mode_and_lifecycle(self) -> FactAssertion:
        evidence_ids = [reference.evidence_snapshot_id for reference in self.evidence]
        if len(evidence_ids) != len(set(evidence_ids)):
            raise ValueError("fact assertion contains duplicate evidence references")
        if any(reference.source_id not in self.source_ids for reference in self.evidence):
            raise ValueError("fact assertion evidence must use an assertion source ID")
        legacy_record_keys = [
            (record.contract, record.record_type, record.record_id)
            for record in self.legacy_records
        ]
        if len(legacy_record_keys) != len(set(legacy_record_keys)):
            raise ValueError("fact assertion contains duplicate legacy record references")
        if (
            self.field_path == "death.cause"
            and self.confidence is ConfidenceBand.MEDIUM
            and self.qualifier not in {FactQualifier.REPORTED, FactQualifier.UNCONFIRMED}
        ):
            raise ValueError("medium-confidence death causes require a reported qualifier")
        if self.evidence_mode is EvidenceMode.INFERRED and self.derivation is None:
            raise ValueError("inferred assertions require derivation")
        if self.evidence_mode is EvidenceMode.DIRECT and self.derivation is not None:
            raise ValueError("direct assertions cannot carry derivation")
        if self.lifecycle is AssertionLifecycle.SUPERSEDED:
            if self.superseded_by is None:
                raise ValueError("superseded assertions require superseded_by")
        elif self.superseded_by is not None:
            raise ValueError("superseded_by is only valid for superseded assertions")
        if self.lifecycle is AssertionLifecycle.WITHDRAWN:
            if self.withdrawal_reason is None or not self.withdrawal_reason.strip():
                raise ValueError("withdrawn assertions require withdrawal_reason")
        elif self.withdrawal_reason is not None:
            raise ValueError("withdrawal_reason is only valid for withdrawn assertions")
        return self


class FactConclusion(ContractModel):
    field_path: str = Field(min_length=1)
    status: ConclusionStatus
    primary_assertion_id: str | None = None
    alternative_assertion_ids: tuple[str, ...] = ()

    @model_validator(mode="after")
    def validate_shape(self) -> FactConclusion:
        if self.status is ConclusionStatus.DISPUTED:
            if self.primary_assertion_id is None or not self.alternative_assertion_ids:
                raise ValueError(
                    "disputed conclusions require a primary assertion and alternatives"
                )
        elif self.status in {ConclusionStatus.CONFIRMED, ConclusionStatus.TENTATIVE}:
            if self.primary_assertion_id is None:
                raise ValueError("publishable conclusions require a primary assertion")
            if self.alternative_assertion_ids:
                raise ValueError("only disputed conclusions may expose alternatives")
        elif self.primary_assertion_id is not None or self.alternative_assertion_ids:
            raise ValueError("superseded and unknown conclusions cannot select active assertions")
        if len(set(self.alternative_assertion_ids)) != len(self.alternative_assertion_ids):
            raise ValueError("conclusion contains duplicate alternative assertion IDs")
        if self.primary_assertion_id in self.alternative_assertion_ids:
            raise ValueError("primary assertion cannot also be an alternative")
        return self


class RelationshipAssertion(ContractModel):
    relationship_id: str = Field(min_length=1)
    subject_id: str = Field(min_length=1)
    object_id: str = Field(min_length=1)
    relationship_type: RelationshipType
    status: RelationshipStatus
    confidence: ConfidenceBand
    source_ids: tuple[str, ...] = Field(min_length=1)
    last_verified_at: date
    lifecycle: AssertionLifecycle = AssertionLifecycle.ACTIVE
    superseded_by: str | None = None
    withdrawal_reason: str | None = None

    @model_validator(mode="after")
    def validate_confidence_and_lifecycle(self) -> RelationshipAssertion:
        allowed_statuses = {
            ConfidenceBand.HIGH: {RelationshipStatus.CONFIRMED, RelationshipStatus.DISPUTED},
            ConfidenceBand.MEDIUM: {
                RelationshipStatus.TENTATIVE,
                RelationshipStatus.DISPUTED,
            },
            ConfidenceBand.LOW: {RelationshipStatus.REVIEW_ONLY},
        }
        if self.status not in allowed_statuses[self.confidence]:
            raise ValueError("relationship status does not match its confidence band")
        if self.subject_id == self.object_id:
            raise ValueError("relationship endpoints must be different pandas")
        if self.lifecycle is AssertionLifecycle.SUPERSEDED:
            if self.superseded_by is None:
                raise ValueError("superseded relationships require superseded_by")
        elif self.superseded_by is not None:
            raise ValueError("relationship superseded_by is only valid when superseded")
        if self.lifecycle is AssertionLifecycle.WITHDRAWN:
            if self.withdrawal_reason is None or not self.withdrawal_reason.strip():
                raise ValueError("withdrawn relationships require withdrawal_reason")
        elif self.withdrawal_reason is not None:
            raise ValueError("relationship withdrawal_reason is only valid when withdrawn")
        return self


class MediaAsset(ContractModel):
    media_id: str = Field(min_length=1)
    panda_id: str = Field(min_length=1)
    source_id: str = Field(min_length=1)
    source_url: HttpUrl
    library: MediaLibrary
    rights_status: MediaRightsStatus
    panda_match_confidence: ConfidenceBand
    is_main: bool = False
    author: str | None = None
    license_name: str | None = None
    license_url: HttpUrl | None = None
    authorization_reference: str | None = None
    sha256: str | None = Field(default=None, pattern="^[0-9a-f]{64}$")
    perceptual_hash: str | None = None
    withdrawal_reason: str | None = None

    @model_validator(mode="after")
    def validate_rights_and_role(self) -> MediaAsset:
        cleared_rights = {
            MediaRightsStatus.PUBLIC_DOMAIN,
            MediaRightsStatus.OPEN_LICENSE,
            MediaRightsStatus.EXPLICIT_AUTHORIZATION,
        }
        if self.library is MediaLibrary.PUBLIC and self.rights_status not in cleared_rights:
            raise ValueError("public media require cleared rights")
        if self.rights_status is MediaRightsStatus.OPEN_LICENSE:
            if not self.license_name or self.license_url is None:
                raise ValueError("open-license media require license name and URL")
        elif self.license_name is not None or self.license_url is not None:
            raise ValueError("license metadata is only valid for open-license media")
        if self.rights_status is MediaRightsStatus.EXPLICIT_AUTHORIZATION:
            if self.authorization_reference is None or not self.authorization_reference.strip():
                raise ValueError("authorized media require an authorization reference")
        elif self.authorization_reference is not None:
            raise ValueError(
                "authorization reference is only valid for explicitly authorized media"
            )
        if self.rights_status is MediaRightsStatus.WITHDRAWN:
            if self.withdrawal_reason is None or not self.withdrawal_reason.strip():
                raise ValueError("withdrawn media require withdrawal_reason")
            if self.library is MediaLibrary.PUBLIC:
                raise ValueError("withdrawn media cannot remain in the public library")
        elif self.withdrawal_reason is not None:
            raise ValueError("media withdrawal_reason is only valid for withdrawn media")
        if (
            self.library is MediaLibrary.PUBLIC
            and self.panda_match_confidence is ConfidenceBand.LOW
        ):
            raise ValueError("low-confidence panda matches cannot enter the public library")
        if self.is_main:
            if self.library is not MediaLibrary.PUBLIC:
                raise ValueError("main images must be in the public library")
            if self.panda_match_confidence is not ConfidenceBand.HIGH:
                raise ValueError("main images require high-confidence panda identity matching")
        return self


class TranslationValue(ContractModel):
    translation_id: str = Field(min_length=1)
    subject_type: str = Field(min_length=1)
    subject_id: str = Field(min_length=1)
    locale: str = Field(min_length=1)
    text: str = Field(min_length=1)
    status: TranslationStatus
    source_language: str = Field(min_length=1)
    source_ids: tuple[str, ...] = ()
    based_on_assertion_ids: tuple[str, ...] = ()
    generator_version: str | None = None
    generated_at: datetime | None = None
    reviewed_by: str | None = None
    superseded_by: str | None = None
    withdrawal_reason: str | None = None

    @model_validator(mode="after")
    def validate_translation_state(self) -> TranslationValue:
        if self.status is TranslationStatus.SOURCE:
            if not self.source_ids:
                raise ValueError("source-language text requires source IDs")
            if self.based_on_assertion_ids or self.generator_version or self.generated_at:
                raise ValueError("source-language text cannot carry generation metadata")
            if self.reviewed_by is not None:
                raise ValueError("source-language text cannot carry review metadata")
        elif self.status is TranslationStatus.GENERATED:
            if not self.based_on_assertion_ids:
                raise ValueError("generated translations require assertion basis")
            if not self.generator_version or self.generated_at is None:
                raise ValueError("generated translations require generator metadata")
            if self.reviewed_by is not None:
                raise ValueError("generated translations cannot carry review metadata")
        elif self.status is TranslationStatus.REVIEWED:
            if not self.reviewed_by:
                raise ValueError("reviewed translations require reviewed_by")
            if not self.source_ids and not self.based_on_assertion_ids:
                raise ValueError("reviewed translations require evidence or assertion basis")
        elif self.status is TranslationStatus.OUTDATED:
            if not self.superseded_by:
                raise ValueError("outdated translations require superseded_by")
        elif self.status is TranslationStatus.WITHDRAWN and not self.withdrawal_reason:
            raise ValueError("withdrawn translations require withdrawal_reason")

        if self.status is not TranslationStatus.OUTDATED and self.superseded_by is not None:
            raise ValueError("translation superseded_by is only valid when outdated")
        if self.status is not TranslationStatus.WITHDRAWN and self.withdrawal_reason is not None:
            raise ValueError("translation withdrawal_reason is only valid when withdrawn")
        return self


class LocationValue(ContractModel):
    label: str = Field(min_length=1)
    precision: LocationPrecision
    coordinates: tuple[float, float] | None = None

    @model_validator(mode="after")
    def validate_coordinates(self) -> LocationValue:
        if self.coordinates is not None:
            longitude, latitude = self.coordinates
            if not -180 <= longitude <= 180 or not -90 <= latitude <= 90:
                raise ValueError("location coordinates are outside valid bounds")
            if self.precision not in {LocationPrecision.EXACT, LocationPrecision.FACILITY}:
                raise ValueError("coordinates require exact or facility precision")
        if self.precision is LocationPrecision.EXACT and self.coordinates is None:
            raise ValueError("exact locations require coordinates")
        return self


class LocationDisclosure(ContractModel):
    location_id: str = Field(min_length=1)
    panda_id: str = Field(min_length=1)
    source_ids: tuple[str, ...] = Field(min_length=1)
    state: LocationDisclosureState
    public_location: LocationValue | None = None
    restricted_location: LocationValue | None = None

    @model_validator(mode="after")
    def validate_disclosure(self) -> LocationDisclosure:
        if self.state is LocationDisclosureState.PUBLIC:
            if self.public_location is None:
                raise ValueError("public location disclosures require public_location")
            if self.restricted_location is not None:
                raise ValueError("public location disclosures cannot contain restricted_location")
        else:
            if self.restricted_location is None:
                raise ValueError("generalized and restricted locations require restricted_location")
            if self.public_location is not None and self.public_location.precision in {
                LocationPrecision.EXACT,
                LocationPrecision.FACILITY,
            }:
                raise ValueError(
                    "generalized public locations require locality precision or coarser"
                )
        return self


class RightsDeclaration(ContractModel):
    declarant_name: str = Field(min_length=1)
    basis: RightsDeclarationBasis
    license_scope: str = Field(min_length=1)
    evidence_references: tuple[str, ...] = Field(min_length=1)
    declared_at: datetime


class ContributionRecord(ContractModel):
    contribution_id: str = Field(min_length=1)
    panda_id: str = Field(min_length=1)
    kind: ContributionKind
    state: ContributionState
    submitter_id: str = Field(min_length=1)
    submitted_at: datetime
    payload: dict[str, JsonValue]
    source_ids: tuple[str, ...] = ()
    rights_declaration: RightsDeclaration | None = None
    reviewed_by: str | None = None
    decided_at: datetime | None = None
    decision_reason: str | None = None
    withdrawal_reason: str | None = None

    @model_validator(mode="after")
    def validate_contribution_state(self) -> ContributionRecord:
        if not self.payload:
            raise ValueError("contributions require a non-empty payload")
        if self.kind is ContributionKind.PHOTO_UPLOAD and self.rights_declaration is None:
            raise ValueError("photo uploads require a rights declaration")
        if self.kind is not ContributionKind.PHOTO_UPLOAD and self.rights_declaration is not None:
            raise ValueError("rights declarations are only valid for photo uploads")
        if self.state in {ContributionState.APPROVED, ContributionState.REJECTED}:
            if not self.reviewed_by or self.decided_at is None:
                raise ValueError("reviewed contributions require reviewer and decision time")
            if not self.decision_reason:
                raise ValueError("reviewed contributions require a decision reason")
        elif self.reviewed_by is not None or self.decided_at is not None or self.decision_reason:
            raise ValueError("review metadata is only valid for approved or rejected contributions")
        if self.state is ContributionState.WITHDRAWN:
            if not self.withdrawal_reason:
                raise ValueError("withdrawn contributions require withdrawal_reason")
        elif self.withdrawal_reason is not None:
            raise ValueError("withdrawal_reason is only valid for withdrawn contributions")
        return self


class PandaKnowledgeRecord(ContractModel):
    identity: PandaIdentity
    assertions: tuple[FactAssertion, ...] = ()
    conclusions: tuple[FactConclusion, ...] = ()
    relationships: tuple[RelationshipAssertion, ...] = ()
    media: tuple[MediaAsset, ...] = ()
    translations: tuple[TranslationValue, ...] = ()
    locations: tuple[LocationDisclosure, ...] = ()
    contributions: tuple[ContributionRecord, ...] = ()


class PandaKnowledgeBundle(ContractModel):
    schema_version: Literal[SCHEMA_VERSION] = SCHEMA_VERSION
    bundle_id: str = Field(min_length=1)
    created_at: datetime
    sources: tuple[SourceEvidence, ...] = Field(min_length=1)
    records: tuple[PandaKnowledgeRecord, ...] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_references(self) -> PandaKnowledgeBundle:
        source_ids = [source.source_id for source in self.sources]
        if len(source_ids) != len(set(source_ids)):
            raise ValueError("knowledge bundle contains duplicate source IDs")
        known_source_ids = set(source_ids)

        identity_keys: set[str] = set()
        for record in self.records:
            identity = record.identity
            if identity.identity_key in identity_keys:
                raise ValueError("knowledge bundle contains duplicate identity keys")
            identity_keys.add(identity.identity_key)
            referenced_sources = set(identity.resolution.source_ids)
            referenced_sources.update(
                source_id
                for name in (*identity.names, *identity.aliases)
                for source_id in name.source_ids
            )
            referenced_sources.update(
                source_id for slug in identity.legacy_slugs for source_id in slug.source_ids
            )
            referenced_sources.update(
                source_id
                for identifier in identity.external_identifiers
                for source_id in identifier.source_ids
            )
            unknown = referenced_sources - known_source_ids
            if unknown:
                raise ValueError(
                    "identity references unknown source IDs: " + ", ".join(sorted(unknown))
                )

            assertions_by_id: dict[str, FactAssertion] = {}
            valid_subject_ids = {identity.identity_key}
            if identity.canonical_panda_id is not None:
                valid_subject_ids.add(identity.canonical_panda_id)
            for assertion in record.assertions:
                if assertion.assertion_id in assertions_by_id:
                    raise ValueError("knowledge record contains duplicate assertion IDs")
                if assertion.subject_id not in valid_subject_ids:
                    raise ValueError("fact assertion subject does not match its panda identity")
                unknown_assertion_sources = set(assertion.source_ids) - known_source_ids
                if unknown_assertion_sources:
                    raise ValueError(
                        "fact assertion references unknown source IDs: "
                        + ", ".join(sorted(unknown_assertion_sources))
                    )
                assertions_by_id[assertion.assertion_id] = assertion

            for assertion in record.assertions:
                if assertion.superseded_by is not None:
                    replacement = assertions_by_id.get(assertion.superseded_by)
                    if replacement is None:
                        raise ValueError("superseded assertion references an unknown replacement")
                    if replacement.field_path != assertion.field_path:
                        raise ValueError("superseding assertions must address the same field")
                if assertion.derivation is not None:
                    for input_assertion_id in assertion.derivation.input_assertion_ids:
                        input_assertion = assertions_by_id.get(input_assertion_id)
                        if input_assertion is None:
                            raise ValueError("assertion derivation references an unknown input")
                        if input_assertion.lifecycle is not AssertionLifecycle.ACTIVE:
                            raise ValueError("assertion derivation requires active inputs")
                        if input_assertion.confidence is ConfidenceBand.LOW:
                            raise ValueError(
                                "assertion derivation cannot use low-confidence inputs"
                            )

            conclusion_fields: set[str] = set()
            for conclusion in record.conclusions:
                if conclusion.field_path in conclusion_fields:
                    raise ValueError("knowledge record contains duplicate fact conclusions")
                conclusion_fields.add(conclusion.field_path)
                selected_ids = tuple(
                    assertion_id
                    for assertion_id in (
                        conclusion.primary_assertion_id,
                        *conclusion.alternative_assertion_ids,
                    )
                    if assertion_id is not None
                )
                for assertion_id in selected_ids:
                    assertion = assertions_by_id.get(assertion_id)
                    if assertion is None:
                        raise ValueError("fact conclusion references an unknown assertion")
                    if assertion.field_path != conclusion.field_path:
                        raise ValueError("fact conclusion mixes assertions from different fields")
                    if assertion.lifecycle is not AssertionLifecycle.ACTIVE:
                        raise ValueError("fact conclusion can only select active assertions")
                    if assertion.confidence is ConfidenceBand.LOW:
                        raise ValueError("low-confidence assertions cannot be public conclusions")
                primary = (
                    assertions_by_id.get(conclusion.primary_assertion_id)
                    if conclusion.primary_assertion_id is not None
                    else None
                )
                if primary is not None and primary.evidence_mode is EvidenceMode.INFERRED:
                    direct_active = any(
                        assertion.field_path == conclusion.field_path
                        and assertion.lifecycle is AssertionLifecycle.ACTIVE
                        and assertion.evidence_mode is EvidenceMode.DIRECT
                        and assertion.confidence in {ConfidenceBand.HIGH, ConfidenceBand.MEDIUM}
                        for assertion in record.assertions
                    )
                    if direct_active:
                        raise ValueError(
                            "inferred assertions cannot replace direct evidence "
                            "as the primary value"
                        )

            relationships_by_id: dict[str, RelationshipAssertion] = {}
            for relationship in record.relationships:
                if relationship.relationship_id in relationships_by_id:
                    raise ValueError("knowledge record contains duplicate relationship IDs")
                if relationship.subject_id not in valid_subject_ids:
                    raise ValueError("relationship subject does not match its panda identity")
                unknown_relationship_sources = set(relationship.source_ids) - known_source_ids
                if unknown_relationship_sources:
                    raise ValueError(
                        "relationship references unknown source IDs: "
                        + ", ".join(sorted(unknown_relationship_sources))
                    )
                relationships_by_id[relationship.relationship_id] = relationship
            for relationship in record.relationships:
                if relationship.superseded_by is not None:
                    replacement = relationships_by_id.get(relationship.superseded_by)
                    if replacement is None:
                        raise ValueError(
                            "superseded relationship references an unknown replacement"
                        )
                    if (
                        replacement.subject_id != relationship.subject_id
                        or replacement.object_id != relationship.object_id
                        or replacement.relationship_type != relationship.relationship_type
                    ):
                        raise ValueError(
                            "superseding relationships must address the same endpoints and type"
                        )

            media_ids: set[str] = set()
            main_media_count = 0
            for media in record.media:
                if media.media_id in media_ids:
                    raise ValueError("knowledge record contains duplicate media IDs")
                media_ids.add(media.media_id)
                if media.panda_id not in valid_subject_ids:
                    raise ValueError("media panda ID does not match its knowledge record")
                if media.source_id not in known_source_ids:
                    raise ValueError("media references an unknown source ID")
                if media.is_main:
                    main_media_count += 1
            if main_media_count > 1:
                raise ValueError("knowledge record can expose at most one main image")

            translations_by_id: dict[str, TranslationValue] = {}
            for translation in record.translations:
                if translation.translation_id in translations_by_id:
                    raise ValueError("knowledge record contains duplicate translation IDs")
                unknown_translation_sources = set(translation.source_ids) - known_source_ids
                if unknown_translation_sources:
                    raise ValueError("translation references unknown source IDs")
                for assertion_id in translation.based_on_assertion_ids:
                    assertion = assertions_by_id.get(assertion_id)
                    if assertion is None:
                        raise ValueError("translation references an unknown assertion")
                    if assertion.lifecycle is not AssertionLifecycle.ACTIVE:
                        raise ValueError("translations can only use active assertions")
                    if assertion.confidence is ConfidenceBand.LOW:
                        raise ValueError("translations cannot use low-confidence assertions")
                translations_by_id[translation.translation_id] = translation
            for translation in record.translations:
                if translation.superseded_by is not None:
                    replacement = translations_by_id.get(translation.superseded_by)
                    if replacement is None:
                        raise ValueError("outdated translation references an unknown replacement")
                    if (
                        replacement.subject_type != translation.subject_type
                        or replacement.subject_id != translation.subject_id
                        or replacement.locale != translation.locale
                    ):
                        raise ValueError(
                            "replacement translation must address the same subject and locale"
                        )

            location_ids: set[str] = set()
            for location in record.locations:
                if location.location_id in location_ids:
                    raise ValueError("knowledge record contains duplicate location IDs")
                location_ids.add(location.location_id)
                if location.panda_id not in valid_subject_ids:
                    raise ValueError("location panda ID does not match its knowledge record")
                if set(location.source_ids) - known_source_ids:
                    raise ValueError("location references unknown source IDs")
                public_location = location.public_location
                if (
                    identity.population_context
                    in {PopulationContext.WILD, PopulationContext.RELEASED}
                    and public_location is not None
                    and public_location.precision
                    in {LocationPrecision.EXACT, LocationPrecision.FACILITY}
                ):
                    raise ValueError("wild panda locations cannot expose exact activity locations")

            contribution_ids: set[str] = set()
            for contribution in record.contributions:
                if contribution.contribution_id in contribution_ids:
                    raise ValueError("knowledge record contains duplicate contribution IDs")
                contribution_ids.add(contribution.contribution_id)
                if contribution.panda_id not in valid_subject_ids:
                    raise ValueError("contribution panda ID does not match its knowledge record")
                if set(contribution.source_ids) - known_source_ids:
                    raise ValueError("contribution references unknown source IDs")
                declaration = contribution.rights_declaration
                if declaration is not None and declaration.declared_at > contribution.submitted_at:
                    raise ValueError("rights declaration cannot follow contribution submission")
        return self


class PublicationDecision(ContractModel):
    identity_key: str
    state: PublicationState
    public_assertion_ids: tuple[str, ...] = ()
    review_assertion_ids: tuple[str, ...] = ()
    public_relationship_ids: tuple[str, ...] = ()
    review_relationship_ids: tuple[str, ...] = ()
    public_media_ids: tuple[str, ...] = ()
    blockers: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()


def evaluate_record_publication(
    bundle: PandaKnowledgeBundle,
    identity_key: str,
) -> PublicationDecision:
    record = next(
        (item for item in bundle.records if item.identity.identity_key == identity_key),
        None,
    )
    if record is None:
        raise KeyError(f"unknown panda identity: {identity_key}")

    identity = record.identity
    blockers: list[str] = []
    if identity.resolution.state is IdentityResolutionState.UNRESOLVED:
        blockers.append("unresolved-identity")
    elif identity.resolution.confidence is not ConfidenceBand.HIGH:
        blockers.append("identity-review-required")

    if blockers:
        state = (
            PublicationState.BLOCKED
            if "unresolved-identity" in blockers
            else PublicationState.REVIEW_REQUIRED
        )
    else:
        state = PublicationState.AUTO_PUBLISH

    active_assertions = [
        assertion
        for assertion in record.assertions
        if assertion.lifecycle is AssertionLifecycle.ACTIVE
    ]
    eligible_assertion_ids = tuple(
        sorted(
            assertion.assertion_id
            for assertion in active_assertions
            if assertion.confidence in {ConfidenceBand.HIGH, ConfidenceBand.MEDIUM}
            and assertion.publication_scope is FactPublicationScope.PUBLIC
        )
    )
    review_candidate_assertion_ids = tuple(
        sorted(
            assertion.assertion_id
            for assertion in active_assertions
            if assertion.confidence is ConfidenceBand.LOW
            or assertion.publication_scope is not FactPublicationScope.PUBLIC
        )
    )
    active_relationships = [
        relationship
        for relationship in record.relationships
        if relationship.lifecycle is AssertionLifecycle.ACTIVE
    ]
    eligible_relationship_ids = tuple(
        sorted(
            relationship.relationship_id
            for relationship in active_relationships
            if relationship.confidence in {ConfidenceBand.HIGH, ConfidenceBand.MEDIUM}
        )
    )
    low_confidence_relationship_ids = tuple(
        sorted(
            relationship.relationship_id
            for relationship in active_relationships
            if relationship.confidence is ConfidenceBand.LOW
        )
    )
    eligible_media_ids = tuple(
        sorted(media.media_id for media in record.media if media.library is MediaLibrary.PUBLIC)
    )

    if state is PublicationState.AUTO_PUBLISH:
        public_assertion_ids = eligible_assertion_ids
        review_assertion_ids = review_candidate_assertion_ids
        public_relationship_ids = eligible_relationship_ids
        review_relationship_ids = low_confidence_relationship_ids
        public_media_ids = eligible_media_ids
        warnings = () if public_media_ids else ("missing-cleared-media",)
    else:
        public_assertion_ids = ()
        review_assertion_ids = tuple(
            sorted((*eligible_assertion_ids, *review_candidate_assertion_ids))
        )
        public_relationship_ids = ()
        review_relationship_ids = tuple(
            sorted((*eligible_relationship_ids, *low_confidence_relationship_ids))
        )
        public_media_ids = ()
        warnings = ()

    return PublicationDecision(
        identity_key=identity_key,
        state=state,
        public_assertion_ids=public_assertion_ids,
        review_assertion_ids=review_assertion_ids,
        public_relationship_ids=public_relationship_ids,
        review_relationship_ids=review_relationship_ids,
        public_media_ids=public_media_ids,
        blockers=tuple(blockers),
        warnings=warnings,
    )
