from __future__ import annotations

from app.identity_resolution import IdentityCandidateRecord

from .contracts import (
    IdentityCandidateBatch,
    IdentitySubjectExtraction,
    identity_candidate_batch_id,
)


def build_identity_candidate_batch(
    extractions: tuple[IdentitySubjectExtraction, ...],
) -> IdentityCandidateBatch:
    """Convert traceable source-local identity extractions into resolver candidates."""

    ordered_extractions = tuple(sorted(extractions, key=lambda item: item.record_id))
    if len({item.record_id for item in ordered_extractions}) != len(ordered_extractions):
        raise ValueError("identity extraction batch contains duplicate source-local subjects")

    candidates = tuple(
        IdentityCandidateRecord(
            record_id=extraction.record_id,
            names=extraction.names,
            features=extraction.features,
            source_ids=(extraction.source_id,),
            population_context=extraction.population_context,
        )
        for extraction in ordered_extractions
    )
    return IdentityCandidateBatch(
        batch_id=identity_candidate_batch_id(ordered_extractions),
        extractions=ordered_extractions,
        candidates=candidates,
    )
