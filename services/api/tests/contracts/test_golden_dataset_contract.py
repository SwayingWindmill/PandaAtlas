from __future__ import annotations

import json

from tests.support.golden_dataset import (
    GOLDEN_DATASET_CONSUMERS,
    build_public_projection,
    load_golden_dataset,
)


def test_all_consumers_load_the_same_golden_dataset() -> None:
    fixtures = [load_golden_dataset(consumer) for consumer in GOLDEN_DATASET_CONSUMERS]
    expected_ids = [record["id"] for record in fixtures[0]["pandas"]]

    assert fixtures[0]["dataset"]["version"] == "2026.07.14.2"
    for fixture in fixtures:
        assert [record["id"] for record in fixture["pandas"]] == expected_ids


def test_public_projection_excludes_restricted_fields() -> None:
    projection = build_public_projection(load_golden_dataset("api"))
    serialized = json.dumps(projection, ensure_ascii=False)

    assert len(projection["pandas"]) == 7
    assert "restricted" not in serialized
    assert "curator_notes" not in serialized
    assert "待審核翻譯草稿" not in serialized
