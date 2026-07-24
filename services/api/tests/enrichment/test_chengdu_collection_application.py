from __future__ import annotations

import csv
import json
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
    build_collection_decision_log,
    export_curation_patch,
)
from app.acquisition.runner import AdapterRunRequest, run_adapter
from app.enrichment import apply_chengdu_collection_patches
from tests.support.chengdu_preapplication import install_chengdu_preapplication_reconciliation

_SOURCE_ID = "chengdu-panda-base-international-cooperation"


class IncrementingClock:
    def __init__(self, start: datetime) -> None:
        self.current = start

    def __call__(self) -> datetime:
        value = self.current
        self.current += timedelta(seconds=1)
        return value


def _fixture_patches(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    curation_dir, identity_links, _ = install_chengdu_preapplication_reconciliation(
        tmp_path / "preapplication",
        monkeypatch,
    )
    monkeypatch.setattr(bundle_io, "LOCAL_BUNDLE_ROOT", tmp_path / "bundles")
    patches = []
    for index, adapter_id in enumerate(
        (
            INTERNATIONAL_ADAPTER_ID,
            NEWBORNS_2021_ADAPTER_ID,
            DENMARK_ADAPTER_ID,
            NEWBORNS_2017_ADAPTER_ID,
        )
    ):
        bundle = run_adapter(
            AdapterRunRequest(
                source_id=_SOURCE_ID,
                adapter_id=adapter_id,
                mode=AcquisitionMode.FIXTURE,
                output_bundle=f"{adapter_id}.json",
            ),
            adapter_registry=DEFAULT_ADAPTER_REGISTRY,
            clock=IncrementingClock(datetime(2026, 7, 24, 5, index * 5, tzinfo=UTC)),
        ).bundle
        decided_at = datetime(2026, 7, 24, 6, 0, tzinfo=UTC)
        decisions, _ = build_collection_decision_log(bundle, decided_at=decided_at)
        patches.append(export_curation_patch(bundle, decisions, created_at=decided_at))
    return tuple(patches), curation_dir, identity_links


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def test_chengdu_collection_application_is_validated_atomic_and_idempotent(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    patches, curation_dir, identity_links = _fixture_patches(tmp_path, monkeypatch)
    applied_at = datetime(2026, 7, 24, 7, 0, tzinfo=UTC)

    dry_run = apply_chengdu_collection_patches(
        patches,
        curation_dir=curation_dir,
        identity_links_path=identity_links,
        applied_at=applied_at,
    )
    assert dry_run.applied is False
    assert dry_run.new_panda_insertions == 4
    assert dry_run.panda_row_updates > 0
    assert dry_run.event_insertions > 0
    assert dry_run.source_insertions == 8
    assert dry_run.identity_link_insertions == 4
    assert dry_run.before_sha256 != dry_run.after_sha256

    applied = apply_chengdu_collection_patches(
        patches,
        curation_dir=curation_dir,
        identity_links_path=identity_links,
        applied_at=applied_at,
        apply=True,
    )
    assert applied.applied is True
    assert applied.after_sha256 == dry_run.after_sha256
    assert set(applied.changed_files) >= {
        "events.csv",
        "pandas.csv",
        "sources.csv",
        "identity-links/identity-links.json",
    }

    pandas_by_slug = {row["slug"]: row for row in _read_csv(curation_dir / "pandas.csv")}
    assert {
        "bao-xin",
        "zhen-xi",
        "qing-qing-chengdu-2017-07-26",
        "xiao-xin-chengdu-2017",
    } <= set(pandas_by_slug)
    assert pandas_by_slug["bao-xin"]["name_zh"] == "宝新"
    assert pandas_by_slug["bao-xin"]["name_en"] == "Bao Xin"
    assert pandas_by_slug["bao-xin"]["birth_date"] == "2021-06-24"
    assert pandas_by_slug["bao-xin"]["review_status"] == "reviewed"

    source_urls = {row["url"] for row in _read_csv(curation_dir / "sources.csv")}
    assert "https://www.panda.org.cn/cn/cooperate/international/" in source_urls
    assert "https://www.panda.org.cn/en/culture/activities/2023-08-24/8080.html" in source_urls

    links = json.loads(identity_links.read_text(encoding="utf-8"))
    link_map = {
        (item["source_id"], item["source_key"]): item["canonical_slug"]
        for item in links["source_keys"]
    }
    assert link_map[(_SOURCE_ID, "chengdu:bao-xin")] == "bao-xin"
    assert link_map[(_SOURCE_ID, "chengdu:qing-qing-2017-07-26")] == (
        "qing-qing-chengdu-2017-07-26"
    )

    second = apply_chengdu_collection_patches(
        patches,
        curation_dir=curation_dir,
        identity_links_path=identity_links,
        applied_at=applied_at,
        apply=True,
    )
    assert second.new_panda_insertions == 0
    assert second.panda_row_updates == 0
    assert second.event_insertions == 0
    assert second.source_insertions == 0
    assert second.source_updates == 0
    assert second.identity_link_insertions == 0
    assert second.changed_files == ()
    assert second.before_sha256 == second.after_sha256


def test_chengdu_collection_application_rejects_expired_review(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    patches, curation_dir, identity_links = _fixture_patches(tmp_path, monkeypatch)

    with pytest.raises(ValueError, match="source review expired"):
        apply_chengdu_collection_patches(
            patches,
            curation_dir=curation_dir,
            identity_links_path=identity_links,
            applied_at=datetime(2026, 11, 1, tzinfo=UTC),
        )
