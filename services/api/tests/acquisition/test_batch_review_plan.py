from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from app.acquisition import bundles as bundle_io
from app.acquisition.adapters import DEFAULT_ADAPTER_REGISTRY
from app.acquisition.chengdu_denmark import ADAPTER_ID as DENMARK_ADAPTER_ID
from app.acquisition.chengdu_international import ADAPTER_ID as INTERNATIONAL_ADAPTER_ID
from app.acquisition.chengdu_newborns import ADAPTER_ID as NEWBORNS_2021_ADAPTER_ID
from app.acquisition.chengdu_newborns_2017 import ADAPTER_ID as NEWBORNS_2017_ADAPTER_ID
from app.acquisition.contracts import AcquisitionMode
from app.acquisition.curation import (
    ReviewLane,
    build_batch_review_plan,
    write_batch_review_plan,
)
from app.acquisition.runner import AdapterRunRequest, run_adapter
from tests.support.chengdu_preapplication import install_chengdu_preapplication_reconciliation

_SOURCE_ID = "chengdu-panda-base-international-cooperation"


class IncrementingClock:
    def __init__(self, start: datetime) -> None:
        self.current = start

    def __call__(self) -> datetime:
        value = self.current
        self.current += timedelta(seconds=1)
        return value


def _fixture_bundles(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    install_chengdu_preapplication_reconciliation(tmp_path / "preapplication", monkeypatch)
    monkeypatch.setattr(bundle_io, "LOCAL_BUNDLE_ROOT", tmp_path / "bundles")
    adapter_ids = (
        INTERNATIONAL_ADAPTER_ID,
        NEWBORNS_2021_ADAPTER_ID,
        DENMARK_ADAPTER_ID,
        NEWBORNS_2017_ADAPTER_ID,
    )
    bundles = []
    for index, adapter_id in enumerate(adapter_ids):
        bundles.append(
            run_adapter(
                AdapterRunRequest(
                    source_id=_SOURCE_ID,
                    adapter_id=adapter_id,
                    mode=AcquisitionMode.FIXTURE,
                    output_bundle=f"{adapter_id}.json",
                ),
                adapter_registry=DEFAULT_ADAPTER_REGISTRY,
                clock=IncrementingClock(datetime(2026, 7, 24, 3, index * 5, tzinfo=UTC)),
            ).bundle
        )
    return tuple(bundles)


def test_batch_review_plan_groups_four_chengdu_bundles_deterministically(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    bundles = _fixture_bundles(tmp_path, monkeypatch)
    generated_at = datetime(2026, 7, 24, 4, 0, tzinfo=UTC)

    first = build_batch_review_plan(bundles, generated_at=generated_at)
    second = build_batch_review_plan(tuple(reversed(bundles)), generated_at=generated_at)

    assert first.plan_id == second.plan_id
    assert first.to_dict() == second.to_dict()
    payload = first.to_dict()
    assert payload["summary"]["bundle_count"] == 4
    assert payload["summary"]["candidate_count"] == 279
    assert payload["summary"]["group_count"] < 279
    assert sum(payload["summary"]["lane_candidate_counts"].values()) == 279

    create_subjects = {
        group.subject_key
        for group in first.groups
        if group.lane is ReviewLane.MANUAL_CREATE_IDENTITY
    }
    assert create_subjects == {
        "chengdu:bao-xin",
        "chengdu:qing-qing-2017-07-26",
        "chengdu:xiao-xin-2017",
        "chengdu:zhen-xi",
    }
    blocked_subjects = {
        group.subject_key for group in first.groups if group.lane is ReviewLane.BLOCKED_ON_CREATE
    }
    assert blocked_subjects == create_subjects

    mao_er_groups = [group for group in first.groups if group.subject_key == "mao-sun"]
    assert mao_er_groups
    assert all(group.lane is not ReviewLane.MANUAL_CREATE_IDENTITY for group in mao_er_groups)
    assert {group.lane for group in first.groups} >= {
        ReviewLane.BATCH_READY,
        ReviewLane.MANUAL_CONTRADICTION,
        ReviewLane.MANUAL_CREATE_IDENTITY,
        ReviewLane.BLOCKED_ON_CREATE,
        ReviewLane.SUPPORTING_UNCHANGED,
        ReviewLane.MANUAL_RELATIONSHIP_RESOLUTION,
    }
    assert payload["write_boundary"] == {
        "canonical_curation_write_targets": [],
        "trusted_write_targets": [],
        "publication_write_targets": [],
    }


def test_batch_review_plan_output_is_confined(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    bundles = _fixture_bundles(tmp_path, monkeypatch)
    plan = build_batch_review_plan(
        bundles,
        generated_at=datetime(2026, 7, 24, 4, 0, tzinfo=UTC),
    )
    output_root = tmp_path / "review-plans"
    monkeypatch.setattr(
        "app.acquisition.curation.batch_review.LOCAL_REVIEW_PLAN_ROOT",
        output_root,
    )

    output = write_batch_review_plan(plan, "plan.json")
    assert output == output_root / "plan.json"
    assert output.is_file()
    with pytest.raises(FileExistsError):
        write_batch_review_plan(plan, "plan.json")
    with pytest.raises(ValueError, match="must stay below"):
        write_batch_review_plan(plan, tmp_path / "outside.json")
