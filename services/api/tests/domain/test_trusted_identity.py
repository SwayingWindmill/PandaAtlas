from __future__ import annotations

from datetime import date
from uuid import UUID

from app.domain.trusted_identity import (
    EvidenceAssertion,
    ExternalIdentifier,
    IdentityName,
    TrustedIdentity,
    derive_public_conclusions,
)


def build_identity() -> TrustedIdentity:
    return TrustedIdentity(
        id=UUID("2939c16f-1938-5629-928c-b36b1d5cd6ed"),
        canonical_slug="mei-xiang",
        names=(
            IdentityName(
                value="美香",
                language="zh-Hans",
                kind="official",
                source_ids=("src_smithsonian_history",),
            ),
            IdentityName(
                value="Mei Xiang",
                language="en",
                kind="official_romanization",
                source_ids=("src_smithsonian_history",),
            ),
            IdentityName(
                value="Měixiāng",
                language="pinyin",
                kind="pinyin",
                source_ids=("src_smithsonian_history",),
            ),
        ),
        aliases=(
            IdentityName(
                value="Mei-Xiang",
                language="en",
                kind="historic_spelling",
                source_ids=("src_smithsonian_history",),
            ),
        ),
        legacy_slugs=("meixiang", "mei_xiang"),
        external_identifiers=(
            ExternalIdentifier(
                system="smithsonian_history_key",
                value="mei-xiang",
                source_ids=("src_smithsonian_history",),
            ),
        ),
    )


def test_identity_id_remains_stable_when_names_and_slug_change() -> None:
    identity = build_identity()

    renamed = identity.with_canonical_identity(
        canonical_slug="mei-xiang-archive",
        names=(
            IdentityName(
                value="美香",
                language="zh-Hans",
                kind="official",
                source_ids=("src_smithsonian_history",),
            ),
        ),
    )

    assert renamed.id == identity.id
    assert renamed.canonical_slug == "mei-xiang-archive"
    assert renamed.matches("mei-xiang")
    assert renamed.matches("美香")


def test_structured_identity_terms_are_searchable_and_source_linked() -> None:
    identity = build_identity()

    for query in ("美香", "mei xiang", "meixiang", "mei_xiang", "Měixiāng"):
        assert identity.matches(query), query

    assert all(name.source_ids for name in (*identity.names, *identity.aliases))
    assert all(identifier.source_ids for identifier in identity.external_identifiers)


def test_assertion_history_derives_statuses_without_leaking_restricted_evidence(
) -> None:
    assertions = (
        EvidenceAssertion(
            id="assert-birth-current",
            field="birth_date",
            value="1998-07-22",
            source_ids=("src_primary",),
            certainty="confirmed",
            publication_status="published",
            last_verified_at=date(2026, 5, 9),
        ),
        EvidenceAssertion(
            id="assert-location-provisional",
            field="current_place",
            value="China",
            source_ids=("src_primary",),
            certainty="provisional",
            publication_status="published",
            last_verified_at=date(2026, 5, 9),
        ),
        EvidenceAssertion(
            id="assert-parent-a",
            field="father_identity",
            value="candidate-a",
            source_ids=("src_secondary_a",),
            certainty="confirmed",
            publication_status="published",
            last_verified_at=date(2026, 5, 10),
        ),
        EvidenceAssertion(
            id="assert-parent-b",
            field="father_identity",
            value="candidate-b",
            source_ids=("src_secondary_b",),
            certainty="confirmed",
            publication_status="published",
            last_verified_at=date(2026, 5, 11),
        ),
        EvidenceAssertion(
            id="assert-name-old",
            field="display_name",
            value="Old Name",
            source_ids=("src_archive",),
            certainty="confirmed",
            publication_status="published",
            last_verified_at=date(2020, 1, 1),
            superseded_by="assert-name-current",
        ),
        EvidenceAssertion(
            id="assert-name-current",
            field="display_name",
            value="Current Name",
            source_ids=("src_primary",),
            certainty="confirmed",
            publication_status="published",
            last_verified_at=date(2026, 5, 9),
        ),
        EvidenceAssertion(
            id="assert-former-label",
            field="former_label",
            value="Archived Label",
            source_ids=("src_archive",),
            certainty="confirmed",
            publication_status="published",
            last_verified_at=date(2019, 1, 1),
            superseded_by="assert-label-outside-public-slice",
        ),
        EvidenceAssertion(
            id="assert-private-health-note",
            field="health_note",
            value="restricted text",
            source_ids=("src_private",),
            certainty="confirmed",
            publication_status="restricted",
            last_verified_at=date(2026, 5, 12),
        ),
    )

    conclusions = derive_public_conclusions(assertions)
    by_field = {conclusion.field: conclusion for conclusion in conclusions}

    assert by_field["birth_date"].status == "confirmed"
    assert by_field["current_place"].status == "provisional"
    assert by_field["father_identity"].status == "disputed"
    assert by_field["display_name"].status == "confirmed"
    assert by_field["display_name"].superseded_values == ("Old Name",)
    assert by_field["former_label"].status == "superseded"
    assert by_field["former_label"].value == "Archived Label"
    assert "health_note" not in by_field
    assert all("src_private" not in conclusion.source_ids for conclusion in conclusions)
