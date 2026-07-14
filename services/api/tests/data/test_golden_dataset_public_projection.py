from __future__ import annotations

from app.data.golden_dataset import _conclusions, _identity_payload


def test_public_projection_filters_unpublished_source_ids_from_every_surface() -> None:
    published_source_ids = {"source-public"}
    record = {
        "id": "panda-1",
        "public": {
            "canonical_slug": "panda-1",
            "names": [
                {
                    "value": "Panda One",
                    "language": "en",
                    "kind": "official",
                    "source_ids": ["source-public", "source-restricted"],
                }
            ],
            "aliases": [
                {
                    "value": "P1",
                    "language": "en",
                    "kind": "short_name",
                    "source_ids": ["source-public", "source-restricted"],
                }
            ],
            "legacy_slugs": [
                {
                    "value": "panda_one",
                    "source_ids": ["source-public", "source-restricted"],
                }
            ],
            "external_identifiers": [
                {
                    "system": "archive",
                    "value": "P-1",
                    "source_ids": ["source-public", "source-restricted"],
                }
            ],
        },
    }
    dataset = {
        "facts": [
            {
                "id": "fact-1",
                "publication_status": "published",
                "public": {
                    "subject_id": "panda-1",
                    "field": "birth_date",
                    "value": "2000-01-01",
                    "conclusion_status": "confirmed",
                    "last_verified_at": "2026-07-14",
                    "source_ids": ["source-public", "source-restricted"],
                },
            }
        ]
    }

    identity = _identity_payload(record, published_source_ids)
    conclusions = _conclusions(dataset, "panda-1", published_source_ids)

    assert identity["names"][0]["source_ids"] == ["source-public"]
    assert identity["aliases"][0]["source_ids"] == ["source-public"]
    assert identity["legacy_slugs"][0]["source_ids"] == ["source-public"]
    assert identity["external_identifiers"][0]["source_ids"] == ["source-public"]
    assert conclusions[0]["source_ids"] == ["source-public"]
