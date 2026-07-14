from __future__ import annotations

import json
import unicodedata
from dataclasses import dataclass, replace
from datetime import date
from typing import Literal
from uuid import UUID

PublicationStatus = Literal["published", "draft", "restricted"]
AssertionCertainty = Literal["confirmed", "provisional"]
ConclusionStatus = Literal["confirmed", "provisional", "disputed", "superseded"]


def normalize_identity_term(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.strip().casefold())
    return "".join(
        character
        for character in decomposed
        if not unicodedata.combining(character) and character.isalnum()
    )


@dataclass(frozen=True)
class IdentityName:
    value: str
    language: str
    kind: str
    source_ids: tuple[str, ...]


@dataclass(frozen=True)
class ExternalIdentifier:
    system: str
    value: str
    source_ids: tuple[str, ...]


@dataclass(frozen=True)
class TrustedIdentity:
    id: UUID
    canonical_slug: str
    names: tuple[IdentityName, ...]
    aliases: tuple[IdentityName, ...] = ()
    legacy_slugs: tuple[str, ...] = ()
    external_identifiers: tuple[ExternalIdentifier, ...] = ()

    def searchable_terms(self) -> tuple[str, ...]:
        return (
            self.canonical_slug,
            *self.legacy_slugs,
            *(name.value for name in self.names),
            *(alias.value for alias in self.aliases),
            *(identifier.value for identifier in self.external_identifiers),
        )

    def matches(self, query: str) -> bool:
        normalized_query = normalize_identity_term(query)
        if not normalized_query:
            return False
        return any(
            normalize_identity_term(term) == normalized_query
            for term in self.searchable_terms()
        )

    def with_canonical_identity(
        self,
        *,
        canonical_slug: str,
        names: tuple[IdentityName, ...],
    ) -> TrustedIdentity:
        legacy_slugs = self.legacy_slugs
        if canonical_slug != self.canonical_slug and self.canonical_slug not in legacy_slugs:
            legacy_slugs = (*legacy_slugs, self.canonical_slug)
        return replace(
            self,
            canonical_slug=canonical_slug,
            names=names,
            legacy_slugs=legacy_slugs,
        )


@dataclass(frozen=True)
class EvidenceAssertion:
    id: str
    field: str
    value: object
    source_ids: tuple[str, ...]
    certainty: AssertionCertainty
    publication_status: PublicationStatus
    last_verified_at: date
    superseded_by: str | None = None


@dataclass(frozen=True)
class PublicConclusion:
    field: str
    value: object | None
    status: ConclusionStatus
    last_verified_at: date
    assertion_ids: tuple[str, ...]
    source_ids: tuple[str, ...]
    candidate_values: tuple[object, ...] = ()
    superseded_values: tuple[object, ...] = ()


def _value_key(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _unique_values(assertions: list[EvidenceAssertion]) -> tuple[object, ...]:
    values: dict[str, object] = {}
    for assertion in assertions:
        values.setdefault(_value_key(assertion.value), assertion.value)
    return tuple(values[key] for key in sorted(values))


def derive_public_conclusions(
    assertions: tuple[EvidenceAssertion, ...] | list[EvidenceAssertion],
) -> tuple[PublicConclusion, ...]:
    published = [
        assertion
        for assertion in assertions
        if assertion.publication_status == "published"
    ]
    by_field: dict[str, list[EvidenceAssertion]] = {}
    for assertion in published:
        by_field.setdefault(assertion.field, []).append(assertion)

    conclusions: list[PublicConclusion] = []
    for field in sorted(by_field):
        field_assertions = sorted(
            by_field[field],
            key=lambda assertion: (assertion.last_verified_at, assertion.id),
        )
        active = [assertion for assertion in field_assertions if assertion.superseded_by is None]
        superseded = [
            assertion
            for assertion in field_assertions
            if assertion.superseded_by is not None
        ]
        active_values = _unique_values(active)
        superseded_values = _unique_values(superseded)

        if not active:
            status: ConclusionStatus = "superseded"
            value = field_assertions[-1].value
            candidate_values: tuple[object, ...] = ()
        elif len(active_values) > 1:
            status = "disputed"
            value = None
            candidate_values = active_values
        else:
            value = active_values[0]
            candidate_values = ()
            status = (
                "provisional"
                if any(assertion.certainty == "provisional" for assertion in active)
                else "confirmed"
            )

        conclusions.append(
            PublicConclusion(
                field=field,
                value=value,
                status=status,
                last_verified_at=max(
                    assertion.last_verified_at for assertion in field_assertions
                ),
                assertion_ids=tuple(assertion.id for assertion in field_assertions),
                source_ids=tuple(
                    sorted(
                        {
                            source_id
                            for assertion in field_assertions
                            for source_id in assertion.source_ids
                        }
                    )
                ),
                candidate_values=candidate_values,
                superseded_values=superseded_values,
            )
        )

    return tuple(conclusions)
