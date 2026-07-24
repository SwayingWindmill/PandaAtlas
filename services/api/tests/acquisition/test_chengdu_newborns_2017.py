from __future__ import annotations

import json
import shutil
from collections import Counter
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from app.acquisition import bundles as bundle_io
from app.acquisition.adapters import DEFAULT_ADAPTER_REGISTRY
from app.acquisition.chengdu_newborns_2017 import ADAPTER_ID, SOURCE_ID
from app.acquisition.contracts import (
    AcquisitionMode,
    AcquisitionRunState,
    CandidateKind,
    IdentityMatchState,
)
from app.acquisition.runner import AdapterRunRequest, AdapterRunStopped, run_adapter

_FIXTURE_DIR = Path(__file__).parent / "fixtures"
_FIXTURE_MANIFEST = _FIXTURE_DIR / "chengdu-newborns-2017.manifest.json"


class IncrementingClock:
    def __init__(self, start: datetime) -> None:
        self.current = start

    def __call__(self) -> datetime:
        value = self.current
        self.current += timedelta(seconds=1)
        return value


def test_chengdu_2017_newborn_fixture_emits_breadth_first_candidates(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(bundle_io, "LOCAL_BUNDLE_ROOT", tmp_path / "bundles")

    result = run_adapter(
        AdapterRunRequest(
            source_id=SOURCE_ID,
            adapter_id=ADAPTER_ID,
            mode=AcquisitionMode.FIXTURE,
            output_bundle="chengdu-newborns-2017.json",
        ),
        adapter_registry=DEFAULT_ADAPTER_REGISTRY,
        clock=IncrementingClock(datetime(2026, 7, 24, 1, 0, tzinfo=UTC)),
    )

    assert result.request_count == 2
    assert result.bundle.run.state is AcquisitionRunState.COMPLETED
    assert len(result.bundle.evidence_snapshots) == 2
    assert len(result.bundle.candidates) == 113
    assert Counter(item.candidate_kind for item in result.bundle.candidates) == Counter(
        {
            CandidateKind.IDENTITY: 69,
            CandidateKind.RELATIONSHIP: 22,
            CandidateKind.EVENT: 22,
        }
    )
    assert Counter(item.identity_match.state for item in result.bundle.candidates) == Counter(
        {IdentityMatchState.MATCHED: 113}
    )

    ni_ke = [item for item in result.bundle.candidates if item.subject_key == "chengdu:ni-ke-2017"]
    assert len(ni_ke) == 11
    assert {item.identity_match.matched_canonical_slug for item in ni_ke} == {"ni-ke"}
    assert any(
        item.field_path == "identity.aliases.en" and item.normalized_value == "Nicole"
        for item in ni_ke
    )

    yuan_meng = [
        item for item in result.bundle.candidates if item.subject_key == "chengdu:huan-huanzai-2017"
    ]
    assert len(yuan_meng) == 10
    assert {item.identity_match.matched_canonical_slug for item in yuan_meng} == {"yuan-meng"}
    assert {
        item.field_path for item in yuan_meng if item.candidate_kind is CandidateKind.IDENTITY
    } >= {"identity.aliases.zh", "identity.aliases.en", "identity.birth_date", "identity.sex"}

    expected_newborn_slugs = {
        "chengdu:zhen-xi": "zhen-xi",
        "chengdu:qing-qing-2017-07-26": "qing-qing-chengdu-2017-07-26",
        "chengdu:xiao-xin-2017": "xiao-xin-chengdu-2017",
    }
    for source_key, canonical_slug in expected_newborn_slugs.items():
        candidates = [item for item in result.bundle.candidates if item.subject_key == source_key]
        assert len(candidates) == 10
        assert {item.identity_match.matched_canonical_slug for item in candidates} == {
            canonical_slug
        }

    assert result.bundle.to_dict()["write_boundary"] == {
        "trusted_write_targets": [],
        "publication_write_targets": [],
    }


def test_chengdu_2017_newborn_parser_fails_closed_on_litter_drift(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(bundle_io, "LOCAL_BUNDLE_ROOT", tmp_path / "bundles")
    fixture_dir = tmp_path / "fixture"
    fixture_dir.mkdir()
    for filename in (
        "chengdu-newborns-2017-zh.html",
        "chengdu-newborns-2017-en.html",
    ):
        shutil.copyfile(_FIXTURE_DIR / filename, fixture_dir / filename)
    english_path = fixture_dir / "chengdu-newborns-2017-en.html"
    english_path.write_text(
        english_path.read_text(encoding="utf-8").replace("Zhen Xi: female", "Zhen Xi: male"),
        encoding="utf-8",
    )
    manifest = json.loads(_FIXTURE_MANIFEST.read_text(encoding="utf-8"))
    manifest_path = fixture_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    with pytest.raises(AdapterRunStopped, match="cub facts drifted") as stopped:
        run_adapter(
            AdapterRunRequest(
                source_id=SOURCE_ID,
                adapter_id=ADAPTER_ID,
                mode=AcquisitionMode.FIXTURE,
                fixture=manifest_path,
                output_bundle="chengdu-newborns-2017-drift.json",
            ),
            adapter_registry=DEFAULT_ADAPTER_REGISTRY,
            clock=IncrementingClock(datetime(2026, 7, 24, 2, 0, tzinfo=UTC)),
        )

    assert stopped.value.result.bundle.run.state is AcquisitionRunState.FAILED
    assert stopped.value.result.bundle.candidates == ()
