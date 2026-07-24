from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from app.acquisition import backfill as backfill_module
from app.acquisition import bundles as bundle_io
from app.acquisition.adapters import DEFAULT_ADAPTER_REGISTRY
from app.acquisition.backfill import (
    build_breadth_first_report,
    load_target_assessments,
    load_work_queue,
    write_backfill_report,
)
from app.acquisition.chengdu_international import ADAPTER_ID, SOURCE_ID
from app.acquisition.contracts import AcquisitionMode
from app.acquisition.runner import AdapterRunRequest, run_adapter


class IncrementingClock:
    def __init__(self, start: datetime) -> None:
        self.current = start

    def __call__(self) -> datetime:
        value = self.current
        self.current += timedelta(seconds=1)
        return value


def _chengdu_fixture_bundle(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(bundle_io, "LOCAL_BUNDLE_ROOT", tmp_path / "bundles")
    return run_adapter(
        AdapterRunRequest(
            source_id=SOURCE_ID,
            adapter_id=ADAPTER_ID,
            mode=AcquisitionMode.FIXTURE,
            output_bundle="chengdu.json",
        ),
        adapter_registry=DEFAULT_ADAPTER_REGISTRY,
        clock=IncrementingClock(datetime(2026, 7, 23, 12, 0, tzinfo=UTC)),
    ).bundle


def test_breadth_first_report_disposes_current_inventory_and_linked_identity(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    queue, queue_snapshot = load_work_queue()
    assessments, assessment_snapshot = load_target_assessments()
    bundle = _chengdu_fixture_bundle(tmp_path, monkeypatch)

    report = build_breadth_first_report(
        queue=queue,
        assessments=assessments,
        bundles=(bundle,),
        generated_at=datetime(2026, 7, 23, 15, 30, tzinfo=UTC),
        inputs=(queue_snapshot, assessment_snapshot),
    )
    payload = report.to_dict()

    assert payload["summary"]["existing_panda_count"] == 813
    assert payload["summary"]["acquisition_candidate_coverage_count"] == 11
    assert payload["summary"]["page_publication_coverage_count"] == 10
    assert payload["summary"]["cleared_photo_coverage_count"] == 9
    assert payload["summary"]["identity_disposition_counts"] == {"merge": 11}
    assert sum(payload["summary"]["existing_disposition_counts"].values()) == 813
    assert {
        item.panda_slug
        for item in report.existing_pandas
        if item.disposition == "acquired-candidate-batch"
    } == {
        "hua-zui-ba",
        "huan-huan",
        "jiao-qing",
        "lun-lun",
        "mao-sun",
        "mei-lan",
        "meimei",
        "meng-meng",
        "xing-er",
        "yuan-meng",
        "yuan-zai",
    }
    mao_er = next(item for item in report.identities if item.subject_key == "chengdu:mao-er")
    assert mao_er.disposition == "merge"
    assert mao_er.matched_canonical_slug == "mao-sun"
    assert mao_er.official_name_zh == "毛二"
    assert mao_er.official_name_en == "Mao Er"
    assert payload["write_boundary"] == {
        "trusted_write_targets": [],
        "publication_write_targets": [],
    }


def test_breadth_first_report_is_reproducible_and_output_is_confined(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    queue, queue_snapshot = load_work_queue()
    assessments, assessment_snapshot = load_target_assessments()
    bundle = _chengdu_fixture_bundle(tmp_path, monkeypatch)
    generated_at = datetime(2026, 7, 23, 15, 30, tzinfo=UTC)

    first = build_breadth_first_report(
        queue=queue,
        assessments=assessments,
        bundles=(bundle,),
        generated_at=generated_at,
        inputs=(queue_snapshot, assessment_snapshot),
    )
    second = build_breadth_first_report(
        queue=queue,
        assessments=assessments,
        bundles=(bundle,),
        generated_at=generated_at,
        inputs=(queue_snapshot, assessment_snapshot),
    )
    assert first.report_id == second.report_id
    assert first.to_dict() == second.to_dict()

    output_root = tmp_path / "backfill-runs"
    monkeypatch.setattr(backfill_module, "LOCAL_BACKFILL_ROOT", output_root)
    output = write_backfill_report(first, "report.json")
    assert output == output_root / "report.json"
    assert output.is_file()
    with pytest.raises(ValueError, match="must stay below"):
        write_backfill_report(first, tmp_path / "outside.json", overwrite=True)


def test_breadth_first_report_fails_when_queue_coverage_drifts(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    queue, _ = load_work_queue()
    assessments, _ = load_target_assessments()
    bundle = _chengdu_fixture_bundle(tmp_path, monkeypatch)
    drifted = deepcopy(queue)
    drifted["summary"]["panda_count"] = 810

    with pytest.raises(ValueError, match="do not cover every work-queue panda"):
        build_breadth_first_report(
            queue=drifted,
            assessments=assessments,
            bundles=(bundle,),
            generated_at=datetime(2026, 7, 23, 15, 30, tzinfo=UTC),
        )
