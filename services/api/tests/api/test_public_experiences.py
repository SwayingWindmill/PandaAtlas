from contextlib import contextmanager

from fastapi.testclient import TestClient

from app.main import app
from app.services import release_service

client = TestClient(app)


def _assert_release_headers(response) -> None:
    release = client.get("/api/v1/releases/current").json()
    assert response.headers["X-PandaAtlas-Dataset-Version"] == release[
        "dataset_release_version"
    ]
    assert response.headers["X-PandaAtlas-Public-Schema-Version"] == release[
        "public_schema_version"
    ]
    assert response.headers["X-PandaAtlas-Database-Migration-Version"] == release[
        "database_migration_version"
    ]


def test_profile_v2_exposes_first_cohort_without_inventing_historic_facts() -> None:
    rich_response = client.get("/api/v1/pandas/xi-lun/profile")
    assert rich_response.status_code == 200
    _assert_release_headers(rich_response)
    rich = rich_response.json()
    assert rich["cohort_state"] == "rich"
    assert rich["coverage_state"] == "complete"
    assert rich["moments_href"] == "/moments?panda=xi-lun"
    assert {item["id"] for item in rich["modules"]} == {
        "overview",
        "story",
        "timeline",
        "family",
        "footprint",
        "media",
        "sources",
        "revisions",
    }

    historic_response = client.get("/api/v1/pandas/yong-ba/profile")
    assert historic_response.status_code == 200
    historic = historic_response.json()
    assert historic["cohort_state"] == "historic"
    assert historic["coverage_state"] == "partial"
    assert historic["panda"]["name_zh"] == "Yong Ba"
    assert historic["panda"]["name_en"] == "Yong Ba"
    assert historic["panda"]["status"] == "deceased"
    assert historic["panda"]["birth_date"] is None
    assert historic["panda"]["father_id"] is None
    assert historic["panda"]["mother_id"] is None


def test_moments_deduplicate_shared_events_and_keep_distinct_event_ids() -> None:
    response = client.get("/api/v1/moments", params={"page_size": 100})
    assert response.status_code == 200
    _assert_release_headers(response)
    payload = response.json()
    assert payload["coverage_state"] == "complete"
    assert payload["source_event_total"] == 43
    assert payload["derived_occurrence_total"] == 0
    assert payload["meta"]["total"] == 43
    assert len({item["id"] for item in payload["items"]}) == 43

    by_id = {item["id"]: item for item in payload["items"]}
    assert len(by_id["event-zoo-atlanta-return-2024"]["participants"]) == 4
    assert len(by_id["event-zoo-atlanta-pair-arrival-1999"]["participants"]) == 2
    assert by_id["event-xi-lun-birth"]["id"] != by_id["event-ya-lun-birth"]["id"]
    assert len(by_id["event-xi-lun-birth"]["participants"]) == 1
    assert len(by_id["event-ya-lun-birth"]["participants"]) == 1


def test_moments_anniversaries_are_derived_and_do_not_inflate_source_totals() -> None:
    response = client.get(
        "/api/v1/moments",
        params={
            "page_size": 100,
            "year": 2026,
            "include_anniversaries": True,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["source_event_total"] == 1
    assert payload["derived_occurrence_total"] == 24
    anniversaries = [
        item
        for item in payload["items"]
        if item["occurrence_kind"] == "derived_anniversary"
    ]
    assert len(anniversaries) == 24
    assert all(item["id"].startswith("anniversary:") for item in anniversaries)
    assert all(item["event_type"] == "birth_anniversary" for item in anniversaries)
    assert all(item["source_event_id"] for item in anniversaries)
    assert all(item["anniversary_year"] == 2026 for item in anniversaries)


def test_family_story_reads_preserve_scope_relationship_status_and_sources() -> None:
    list_response = client.get("/api/v1/family-stories")
    assert list_response.status_code == 200
    _assert_release_headers(list_response)
    listing = list_response.json()
    assert listing["meta"]["total"] == 2
    assert {item["slug"] for item in listing["items"]} == {
        "smithsonian-generations",
        "ueno-twins",
    }

    ueno_response = client.get("/api/v1/family-stories/ueno-twins")
    assert ueno_response.status_code == 200
    ueno = ueno_response.json()
    assert ueno["scope"]["coverage_state"] == "complete_for_declared_scope"
    assert len(ueno["members"]) == 4
    assert len(ueno["relationships"]) == 4
    assert len(ueno["events"]) == 5
    assert len(ueno["sources"]) == 4
    assert {item["status"] for item in ueno["relationships"]} == {"confirmed"}

    smithsonian_response = client.get(
        "/api/v1/family-stories/smithsonian-generations"
    )
    assert smithsonian_response.status_code == 200
    smithsonian = smithsonian_response.json()
    assert smithsonian["scope"]["coverage_state"] == "partial"
    assert "parent-bao-li-father" in smithsonian[
        "relationship_assertion_ids"
    ]
    assert any(
        item["id"] == "parent-bao-li-father" and item["status"] == "tentative"
        for item in smithsonian["relationships"]
    )
    assert smithsonian["scope"]["excluded_relationship_assertion_ids"]


def test_generated_openapi_includes_public_experience_routes() -> None:
    schema = client.get("/openapi.json").json()
    for path in (
        "/api/v1/pandas/{panda_ref}/profile",
        "/api/v1/moments",
        "/api/v1/family-stories",
        "/api/v1/family-stories/{story_ref}",
    ):
        responses = schema["paths"][path]["get"]["responses"]
        assert {"200", "410", "503"} <= set(responses)
        assert "X-PandaAtlas-Dataset-Version" in responses["200"]["headers"]


class _WithdrawalResult:
    def __init__(self, rows: list[dict[str, str | None]]):
        self.rows = rows

    def mappings(self):
        return self

    def all(self):
        return self.rows


class _WithdrawalSession:
    def __init__(self, rows: list[dict[str, str | None]]):
        self.rows = rows

    def execute(self, *_args, **_kwargs):
        return _WithdrawalResult(self.rows)


def test_withdrawing_a_story_member_hides_the_dependent_story(monkeypatch) -> None:
    payload = release_service.get_current_api_release()
    mei_xiang_id = next(
        item["id"] for item in payload["pandas"] if item["slug"] == "mei-xiang"
    )

    @contextmanager
    def entity_session():
        yield _WithdrawalSession(
            [{"entity_type": "api_pandas", "entity_id": mei_xiang_id}]
        )

    monkeypatch.setattr(release_service, "session_scope", entity_session)
    filtered = release_service._apply_database_withdrawals(
        payload, payload["release"]["dataset_release_version"]
    )
    assert mei_xiang_id not in {item["id"] for item in filtered["pandas"]}
    assert {item["slug"] for item in filtered["family_stories"]} == {"ueno-twins"}
    assert "mei-xiang" not in {item["slug"] for item in filtered["profile_cohort"]}
