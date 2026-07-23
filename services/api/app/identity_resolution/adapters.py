from __future__ import annotations

from datetime import date

from app.knowledge.contracts import IdentityResolutionState, PandaIdentity

from .contracts import (
    CanonicalIdentityRecord,
    IdentityFeatureSet,
    IdentityIdentifierClaim,
    IdentityNameClaim,
)


def canonical_record_from_panda_identity(identity: PandaIdentity) -> CanonicalIdentityRecord:
    """Convert the canonical knowledge identity contract into resolver input."""

    if identity.resolution.state is IdentityResolutionState.UNRESOLVED:
        raise ValueError("unresolved knowledge identities cannot be canonical resolver inputs")
    if identity.canonical_panda_id is None or identity.canonical_slug is None:
        raise ValueError("canonical resolver inputs require stable panda ID and slug")

    auxiliary = identity.resolution.auxiliary_features
    names = tuple(
        IdentityNameClaim(
            value=name.value,
            language=name.language,
            kind=name.kind,
        )
        for name in (*identity.names, *identity.aliases)
    )
    source_ids = tuple(
        sorted(
            {
                *identity.resolution.source_ids,
                *(
                    source_id
                    for name in (*identity.names, *identity.aliases)
                    for source_id in name.source_ids
                ),
                *(
                    source_id
                    for identifier in identity.external_identifiers
                    for source_id in identifier.source_ids
                ),
            }
        )
    )
    return CanonicalIdentityRecord(
        panda_id=identity.canonical_panda_id,
        canonical_slug=identity.canonical_slug,
        names=names,
        features=IdentityFeatureSet(
            birth_date=_optional_date(auxiliary.get("birth_date")),
            birth_year=_optional_int(auxiliary.get("birth_year")),
            sex=_optional_string(auxiliary.get("sex")),
            parent_ids=_string_tuple(auxiliary.get("parent_ids")),
            parent_names=_string_tuple(auxiliary.get("parent_names")),
            institution_ids=_string_tuple(auxiliary.get("institution_ids")),
            movement_institution_ids=_string_tuple(auxiliary.get("movement_institution_ids")),
            source_relationship_ids=_string_tuple(auxiliary.get("source_relationship_ids")),
            external_identifiers=tuple(
                sorted(
                    (
                        IdentityIdentifierClaim(
                            system=identifier.system,
                            value=identifier.value,
                        )
                        for identifier in identity.external_identifiers
                    ),
                    key=lambda item: (item.system.casefold(), item.value.casefold()),
                )
            ),
            stable_wild_identifier=_optional_string(auxiliary.get("stable_wild_identifier")),
            is_group_observation=False,
        ),
        source_ids=source_ids,
        population_context=identity.population_context,
    )


def _optional_date(value: object) -> date | None:
    if value is None:
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value)
    raise ValueError("identity auxiliary birth_date must be an ISO date")


def _optional_int(value: object) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool):
        raise ValueError("identity auxiliary integer cannot be boolean")
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    raise ValueError("identity auxiliary birth_year must be an integer")


def _optional_string(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, str) and value.strip():
        return value.strip()
    raise ValueError("identity auxiliary string value is invalid")


def _string_tuple(value: object) -> tuple[str, ...]:
    if value is None:
        return ()
    if not isinstance(value, (list, tuple)):
        raise ValueError("identity auxiliary collection must be a list")
    values = tuple(sorted({str(item).strip() for item in value if str(item).strip()}))
    return values
