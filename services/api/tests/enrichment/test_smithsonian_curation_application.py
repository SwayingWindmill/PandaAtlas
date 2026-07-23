from __future__ import annotations

import csv
import shutil
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from pathlib import Path

import pytest

from app.acquisition import bundles as bundle_io
from app.acquisition import reconciliation as reconciliation_io
from app.acquisition.adapters import DEFAULT_ADAPTER_REGISTRY
from app.acquisition.contracts import AcquisitionMode
from app.acquisition.curation import CuratorDecision, DecisionAction, DecisionLog
from app.acquisition.runner import AdapterRunRequest, run_adapter
from app.acquisition.smithsonian_pandas import ADAPTER_ID, SOURCE_ID
from app.enrichment import (
    apply_smithsonian_current_pair_curation_patch_to_csv,
    build_smithsonian_current_pair_curation_review_plan,
    export_smithsonian_current_pair_curation_patch,
)
from scripts.check_smithsonian_current_pair_enrichment import (
    _build_cohort,
    _canonical_record,
    _canonical_source,
)

_REPOSITORY_ROOT = Path(__file__).resolve().parents[4]


def test_smithsonian_patch_dry_run_validates_without_touching_curation(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    patch = _verified_patch(tmp_path, monkeypatch)
    curation_dir = tmp_path / "curation"
    _copy_pre_application_curation(curation_dir)
    before = _csv_hashes(curation_dir)

    result = apply_smithsonian_current_pair_curation_patch_to_csv(
        patch,
        curation_dir=curation_dir,
        applied_at=datetime(2026, 7, 23, 19, 0, tzinfo=UTC),
    )

    assert result.applied is False
    assert result.proposal_count == 16
    assert result.panda_row_updates == 2
    assert result.event_insertions == 4
    assert result.source_row_updates == 3
    assert result.changed_files == ("events.csv", "pandas.csv", "sources.csv")
    assert result.validation_counts["pandas"] > 0
    assert result.publication_blockers == {
        "bao-li": (
            "approved-photo-count=0",
            "approved-verified-event-count=0",
        ),
        "qing-bao": (
            "approved-photo-count=0",
            "approved-verified-event-count=0",
        ),
    }
    assert _csv_hashes(curation_dir) == before
    assert result.before_sha256 != result.after_sha256


def test_smithsonian_patch_apply_commits_validated_csv_state(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    patch = _verified_patch(tmp_path, monkeypatch)
    curation_dir = tmp_path / "curation"
    _copy_pre_application_curation(curation_dir)

    result = apply_smithsonian_current_pair_curation_patch_to_csv(
        patch,
        curation_dir=curation_dir,
        applied_at=datetime(2026, 7, 23, 19, 0, tzinfo=UTC),
        apply=True,
    )

    assert result.applied is True
    assert _csv_hashes(curation_dir) == result.after_sha256
    pandas = _rows_by_key(curation_dir / "pandas.csv", "slug")
    assert pandas["bao-li"]["review_status"] == "reviewed"
    assert pandas["qing-bao"]["review_status"] == "reviewed"
    assert pandas["bao-li"]["current_location"] == (
        "David M. Rubenstein and Family Giant Panda Habitat, Smithsonian National Zoo"
    )
    assert "src_smithsonian_history" in pandas["bao-li"]["primary_source_ids"]
    events = _rows_by_key(curation_dir / "events.csv", "event_id")
    assert "evt_bao_li_arrival_20241015" in events
    assert "evt_qing_bao_public_debut_20250124" in events
    assert events["evt_bao_li_arrival_20241015"]["review_status"] == "reviewed"


def test_smithsonian_patch_refuses_concurrent_panda_change(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    patch = _verified_patch(tmp_path, monkeypatch)
    curation_dir = tmp_path / "curation"
    _copy_pre_application_curation(curation_dir)
    pandas_path = curation_dir / "pandas.csv"
    fields, rows = _read_rows(pandas_path)
    for row in rows:
        if row["slug"] == "bao-li":
            row["current_location"] = "Concurrent curator edit"
    _write_rows(pandas_path, fields, rows)
    before = _csv_hashes(curation_dir)

    with pytest.raises(ValueError, match="concurrent curation change"):
        apply_smithsonian_current_pair_curation_patch_to_csv(
            patch,
            curation_dir=curation_dir,
            applied_at=datetime(2026, 7, 23, 19, 0, tzinfo=UTC),
            apply=True,
        )

    assert _csv_hashes(curation_dir) == before


def test_smithsonian_patch_is_idempotent_after_apply(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    patch = _verified_patch(tmp_path, monkeypatch)
    curation_dir = tmp_path / "curation"
    _copy_pre_application_curation(curation_dir)
    apply_smithsonian_current_pair_curation_patch_to_csv(
        patch,
        curation_dir=curation_dir,
        applied_at=datetime(2026, 7, 23, 19, 0, tzinfo=UTC),
        apply=True,
    )
    applied_hashes = _csv_hashes(curation_dir)

    repeated = apply_smithsonian_current_pair_curation_patch_to_csv(
        patch,
        curation_dir=curation_dir,
        applied_at=datetime(2026, 7, 23, 19, 5, tzinfo=UTC),
    )

    assert repeated.panda_row_updates == 0
    assert repeated.event_insertions == 0
    assert repeated.source_row_updates == 0
    assert repeated.changed_files == ()
    assert _csv_hashes(curation_dir) == applied_hashes


def test_smithsonian_patch_refuses_concurrent_event_change(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    patch = _verified_patch(tmp_path, monkeypatch)
    curation_dir = tmp_path / "curation"
    _copy_pre_application_curation(curation_dir)
    events_path = curation_dir / "events.csv"
    fields, rows = _read_rows(events_path)
    rows.append(
        {
            "event_id": "evt_bao_li_manual_change",
            "panda_slug": "bao-li",
            "event_type": "observation",
            "event_date": "2026-07-23",
            "event_date_precision": "day",
            "location": "Manual curator location",
            "related_slugs": "",
            "source_ids": "src_smithsonian_giant_panda_page",
            "evidence_status": "verified",
            "review_status": "reviewed",
            "notes": "Concurrent manual event.",
        }
    )
    _write_rows(events_path, fields, rows)
    before = _csv_hashes(curation_dir)

    with pytest.raises(ValueError, match="concurrent curation change detected for events.bao-li"):
        apply_smithsonian_current_pair_curation_patch_to_csv(
            patch,
            curation_dir=curation_dir,
            applied_at=datetime(2026, 7, 23, 19, 0, tzinfo=UTC),
        )

    assert _csv_hashes(curation_dir) == before


def test_smithsonian_patch_validator_failure_never_commits(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    patch = _verified_patch(tmp_path, monkeypatch)
    curation_dir = tmp_path / "curation"
    _copy_pre_application_curation(curation_dir)
    before = _csv_hashes(curation_dir)

    with pytest.raises(ValueError, match="staged Smithsonian curation failed validation"):
        apply_smithsonian_current_pair_curation_patch_to_csv(
            patch,
            curation_dir=curation_dir,
            applied_at=datetime(2026, 7, 23, 19, 0, tzinfo=UTC),
            apply=True,
            validator=lambda _path: (["forced validation failure"], {}),
        )

    assert _csv_hashes(curation_dir) == before


def _copy_pre_application_curation(target: Path) -> None:
    shutil.copytree(_REPOSITORY_ROOT / "data" / "curation" / "pandas", target)

    events_path = target / "events.csv"
    event_fields, event_rows = _read_rows(events_path)
    applied_event_ids = {
        "evt_bao_li_arrival_20241015",
        "evt_bao_li_public_debut_20250124",
        "evt_qing_bao_arrival_20241015",
        "evt_qing_bao_public_debut_20250124",
    }
    for row in event_rows:
        if row["event_id"] in {"evt_bao_li_birth", "evt_qing_bao_birth"}:
            row["review_status"] = "draft"
            row["notes"] = ""
    _write_rows(
        events_path,
        event_fields,
        [row for row in event_rows if row["event_id"] not in applied_event_ids],
    )

    media_path = target / "media.csv"
    media_fields, media_rows = _read_rows(media_path)
    _write_rows(
        media_path,
        media_fields,
        [row for row in media_rows if row["panda_slug"] not in {"bao-li", "qing-bao"}],
    )

    pandas_path = target / "pandas.csv"
    panda_fields, panda_rows = _read_rows(pandas_path)
    for row in panda_rows:
        if row["slug"] not in {"bao-li", "qing-bao"}:
            continue
        row["current_location"] = "Smithsonian National Zoo, Washington, D.C."
        row["primary_source_ids"] = (
            "src_smithsonian_giant_panda_faq;src_smithsonian_giant_panda_page"
        )
        row["review_status"] = "draft"
    _write_rows(pandas_path, panda_fields, panda_rows)

    sources_path = target / "sources.csv"
    source_fields, source_rows = _read_rows(sources_path)
    reviewed_urls = {
        "https://nationalzoo.si.edu/animals/giant-panda",
        "https://nationalzoo.si.edu/animals/giant-panda-faqs",
        "https://nationalzoo.si.edu/animals/history-giant-pandas-zoo",
    }
    for row in source_rows:
        if row["url"] in reviewed_urls:
            row["accessed_at"] = "2026-05-09"
    _write_rows(sources_path, source_fields, source_rows)


def _verified_patch(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(bundle_io, "LOCAL_BUNDLE_ROOT", tmp_path / "bundles")
    canonical_curation_dir = tmp_path / "canonical-curation"
    _copy_pre_application_curation(canonical_curation_dir)
    snapshot = reconciliation_io.load_reconciliation_snapshot(curation_dir=canonical_curation_dir)
    monkeypatch.setattr(
        reconciliation_io,
        "load_reconciliation_snapshot",
        lambda: snapshot,
    )
    now = datetime(2026, 7, 23, 18, 0, tzinfo=UTC)
    acquisition = run_adapter(
        AdapterRunRequest(
            source_id=SOURCE_ID,
            adapter_id=ADAPTER_ID,
            mode=AcquisitionMode.FIXTURE,
            cohort="issue-131-current-pair",
            output_bundle="smithsonian-curation-application.json",
            overwrite=True,
        ),
        adapter_registry=DEFAULT_ADAPTER_REGISTRY,
        clock=lambda: now,
        sleeper=lambda _seconds: None,
    ).bundle
    canonical_source_id = f"curation-{snapshot.snapshot_id}"
    canonical_records = tuple(
        _canonical_record(snapshot.pandas_by_slug[slug], source_id=canonical_source_id)
        for slug in ("bao-li", "qing-bao")
    )
    canonical_source = _canonical_source(
        source_id=canonical_source_id,
        snapshot_id=snapshot.snapshot_id,
    )
    cohort = _build_cohort(
        acquisition,
        canonical_records=canonical_records,
        canonical_source=canonical_source,
        created_at=now + timedelta(minutes=5),
        generated_at=now + timedelta(minutes=10),
    )
    decided_at = now + timedelta(minutes=15)
    plan = build_smithsonian_current_pair_curation_review_plan(
        cohort,
        created_at=decided_at,
    )
    candidates = {candidate.candidate_id: candidate for candidate in acquisition.candidates}
    decisions = tuple(
        CuratorDecision(
            candidate_id=candidate_id,
            evidence_snapshot_id=candidates[candidate_id].evidence_snapshot_id,
            reviewer="curator-test",
            decided_at=decided_at,
            action=action,
            note="fixture review decision",
        )
        for action, candidate_ids in (
            (DecisionAction.ACCEPTED, plan.proposed_accept_candidate_ids),
            (DecisionAction.DEFERRED, plan.required_defer_candidate_ids),
        )
        for candidate_id in candidate_ids
    )
    decision_log = DecisionLog(
        acquisition_bundle_id=acquisition.bundle_id,
        created_at=decided_at,
        updated_at=decided_at,
        decisions=decisions,
    )
    return export_smithsonian_current_pair_curation_patch(
        cohort,
        decision_log,
        created_at=now + timedelta(minutes=20),
    )


def _read_rows(path: Path) -> tuple[tuple[str, ...], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return tuple(reader.fieldnames or ()), [dict(row) for row in reader]


def _write_rows(
    path: Path,
    fields: tuple[str, ...],
    rows: list[dict[str, str]],
) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def _rows_by_key(path: Path, key: str) -> dict[str, dict[str, str]]:
    _, rows = _read_rows(path)
    return {row[key]: row for row in rows}


def _csv_hashes(curation_dir: Path) -> dict[str, str]:
    return {
        path.name: sha256(path.read_bytes()).hexdigest()
        for path in sorted(curation_dir.glob("*.csv"))
    }
