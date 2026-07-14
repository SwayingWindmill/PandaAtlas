from uuid import UUID

import pytest

from app.domain.publication_workflow import (
    ChangeSet,
    EntityRevision,
    WorkflowConflict,
    preview_revisions,
)

EDITOR_ID = UUID("11111111-1111-4111-8111-111111111111")
REVIEWER_ID = UUID("22222222-2222-4222-8222-222222222222")


def _submitted_change_set() -> ChangeSet:
    change_set = ChangeSet.create(
        title="Correct Mei Xiang residency",
        reason="Use the reviewed transfer record",
        actor_id=EDITOR_ID,
        revisions=(
            EntityRevision.create(
                entity_type="panda",
                entity_id="2939c16f-1938-5629-928c-b36b1d5cd6ed",
                payload={"publication_checks": {}},
                actor_id=EDITOR_ID,
            ),
        ),
    )
    return change_set.submit(actor_id=EDITOR_ID)


def test_contributor_cannot_approve_own_substantive_change() -> None:
    change_set = _submitted_change_set()

    with pytest.raises(WorkflowConflict, match="independent reviewer"):
        change_set.review(
            actor_id=EDITOR_ID,
            decision="approved",
            reason="Looks correct",
        )

    approved = change_set.review(
        actor_id=REVIEWER_ID,
        decision="approved",
        reason="Sources and dates verified",
    )
    assert approved.status == "approved"
    assert approved.reviewed_by == REVIEWER_ID


def test_publication_preview_reports_every_required_problem_category() -> None:
    revision = EntityRevision.create(
        entity_type="panda",
        entity_id="mei-xiang",
        actor_id=EDITOR_ID,
        payload={
            "publication_checks": {
                "references": [
                    {"target_type": "source", "target_id": "missing", "resolved": False}
                ],
                "residencies": [
                    {
                        "panda_id": "mei-xiang",
                        "start_date": "2023-01-01",
                        "end_date": "2023-12-01",
                    },
                    {
                        "panda_id": "mei-xiang",
                        "start_date": "2023-11-01",
                        "end_date": None,
                    },
                ],
                "translations": [
                    {"language_tag": "en", "status": "draft"},
                ],
                "sources": [
                    {"id": "source-gone", "access_state": "unavailable"},
                ],
                "media": [
                    {"id": "photo-1", "license": None},
                ],
            }
        },
    )

    preview = preview_revisions((revision,))

    assert preview.is_publishable is False
    assert {issue.category for issue in preview.issues} == {
        "unresolved_reference",
        "residency_conflict",
        "translation_state",
        "source_availability",
        "license_problem",
    }


def test_publication_preview_detects_residency_conflicts_across_revisions() -> None:
    revisions = tuple(
        EntityRevision.create(
            entity_type="residency",
            entity_id=f"residency-{index}",
            actor_id=EDITOR_ID,
            payload={
                "public_record": {},
                "publication_checks": {
                    "references": [],
                    "residencies": [
                        {
                            "panda_id": "mei-xiang",
                            "start_date": start,
                            "end_date": end,
                        }
                    ],
                    "translations": [],
                    "sources": [],
                    "media": [],
                },
            },
        )
        for index, (start, end) in enumerate(
            (("2023-01-01", "2023-12-01"), ("2023-11-01", None)),
            start=1,
        )
    )

    preview = preview_revisions(revisions)

    assert [issue.category for issue in preview.issues] == ["residency_conflict"]
