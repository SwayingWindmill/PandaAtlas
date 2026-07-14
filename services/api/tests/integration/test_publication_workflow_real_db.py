import os
from collections.abc import Iterator
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.db.session import configure_database
from app.schemas.publication import (
    ChangeSetCreate,
    ChangeSetReview,
    PublicationAction,
    PublicationBatchCreate,
)
from app.services.panda_service import get_panda_by_ref, list_pandas
from app.services.publication_service import (
    create_change_set,
    create_publication_batch,
    publish_batch,
    review_change_set,
    rollback_to_batch,
    submit_change_set,
    withdraw_batch,
)

EDITOR_ID = UUID("11111111-1111-4111-8111-111111111111")
REVIEWER_ID = UUID("22222222-2222-4222-8222-222222222222")
PUBLISHER_ID = UUID("33333333-3333-4333-8333-333333333333")


@pytest.fixture(scope="module")
def real_db() -> Iterator[None]:
    if os.getenv("RUN_REAL_DB_TESTS") != "1":
        pytest.skip("Set RUN_REAL_DB_TESTS=1 to run real DB integration tests")
    database_url = os.getenv("REAL_DB_URL") or os.getenv("DATABASE_URL")
    if not database_url:
        pytest.skip("Set DATABASE_URL or REAL_DB_URL for real DB tests")

    previous_url = settings.database_url
    previous_fallback = settings.db_use_mock_fallback
    settings.database_url = database_url
    settings.db_use_mock_fallback = False
    configure_database(database_url)
    try:
        yield
    finally:
        settings.database_url = previous_url
        settings.db_use_mock_fallback = previous_fallback
        configure_database(previous_url)


def _change_set_payload(
    panda_id: str,
    public_record: dict[str, object],
    suffix: str,
) -> ChangeSetCreate:
    return ChangeSetCreate.model_validate(
        {
            "title": f"Publish panda revision {suffix}",
            "reason": "Exercise the authoritative four-eyes workflow",
            "revisions": [
                {
                    "entity_type": "panda",
                    "entity_id": panda_id,
                    "payload": {
                        "public_record": public_record,
                        "publication_checks": {
                            "references": [],
                            "residencies": [],
                            "translations": [],
                            "sources": [],
                            "media": [],
                        },
                    },
                }
            ],
        }
    )


def _approve(panda_id: str, public_record: dict[str, object], suffix: str) -> UUID:
    change_set = create_change_set(
        _change_set_payload(panda_id, public_record, suffix),
        EDITOR_ID,
    )
    assert change_set.status == "draft"
    submit_change_set(change_set.id, EDITOR_ID)
    approved = review_change_set(
        change_set.id,
        ChangeSetReview(decision="approved", reason="Independent review complete"),
        REVIEWER_ID,
    )
    assert approved.status == "approved"
    return change_set.id


def _publish(change_set_id: UUID, version: str):
    batch = create_publication_batch(
        PublicationBatchCreate(
            change_set_ids=[change_set_id],
            public_schema_version="1.0.0",
            data_version=version,
            reason="Publish reviewed archive snapshot",
            correlation_id=uuid4(),
        ),
        PUBLISHER_ID,
    )
    return publish_batch(batch.id, PUBLISHER_ID)


def test_real_publication_lifecycle_changes_visible_public_record(real_db: None) -> None:
    _ = real_db
    suffix = uuid4().hex
    panda = list_pandas(
        page=1,
        page_size=1,
        q=None,
        status=None,
        gender=None,
        habitat_id=None,
        featured=None,
        sort="name_asc",
    ).items[0]

    rejected = create_change_set(
        _change_set_payload(
            str(panda.id),
            {"birthplace": "Rejected birthplace"},
            suffix,
        ),
        EDITOR_ID,
    )
    submit_change_set(rejected.id, EDITOR_ID)
    rejected_result = review_change_set(
        rejected.id,
        ChangeSetReview(decision="rejected", reason="Evidence is ambiguous"),
        REVIEWER_ID,
    )
    assert rejected_result.status == "rejected"

    first = create_change_set(
        _change_set_payload(
            str(panda.id),
            {"birthplace": "First visible birthplace"},
            suffix,
        ),
        EDITOR_ID,
    )
    submit_change_set(first.id, EDITOR_ID)
    with pytest.raises(HTTPException, match="independent reviewer"):
        review_change_set(
            first.id,
            ChangeSetReview(decision="approved", reason="Self approval"),
            EDITOR_ID,
        )
    review_change_set(
        first.id,
        ChangeSetReview(decision="approved", reason="Independent review complete"),
        REVIEWER_ID,
    )
    first_batch = _publish(first.id, f"integration-{suffix}-1")
    assert get_panda_by_ref(panda.slug).birthplace == "First visible birthplace"

    second_id = _approve(
        str(panda.id),
        {
            "intro": "Second release introduction",
            "name_zh": f"发布检索-{suffix}",
        },
        suffix,
    )
    _publish(second_id, f"integration-{suffix}-2")
    second_release = get_panda_by_ref(panda.slug)
    assert second_release.birthplace == "First visible birthplace"
    assert second_release.intro == "Second release introduction"
    projected_list = list_pandas(
        page=1,
        page_size=10,
        q=f"发布检索-{suffix}",
        status=None,
        gender=None,
        habitat_id=None,
        featured=None,
        sort="name_asc",
    )
    assert [item.id for item in projected_list.items] == [panda.id]

    rollback = rollback_to_batch(
        first_batch.id,
        PublicationAction(
            reason="Restore prior stable snapshot",
            correlation_id=uuid4(),
            data_version=f"integration-{suffix}-3",
        ),
        PUBLISHER_ID,
    )
    assert rollback.operation == "rollback"
    assert get_panda_by_ref(panda.slug).birthplace == "First visible birthplace"

    withdrawal = withdraw_batch(
        rollback.id,
        PublicationAction(
            reason="Emergency copyright withdrawal",
            correlation_id=uuid4(),
            data_version=f"integration-{suffix}-4",
        ),
        PUBLISHER_ID,
    )
    assert withdrawal.operation == "withdrawal"
    with pytest.raises(HTTPException, match="withdrawn"):
        get_panda_by_ref(panda.slug)
