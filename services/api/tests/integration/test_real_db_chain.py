import json
import os
from collections.abc import Iterator
from uuid import uuid4

import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg.rows import dict_row

from app.core.config import settings
from app.db.session import configure_database
from app.main import app


def _normalize_dsn(database_url: str) -> str:
    if database_url.startswith("postgresql+psycopg://"):
        return database_url.replace("postgresql+psycopg://", "postgresql://", 1)
    return database_url


def _query_scalar(
    database_url: str, sql: str, params: tuple[object, ...] | None = None
) -> int:
    with psycopg.connect(_normalize_dsn(database_url)) as conn:
        with conn.cursor() as cursor:
            cursor.execute(sql, params or ())
            value = cursor.fetchone()
            if not value:
                raise RuntimeError("No query result returned")
            return int(value[0])


def _query_one(
    database_url: str, sql: str, params: tuple[object, ...] | None = None
) -> dict[str, object]:
    with psycopg.connect(_normalize_dsn(database_url), row_factory=dict_row) as conn:
        with conn.cursor() as cursor:
            cursor.execute(sql, params or ())
            row = cursor.fetchone()
            if row is None:
                raise RuntimeError("No query result returned")
            return dict(row)


@pytest.fixture(scope="module")
def real_db_url() -> Iterator[str]:
    if os.getenv("RUN_REAL_DB_TESTS") != "1":
        pytest.skip("Set RUN_REAL_DB_TESTS=1 to run real DB integration tests")

    database_url = os.getenv("REAL_DB_URL") or os.getenv("DATABASE_URL")
    if not database_url:
        pytest.skip("Set DATABASE_URL or REAL_DB_URL for real DB tests")

    prev_database_url = settings.database_url
    prev_db_use_mock_fallback = settings.db_use_mock_fallback
    prev_workflow_actor_tokens_json = settings.workflow_actor_tokens_json

    settings.database_url = database_url
    settings.db_use_mock_fallback = False
    settings.workflow_actor_tokens_json = json.dumps(
        {
            "11111111-1111-4111-8111-111111111111": "editor-secret",
            "22222222-2222-4222-8222-222222222222": "reviewer-secret",
            "33333333-3333-4333-8333-333333333333": "publisher-secret",
        }
    )
    configure_database(database_url)

    try:
        yield database_url
    finally:
        settings.database_url = prev_database_url
        settings.db_use_mock_fallback = prev_db_use_mock_fallback
        settings.workflow_actor_tokens_json = prev_workflow_actor_tokens_json
        configure_database(prev_database_url)


@pytest.fixture(scope="module")
def client(real_db_url: str) -> Iterator[TestClient]:
    _ = real_db_url
    with TestClient(app) as test_client:
        yield test_client


def _get_first_panda(client: TestClient) -> dict[str, object]:
    response = client.get("/api/v1/pandas")
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) >= 1
    return items[0]


def test_real_db_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["db"] == "ok"


def test_real_db_pandas_endpoint(client: TestClient, real_db_url: str) -> None:
    response = client.get("/api/v1/pandas")
    assert response.status_code == 200

    payload = response.json()
    endpoint_total = payload["meta"]["total"]
    visible_db_total = _query_scalar(
        real_db_url,
        """
        with active_release as (
          select
            batch.operation,
            case
              when batch.operation = 'withdrawal' then batch.withdrawal_target_id
              else batch.id
            end as source_batch_id
          from public.public_release_pointer pointer
          join public.publication_batches batch on batch.id = pointer.active_batch_id
          where pointer.singleton = true
        ),
        withdrawn_entities as (
          select distinct revision.entity_id
          from active_release
          join public.publication_batch_change_sets batch_link
            on batch_link.batch_id = active_release.source_batch_id
          join public.change_set_revisions change_link
            on change_link.change_set_id = batch_link.change_set_id
          join public.entity_revisions revision on revision.id = change_link.revision_id
          where active_release.operation = 'withdrawal'
            and revision.entity_type = 'panda'
        )
        select count(*)
        from public.pandas panda
        where not exists (
          select 1
          from withdrawn_entities withdrawn
          where withdrawn.entity_id = panda.id::text
        )
        """,
    )
    assert endpoint_total == visible_db_total


def test_real_db_detail_endpoint(client: TestClient, real_db_url: str) -> None:
    first_panda = _get_first_panda(client)
    response = client.get(f"/api/v1/pandas/{first_panda['slug']}")
    assert response.status_code == 200

    payload = response.json()
    db_row = _query_one(
        real_db_url,
        """
        select
          p.slug,
          p.birthplace,
          (
            select pa.parent_id::text
            from public.parentage_assertions pa
            where pa.child_id = p.id
              and pa.parent_role = 'father'
              and pa.status = 'confirmed'
              and pa.publication_status = 'published'
              and exists (
                select 1 from public.parentage_assertion_sources pas
                join public.public_evidence_sources source on source.id = pas.source_id
                where pas.assertion_id = pa.id
              )
            order by pa.parent_id
            limit 1
          ) as father_id,
          (
            select pa.parent_id::text
            from public.parentage_assertions pa
            where pa.child_id = p.id
              and pa.parent_role = 'mother'
              and pa.status = 'confirmed'
              and pa.publication_status = 'published'
              and exists (
                select 1 from public.parentage_assertion_sources pas
                join public.public_evidence_sources source on source.id = pas.source_id
                where pas.assertion_id = pa.id
              )
            order by pa.parent_id
            limit 1
          ) as mother_id
        from public.pandas p
        where p.id = %s
        """,
        (first_panda["id"],),
    )
    assert payload["slug"] == db_row["slug"]
    assert payload["birthplace"] == db_row["birthplace"]
    assert payload["father_id"] == db_row["father_id"]
    assert payload["mother_id"] == db_row["mother_id"]


def test_real_db_reviewed_lineage_residency_and_events(
    client: TestClient, real_db_url: str
) -> None:
    tai_shan_id = "96d00a39-7865-55db-b5c2-f339ef692258"
    if _query_scalar(
        real_db_url,
        "select count(*) from public.pandas where id = %s::uuid",
        (tai_shan_id,),
    ) == 0:
        pytest.skip("Issue #8 golden seed is not loaded")

    lineage = client.get(
        "/api/v1/pandas/tai-shan/lineage",
        params={"ancestor_depth": 0, "descendant_depth": 0},
    )
    assert lineage.status_code == 200
    lineage_payload = lineage.json()
    node_ids = {node["id"] for node in lineage_payload["nodes"]}
    assert "2939c16f-1938-5629-928c-b36b1d5cd6ed" in node_ids
    assert any(
        relationship["subject_id"] == tai_shan_id
        and relationship["related_id"] == "7cf4e916-4801-5b2e-b49b-4e33bb50d5d6"
        and relationship["kind"] == "sibling"
        for relationship in lineage_payload["relationships"]
    )

    detail = client.get("/api/v1/pandas/mei-xiang")
    assert detail.status_code == 200
    detail_payload = detail.json()
    assert detail_payload["current_place"] == {
        "facility_id": None,
        "coarse_location": "China",
        "status": "confirmed_country_level",
    }
    assert len(detail_payload["events"]) == 2
    assert len(
        next(
            event
            for event in detail_payload["events"]
            if event["id"] == "event-smithsonian-departure-2023"
        )["participants"]
    ) == 3


def test_real_db_lineage_endpoint(client: TestClient) -> None:
    first_panda = _get_first_panda(client)
    response = client.get(
        f"/api/v1/pandas/{first_panda['slug']}/lineage",
        params={"ancestor_depth": 2, "descendant_depth": 2},
    )
    assert response.status_code == 200

    payload = response.json()
    assert payload["focus_id"] == first_panda["id"]
    assert len(payload["nodes"]) >= 1
    assert any(node["id"] == first_panda["id"] for node in payload["nodes"])
    assert payload["meta"]["ancestor_depth"] == 2
    assert payload["meta"]["descendant_depth"] == 2


def test_real_db_habitats_endpoint(client: TestClient, real_db_url: str) -> None:
    response = client.get(
        "/api/v1/map/habitats",
        params={"bbox": "102.5,29.7,104.2,31.8", "level": "national"},
    )
    assert response.status_code == 200

    payload = response.json()
    endpoint_count = len(payload["features"])
    db_count = _query_scalar(
        real_db_url,
        """
        select count(*)
        from public.habitats h
        where h.level = 'national'
          and st_intersects(
                h.boundary,
                st_makeenvelope(102.5, 29.7, 104.2, 31.8, 4326)
              )
        """,
    )
    assert endpoint_count == db_count


def test_real_db_distribution_endpoint(client: TestClient, real_db_url: str) -> None:
    response = client.get(
        "/api/v1/map/distribution",
        params={"bbox": "100,25,110,36", "layer": "wild", "zoom": 6},
    )
    assert response.status_code == 200

    payload = response.json()
    endpoint_count = len(payload["features"])
    db_count = _query_scalar(
        real_db_url,
        """
        select count(*)
        from public.distribution_cells dc
        join public.distribution_snapshots ds on ds.id = dc.snapshot_id
        where st_intersects(
                dc.geom,
                st_makeenvelope(100, 25, 110, 36, 4326)
              )
          and dc.layer::text = 'wild'
          and ds.snapshot_date = (select max(snapshot_date) from public.distribution_snapshots)
        """,
    )
    assert endpoint_count == db_count


def test_real_db_snapshots_endpoint(client: TestClient, real_db_url: str) -> None:
    response = client.get("/api/v1/map/snapshots")
    assert response.status_code == 200

    payload = response.json()
    assert len(payload["items"]) >= 1
    latest_snapshot = _query_one(
        real_db_url,
        """
        select snapshot_date::text as snapshot_date, version
        from public.distribution_snapshots
        order by snapshot_date desc, created_at desc
        limit 1
        """,
    )
    assert payload["items"][0]["snapshot_date"] == latest_snapshot["snapshot_date"]
    assert payload["items"][0]["version"] == latest_snapshot["version"]


def test_real_db_stats_endpoint(client: TestClient, real_db_url: str) -> None:
    response = client.get("/api/v1/stats/overview")
    assert response.status_code == 200

    payload = response.json()
    assert payload["total_pandas"] == _query_scalar(
        real_db_url, "select count(*) from public.pandas"
    )
    assert payload["active_habitats"] == _query_scalar(
        real_db_url, "select count(*) from public.habitats"
    )
    assert payload["featured_pandas"] == _query_scalar(
        real_db_url, "select count(*) from public.pandas where is_featured = true"
    )
    latest_snapshot = _query_one(
        real_db_url,
        "select max(snapshot_date)::text as snapshot_date from public.distribution_snapshots",
    )
    assert payload["latest_snapshot_date"] == latest_snapshot["snapshot_date"]


def test_real_db_four_eyes_publication_is_atomic_and_audited(
    client: TestClient,
    real_db_url: str,
) -> None:
    if _query_scalar(
        real_db_url,
        """
        select count(*)
        from pg_tables
        where schemaname = 'public' and tablename = 'publication_batches'
        """,
    ) == 0:
        pytest.fail("Issue #9 publication workflow migration is not loaded")

    actors = {
        "11111111-1111-4111-8111-111111111111": "editor-secret",
        "22222222-2222-4222-8222-222222222222": "reviewer-secret",
        "33333333-3333-4333-8333-333333333333": "publisher-secret",
    }
    editor_id, reviewer_id, publisher_id = actors
    suffix = uuid4().hex
    panda = _get_first_panda(client)

    def headers(actor_id: str) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {actors[actor_id]}",
            "X-Actor-Id": actor_id,
        }

    def revision_payload(birthplace: str) -> dict[str, object]:
        return {
            "public_record": {"birthplace": birthplace},
            "publication_checks": {
                "references": [],
                "residencies": [],
                "translations": [],
                "sources": [],
                "media": [],
            },
        }

    def create_change_set(label: str) -> str:
        response = client.post(
            "/api/v1/admin/change-sets",
            headers=headers(editor_id),
            json={
                "title": f"Integration publication {label} {suffix}",
                "reason": "Exercise the authoritative four-eyes workflow",
                "revisions": [
                    {
                        "entity_type": "panda",
                        "entity_id": panda["id"],
                        "payload": revision_payload(label),
                    }
                ],
            },
        )
        assert response.status_code == 201
        assert response.json()["status"] == "draft"
        return response.json()["id"]

    def submit(change_set_id: str) -> None:
        response = client.post(
            f"/api/v1/admin/change-sets/{change_set_id}/submit",
            headers=headers(editor_id),
        )
        assert response.status_code == 200

    def approve(change_set_id: str) -> None:
        response = client.post(
            f"/api/v1/admin/change-sets/{change_set_id}/reviews",
            headers=headers(reviewer_id),
            json={"decision": "approved", "reason": "Independent review complete"},
        )
        assert response.status_code == 200

    def publish(change_set_id: str, version: str) -> dict[str, object]:
        batch = client.post(
            "/api/v1/admin/publication-batches",
            headers=headers(publisher_id),
            json={
                "change_set_ids": [change_set_id],
                "public_schema_version": "1.0.0",
                "data_version": version,
                "reason": "Publish integration release",
                "correlation_id": str(uuid4()),
            },
        )
        assert batch.status_code == 201
        response = client.post(
            f"/api/v1/admin/publication-batches/{batch.json()['id']}/publish",
            headers=headers(publisher_id),
        )
        assert response.status_code == 200
        return response.json()

    rejected_id = create_change_set("Rejected")
    submit(rejected_id)
    rejected = client.post(
        f"/api/v1/admin/change-sets/{rejected_id}/reviews",
        headers=headers(reviewer_id),
        json={"decision": "rejected", "reason": "Evidence remains ambiguous"},
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"

    first_id = create_change_set("First visible birthplace")
    submit(first_id)
    denied = client.post(
        f"/api/v1/admin/change-sets/{first_id}/reviews",
        headers=headers(editor_id),
        json={"decision": "approved", "reason": "Self approval must fail"},
    )
    assert denied.status_code == 409
    approve(first_id)
    first_batch = publish(first_id, f"integration-{suffix}-1")
    first_detail = client.get(f"/api/v1/pandas/{panda['slug']}")
    assert first_detail.status_code == 200
    assert first_detail.json()["birthplace"] == "First visible birthplace"

    second_id = create_change_set("Second visible birthplace")
    submit(second_id)
    approve(second_id)
    publish(second_id, f"integration-{suffix}-2")
    second_detail = client.get(f"/api/v1/pandas/{panda['slug']}")
    assert second_detail.status_code == 200
    assert second_detail.json()["birthplace"] == "Second visible birthplace"

    rollback = client.post(
        f"/api/v1/admin/publication-batches/{first_batch['id']}/rollback",
        headers=headers(publisher_id),
        json={
            "reason": "Restore the prior public snapshot",
            "correlation_id": str(uuid4()),
            "data_version": f"integration-{suffix}-3",
        },
    )
    assert rollback.status_code == 201
    rolled_back_detail = client.get(f"/api/v1/pandas/{panda['slug']}")
    assert rolled_back_detail.status_code == 200
    assert rolled_back_detail.json()["birthplace"] == "First visible birthplace"

    withdrawal = client.post(
        f"/api/v1/admin/publication-batches/{rollback.json()['id']}/withdraw",
        headers=headers(publisher_id),
        json={
            "reason": "Emergency copyright withdrawal",
            "correlation_id": str(uuid4()),
            "data_version": f"integration-{suffix}-4",
        },
    )
    assert withdrawal.status_code == 201
    assert client.get(f"/api/v1/pandas/{panda['slug']}").status_code == 404

    active = _query_one(
        real_db_url,
        """
        select active_batch_id::text as active_batch_id
        from public.public_release_pointer
        where singleton
        """,
    )
    assert active["active_batch_id"] == withdrawal.json()["id"]
    assert _query_scalar(
        real_db_url,
        "select count(*) from public.audit_events where event_type like 'publication_batch.%%'",
    ) >= 6
