from __future__ import annotations

import json

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
MEI_XIANG_ID = "2939c16f-1938-5629-928c-b36b1d5cd6ed"
TAI_SHAN_ID = "96d00a39-7865-55db-b5c2-f339ef692258"
BAO_BAO_ID = "7cf4e916-4801-5b2e-b49b-4e33bb50d5d6"
BAO_LI_ID = "434e10e3-7ba0-5de7-a59e-d3984524c58c"


def test_identity_search_uses_names_aliases_legacy_slugs_and_external_ids() -> None:
    for query in (
        "美香",
        "Měixiāng",
        "Mei-Xiang",
        "meixiang",
        "smithsonian_history_key:mei-xiang",
    ):
        response = client.get("/api/v1/pandas", params={"q": query, "page_size": 100})
        assert response.status_code == 200
        matches = {item["id"] for item in response.json()["items"]}
        assert MEI_XIANG_ID in matches, query

    punctuation_response = client.get(
        "/api/v1/pandas", params={"q": "---", "page_size": 100}
    )
    assert punctuation_response.status_code == 200
    assert punctuation_response.json()["items"] == []


def test_legacy_slug_resolves_to_canonical_identity_with_public_provenance() -> None:
    response = client.get("/api/v1/pandas/meixiang")

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == MEI_XIANG_ID
    assert payload["slug"] == "mei-xiang"
    assert payload["identity"]["stable_id"] == MEI_XIANG_ID
    assert payload["identity"]["canonical_slug"] == "mei-xiang"
    assert payload["record_tier"] == "complete_first_pass"
    assert {item["locale"] for item in payload["localized_content"]} == {
        "zh-CN",
        "en",
    }
    assert payload["media_release"] == {
        "license_state": "no_licensed_media",
        "display_mode": "designed_empty_state",
        "source_ids": [],
    }
    assert payload["public_revision"]["data_version"] == "2026.07.14.1"
    assert payload["public_revision"]["public_schema_version"] == "1.0.0"
    assert {item["locale"] for item in payload["public_revision"]["summaries"]} == {
        "zh-CN",
        "en",
    }
    assert {name["language"] for name in payload["identity"]["names"]} >= {
        "zh-Hans",
        "en",
        "pinyin",
    }
    assert {slug["value"] for slug in payload["identity"]["legacy_slugs"]} >= {
        "meixiang",
        "mei_xiang",
    }
    assert all(name["source_ids"] for name in payload["identity"]["names"])
    assert all(alias["source_ids"] for alias in payload["identity"]["aliases"])
    assert all(slug["source_ids"] for slug in payload["identity"]["legacy_slugs"])
    assert all(
        identifier["source_ids"]
        for identifier in payload["identity"]["external_identifiers"]
    )

    list_response = client.get("/api/v1/pandas", params={"q": "美香"})
    list_item = next(
        item for item in list_response.json()["items"] if item["id"] == MEI_XIANG_ID
    )
    assert {"美香", "Měixiāng", "Mei-Xiang", "meixiang"} <= set(
        list_item["search_terms"]
    )
    assert "smithsonian_history_key:mei-xiang" in list_item["search_terms"]

    conclusions = {item["field"]: item for item in payload["conclusions"]}
    assert conclusions["birth_date"]["status"] == "confirmed"
    assert conclusions["birth_date"]["last_verified_at"] == "2026-05-09"
    assert conclusions["current_coarse_location"]["status"] == "confirmed"
    assert conclusions["current_coarse_location"]["value"] == "China"
    assert conclusions["current_coarse_location"]["source_ids"]

    source_ids = {source["id"] for source in payload["sources"]}
    assert set(conclusions["birth_date"]["source_ids"]) <= source_ids
    assert set(conclusions["current_coarse_location"]["source_ids"]) <= source_ids

    serialized = json.dumps(payload, ensure_ascii=False)
    assert "curator_notes" not in serialized
    assert "content_hash" not in serialized
    assert "pending_content" not in serialized
    assert "review_owner" not in serialized


def test_public_lineage_is_derived_from_reviewed_parentage_assertions() -> None:
    response = client.get("/api/v1/pandas/mei-xiang/lineage")

    assert response.status_code == 200
    payload = response.json()
    assert {
        "parent_id": MEI_XIANG_ID,
        "child_id": TAI_SHAN_ID,
    } in payload["edges"]
    assert {
        "subject_id": TAI_SHAN_ID,
        "related_id": BAO_BAO_ID,
        "kind": "sibling",
        "path": [TAI_SHAN_ID, MEI_XIANG_ID, BAO_BAO_ID],
    } in payload["relationships"]

    child_response = client.get(
        "/api/v1/pandas/tai-shan/lineage",
        params={"ancestor_depth": 0},
    )
    assert child_response.status_code == 200
    assert {
        "subject_id": TAI_SHAN_ID,
        "related_id": BAO_BAO_ID,
        "kind": "sibling",
        "path": [TAI_SHAN_ID, MEI_XIANG_ID, BAO_BAO_ID],
    } in child_response.json()["relationships"]
    child_node_ids = {node["id"] for node in child_response.json()["nodes"]}
    assert MEI_XIANG_ID in child_node_ids
    assert {
        "subject_id": BAO_LI_ID,
        "related_id": MEI_XIANG_ID,
        "kind": "grandparent",
        "path": [BAO_LI_ID, BAO_BAO_ID, MEI_XIANG_ID],
    } in payload["relationships"]


def test_detail_projects_current_residency_and_shared_transfer_events() -> None:
    response = client.get("/api/v1/pandas/mei-xiang")

    assert response.status_code == 200
    payload = response.json()
    assert payload["current_place"] == {
        "facility_id": None,
        "coarse_location": "China",
        "status": "confirmed_country_level",
    }
    assert [item["id"] for item in payload["residencies"]] == [
        "res-mei-xiang-smithsonian",
        "res-mei-xiang-china",
    ]

    events = {event["id"]: event for event in payload["events"]}
    announced = events["event-smithsonian-return-plan-2020"]
    completed = events["event-smithsonian-departure-2023"]
    assert announced["event_status"] == "announced"
    assert announced["changes_current_residency"] is False
    assert completed["event_status"] == "completed"
    assert completed["changes_current_residency"] is True
    assert completed["participants"] == [
        MEI_XIANG_ID,
        "38cd1cad-3e34-5511-bc35-a091ece74e11",
        "926abc78-1e79-55c6-b24a-d33b4e5f6443",
    ]
