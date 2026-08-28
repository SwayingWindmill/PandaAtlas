"""Deterministic bulk panda identity resolution and reversible identity operations."""

from .adapters import canonical_record_from_panda_identity
from .contracts import (
    SCHEMA_VERSION,
    CanonicalIdentityRecord,
    IdentityAuditRecord,
    IdentityBatchSummary,
    IdentityCandidateRecord,
    IdentityChangeKind,
    IdentityChangeSet,
    IdentityDecision,
    IdentityDecisionKind,
    IdentityEvidence,
    IdentityFeatureSet,
    IdentityIdentifierClaim,
    IdentityMatchScore,
    IdentityNameClaim,
    IdentityResolutionBatch,
    IdentityResolutionPackage,
    IdentityRiskLevel,
    IdentityRollbackPlan,
)
from .io import (
    IDENTITY_PACKAGE_FILENAME,
    IdentityArtifactPath,
    build_identity_resolution_package,
    write_identity_resolution_package,
)
from .operations import plan_identity_merge, plan_identity_split
from .resolver import resolve_identity_batch

__all__ = [
    "IDENTITY_PACKAGE_FILENAME",
    "SCHEMA_VERSION",
    "CanonicalIdentityRecord",
    "IdentityArtifactPath",
    "IdentityAuditRecord",
    "IdentityBatchSummary",
    "IdentityCandidateRecord",
    "IdentityChangeKind",
    "IdentityChangeSet",
    "IdentityDecision",
    "IdentityDecisionKind",
    "IdentityEvidence",
    "IdentityFeatureSet",
    "IdentityIdentifierClaim",
    "IdentityMatchScore",
    "IdentityNameClaim",
    "IdentityResolutionBatch",
    "IdentityResolutionPackage",
    "IdentityRiskLevel",
    "IdentityRollbackPlan",
    "build_identity_resolution_package",
    "canonical_record_from_panda_identity",
    "plan_identity_merge",
    "plan_identity_split",
    "resolve_identity_batch",
    "write_identity_resolution_package",
]
