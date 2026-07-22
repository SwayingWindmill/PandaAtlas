from __future__ import annotations

import hashlib
import json
from datetime import date, datetime

from pydantic import JsonValue, TypeAdapter

from app.acquisition.curation.models import CurationPatchProposal
from app.domain.trusted_identity import EvidenceAssertion, TrustedIdentity

from .contracts import (
    AssertionDerivation,
    AssertionLifecycle,
    ConfidenceBand,
    EvidenceMode,
    EvidenceReference,
    ExternalIdentifier,
    FactAssertion,
    FactPublicationScope,
    IdentityName,
    IdentityResolution,
    IdentityResolutionState,
    LegacyRecordReference,
    LegacySlug,
    PandaIdentity,
    PandaKnowledgeBundle,
    PandaKnowledgeRecord,
    SourceEvidence,
)

_JSON_VALUE_ADAPTER = TypeAdapter(JsonValue)


def migrate_curation_patch_proposal(
    proposal: CurationPatchProposal,
    *,
    assertion_id: str,
    field_path: str,
    confidence: ConfidenceBand,
    evidence_mode: EvidenceMode,
    last_verified_at: date,
    derivation: AssertionDerivation | None = None,
) -> FactAssertion:
    """Convert one accepted legacy patch proposal without discarding its audit trail."""

    provenance = proposal.provenance
    subject_id = (
        proposal.subject.matched_panda_id
        or proposal.subject.matched_canonical_slug
        or proposal.subject.source_identity
    )
    evidence = EvidenceReference(
        source_id=provenance.source_id,
        evidence_snapshot_id=provenance.evidence_snapshot_id,
        evidence_body_sha256=provenance.evidence_body_sha256,
        source_locator=provenance.source_locator.to_dict(),
        acquisition_bundle_id=provenance.acquisition_bundle_id,
        acquisition_run_id=provenance.acquisition_run_id,
        candidate_id=provenance.candidate_id,
        decision_id=provenance.decision.decision_id,
        proposal_id=proposal.proposal_id,
        parser_name=provenance.parser_name,
        parser_version=provenance.parser_version,
        legacy_payload=proposal.to_dict(),
    )
    return FactAssertion(
        assertion_id=assertion_id,
        subject_id=subject_id,
        field_path=field_path,
        raw_value=provenance.raw_value,
        normalized_value=provenance.normalized_value,
        source_ids=(provenance.source_id,),
        evidence=(evidence,),
        confidence=confidence,
        evidence_mode=evidence_mode,
        derivation=derivation,
        last_verified_at=last_verified_at,
    )


def _legacy_reference(
    *,
    contract: str,
    record_type: str,
    record_id: str,
    payload: dict[str, JsonValue],
) -> LegacyRecordReference:
    encoded = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return LegacyRecordReference(
        contract=contract,
        record_type=record_type,
        record_id=record_id,
        payload_sha256=hashlib.sha256(encoded).hexdigest(),
        payload=payload,
    )


def _trusted_identity_payload(identity: TrustedIdentity) -> dict[str, JsonValue]:
    return {
        "id": str(identity.id),
        "canonical_slug": identity.canonical_slug,
        "names": [
            {
                "value": name.value,
                "language": name.language,
                "kind": name.kind,
                "source_ids": list(name.source_ids),
            }
            for name in identity.names
        ],
        "aliases": [
            {
                "value": alias.value,
                "language": alias.language,
                "kind": alias.kind,
                "source_ids": list(alias.source_ids),
            }
            for alias in identity.aliases
        ],
        "legacy_slugs": list(identity.legacy_slugs),
        "external_identifiers": [
            {
                "system": identifier.system,
                "value": identifier.value,
                "source_ids": list(identifier.source_ids),
            }
            for identifier in identity.external_identifiers
        ],
    }


def _evidence_assertion_payload(assertion: EvidenceAssertion) -> dict[str, JsonValue]:
    return {
        "id": assertion.id,
        "field": assertion.field,
        "value": _JSON_VALUE_ADAPTER.validate_python(assertion.value),
        "source_ids": list(assertion.source_ids),
        "certainty": assertion.certainty,
        "publication_status": assertion.publication_status,
        "last_verified_at": assertion.last_verified_at.isoformat(),
        "superseded_by": assertion.superseded_by,
    }


def migrate_trusted_profile(
    *,
    identity: TrustedIdentity,
    assertions: tuple[EvidenceAssertion, ...],
    sources: tuple[SourceEvidence, ...],
    bundle_id: str,
    created_at: datetime,
) -> PandaKnowledgeBundle:
    """Migrate the legacy trusted identity and assertion projection into v1."""

    identity_source_ids = tuple(
        sorted(
            {
                source_id
                for item in (*identity.names, *identity.aliases, *identity.external_identifiers)
                for source_id in item.source_ids
            }
        )
    )
    if not identity_source_ids:
        raise ValueError("trusted identity migration requires at least one source ID")

    canonical_id = str(identity.id)
    migrated_identity = PandaIdentity(
        identity_key=canonical_id,
        canonical_panda_id=canonical_id,
        canonical_slug=identity.canonical_slug,
        resolution=IdentityResolution(
            state=IdentityResolutionState.MATCHED,
            confidence=ConfidenceBand.HIGH,
            source_ids=identity_source_ids,
        ),
        names=tuple(
            IdentityName(
                value=name.value,
                language=name.language,
                kind=name.kind,
                is_primary=index == 0,
                source_ids=name.source_ids,
            )
            for index, name in enumerate(identity.names)
        ),
        aliases=tuple(
            IdentityName(
                value=alias.value,
                language=alias.language,
                kind=alias.kind,
                source_ids=alias.source_ids,
            )
            for alias in identity.aliases
        ),
        legacy_slugs=tuple(
            LegacySlug(value=slug, source_ids=identity_source_ids) for slug in identity.legacy_slugs
        ),
        external_identifiers=tuple(
            ExternalIdentifier(
                system=identifier.system,
                value=identifier.value,
                source_ids=identifier.source_ids,
            )
            for identifier in identity.external_identifiers
        ),
        legacy_records=(
            _legacy_reference(
                contract="trusted-identity/v1",
                record_type="trusted-identity",
                record_id=canonical_id,
                payload=_trusted_identity_payload(identity),
            ),
        ),
    )

    scope_by_status = {
        "published": FactPublicationScope.PUBLIC,
        "draft": FactPublicationScope.REVIEW_ONLY,
        "restricted": FactPublicationScope.RESTRICTED,
    }
    migrated_assertions = tuple(
        FactAssertion(
            assertion_id=assertion.id,
            subject_id=canonical_id,
            field_path=assertion.field,
            raw_value=_JSON_VALUE_ADAPTER.validate_python(assertion.value),
            normalized_value=_JSON_VALUE_ADAPTER.validate_python(assertion.value),
            source_ids=assertion.source_ids,
            legacy_records=(
                _legacy_reference(
                    contract="trusted-identity/v1",
                    record_type="evidence-assertion",
                    record_id=assertion.id,
                    payload=_evidence_assertion_payload(assertion),
                ),
            ),
            confidence=(
                ConfidenceBand.HIGH if assertion.certainty == "confirmed" else ConfidenceBand.MEDIUM
            ),
            publication_scope=scope_by_status[assertion.publication_status],
            evidence_mode=EvidenceMode.DIRECT,
            last_verified_at=assertion.last_verified_at,
            lifecycle=(
                AssertionLifecycle.SUPERSEDED
                if assertion.superseded_by is not None
                else AssertionLifecycle.ACTIVE
            ),
            superseded_by=assertion.superseded_by,
        )
        for assertion in assertions
    )
    return PandaKnowledgeBundle(
        bundle_id=bundle_id,
        created_at=created_at,
        sources=sources,
        records=(
            PandaKnowledgeRecord(
                identity=migrated_identity,
                assertions=migrated_assertions,
            ),
        ),
    )
