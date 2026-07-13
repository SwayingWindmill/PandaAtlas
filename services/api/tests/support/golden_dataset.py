from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any, Literal

GoldenDatasetConsumer = Literal["domain", "api", "projection", "snapshot", "browser"]
GOLDEN_DATASET_CONSUMERS: tuple[GoldenDatasetConsumer, ...] = (
    "domain",
    "api",
    "projection",
    "snapshot",
    "browser",
)

REPO_ROOT = Path(__file__).resolve().parents[4]
GOLDEN_DATASET_PATH = (
    REPO_ROOT / "contracts" / "golden-dataset" / "mei-xiang-family.v1.json"
)
RECORD_COLLECTIONS = (
    "sources",
    "facilities",
    "related_pandas",
    "pandas",
    "facts",
    "parentage_assertions",
    "residencies",
    "events",
    "media",
)


def load_golden_dataset(
    consumer: GoldenDatasetConsumer = "api",
) -> dict[str, Any]:
    if consumer not in GOLDEN_DATASET_CONSUMERS:
        raise ValueError(f"Unsupported golden dataset consumer: {consumer}")
    return json.loads(GOLDEN_DATASET_PATH.read_text(encoding="utf-8"))


def build_public_projection(dataset: dict[str, Any]) -> dict[str, Any]:
    metadata = dataset["dataset"]
    projection: dict[str, Any] = {
        "dataset": {
            "id": metadata["id"],
            "version": metadata["version"],
            "public_schema_version": metadata["public_schema_version"],
            "licenses": deepcopy(metadata["licenses"]),
        }
    }

    for collection in RECORD_COLLECTIONS:
        projection[collection] = [
            {"id": record["id"], **deepcopy(record["public"])}
            for record in dataset[collection]
            if record["publication_status"] == "published"
        ]

    return projection
