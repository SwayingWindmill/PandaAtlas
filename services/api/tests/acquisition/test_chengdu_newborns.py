from __future__ import annotations

import json
import shutil
from collections import Counter
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from app.acquisition import bundles as bundle_io
from app.acquisition.adapters import DEFAULT_ADAPTER_REGISTRY
from app.acquisition.chengdu_newborns import ADAPTER_ID, SOURCE_ID
from app.acquisition.contracts import (
    AcquisitionMode,
    AcquisitionRunState,
    CandidateKind,
    IdentityMatchState,
)
from app.acquisition.runner import AdapterRunRequest, AdapterRunStopped, run_adapter

_FIXTURE_DIR = Path(__file__).parent / "fixtures"
_FIXTURE_MANIFEST = _FIXTURE_DIR / "chengdu-newborns-2021.manifest.json"


class IncrementingClock:
    def __init__(self, start: datetime) -> None:
        self.current = start

    def __call__(self) -> datetime:
        value = self.current
        self.current += timedelta(seconds=1)
        return value


def test_chengdu_newborn_fixture_emits_identity_relationship_and_event_candidates(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(bundle_io, "LOCAL_BUNDLE_ROOT", tmp_path / "bundles")

    result = run_adapter(
        AdapterRunRequest(
            source_id=SOURCE_ID,
            adapter_id=ADAPTER_ID,
            mode=AcquisitionMode.FIXTURE,
            output_bundle="chengdu-newborns.json",
        ),
        adapter_registry=DEFAULT_ADAPTER_REGISTRY,
        clock=IncrementingClock(datetime(2026, 7, 23, 16, 0, tzinfo=UTC)),
    )

    assert result.request_count == 2
    assert result.bundle.run.state is AcquisitionRunState.COMPLETED
    assert len(result.bundle.evidence_snapshots) == 2
    assert len(result.bundle.candidates) == 60
    assert Counter(item.candidate_kind for item in result.bundle.candidates) == Counter(
        {
            CandidateKind.IDENTITY: 40,
            CandidateKind.RELATIONSHIP: 10,
            CandidateKind.EVENT: 10,
        }
    )
    assert Counter(item.identity_match.state for item in result.bundle.candidates) == Counter(
        {IdentityMatchState.MATCHED: 60}
    )

    bao_xin = [item for item in result.bundle.candidates if item.subject_key == "chengdu:bao-xin"]
    assert len(bao_xin) == 10
    assert {item.identity_match.matched_canonical_slug for item in bao_xin} == {"bao-xin"}

    jin_xiao = [item for item in result.bundle.candidates if item.subject_key == "chengdu:jin-xiao"]
    assert len(jin_xiao) == 10
    assert {item.identity_match.matched_canonical_slug for item in jin_xiao} == {"jin-xiao"}
    assert {item.field_path for item in jin_xiao} >= {
        "identity.names.official.zh",
        "identity.names.official.en",
        "identity.birth_date",
        "identity.sex",
        "relationship.mother",
        "event",
    }

    mei_lun = [item for item in result.bundle.candidates if item.subject_key == "chengdu:mei-lun"]
    assert len(mei_lun) == 2
    assert {item.identity_match.matched_canonical_slug for item in mei_lun} == {"mei-lun"}
    assert result.bundle.to_dict()["write_boundary"] == {
        "trusted_write_targets": [],
        "publication_write_targets": [],
    }


def test_chengdu_newborn_parser_fails_closed_on_bilingual_drift(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(bundle_io, "LOCAL_BUNDLE_ROOT", tmp_path / "bundles")
    fixture_dir = tmp_path / "fixture"
    fixture_dir.mkdir()
    for filename in (
        "chengdu-newborns-2021-zh.html",
        "chengdu-newborns-2021-en.html",
    ):
        shutil.copyfile(_FIXTURE_DIR / filename, fixture_dir / filename)
    english_path = fixture_dir / "chengdu-newborns-2021-en.html"
    english_path.write_text(
        english_path.read_text(encoding="utf-8").replace("June 24, 2021", "June 25, 2021"),
        encoding="utf-8",
    )
    manifest = json.loads(_FIXTURE_MANIFEST.read_text(encoding="utf-8"))
    manifest_path = fixture_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    with pytest.raises(AdapterRunStopped, match="profile facts drifted") as stopped:
        run_adapter(
            AdapterRunRequest(
                source_id=SOURCE_ID,
                adapter_id=ADAPTER_ID,
                mode=AcquisitionMode.FIXTURE,
                fixture=manifest_path,
                output_bundle="chengdu-newborns-drift.json",
            ),
            adapter_registry=DEFAULT_ADAPTER_REGISTRY,
            clock=IncrementingClock(datetime(2026, 7, 23, 17, 0, tzinfo=UTC)),
        )

    assert stopped.value.result.bundle.run.state is AcquisitionRunState.FAILED
    assert stopped.value.result.bundle.candidates == ()
