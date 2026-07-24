from __future__ import annotations

import json
import shutil
from collections import Counter
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from app.acquisition import bundles as bundle_io
from app.acquisition import runner as runner_module
from app.acquisition.adapters import DEFAULT_ADAPTER_REGISTRY
from app.acquisition.chengdu_international import ADAPTER_ID, SOURCE_ID
from app.acquisition.contracts import (
    AcquisitionMode,
    AcquisitionRunState,
    CandidateKind,
    IdentityMatchState,
)
from app.acquisition.runner import AdapterRunRequest, AdapterRunStopped, run_adapter
from app.acquisition.source_registry import load_source_registry

_FIXTURE_DIR = Path(__file__).parent / "fixtures"
_FIXTURE_MANIFEST = _FIXTURE_DIR / "chengdu-international-cooperation.manifest.json"


class IncrementingClock:
    def __init__(self, start: datetime) -> None:
        self.current = start

    def __call__(self) -> datetime:
        value = self.current
        self.current += timedelta(seconds=1)
        return value


def test_chengdu_request_interval_is_source_scoped() -> None:
    registry = load_source_registry(today=datetime(2026, 7, 23, tzinfo=UTC).date())
    assert runner_module._reviewed_request_interval_seconds(registry.get(SOURCE_ID)) == 90
    assert (
        runner_module._reviewed_request_interval_seconds(
            registry.get("wikimedia-commons-action-api")
        )
        == 10
    )


def test_chengdu_fixture_emits_bilingual_identity_and_event_candidates(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(bundle_io, "LOCAL_BUNDLE_ROOT", tmp_path / "bundles")

    result = run_adapter(
        AdapterRunRequest(
            source_id=SOURCE_ID,
            adapter_id=ADAPTER_ID,
            mode=AcquisitionMode.FIXTURE,
            output_bundle="chengdu.json",
        ),
        adapter_registry=DEFAULT_ADAPTER_REGISTRY,
        clock=IncrementingClock(datetime(2026, 7, 23, 12, 0, tzinfo=UTC)),
    )

    assert result.request_count == 2
    assert result.bundle.run.state is AcquisitionRunState.COMPLETED
    assert len(result.bundle.evidence_snapshots) == 2
    assert len(result.bundle.candidates) == 76
    assert Counter(item.candidate_kind for item in result.bundle.candidates) == Counter(
        {
            CandidateKind.IDENTITY: 30,
            CandidateKind.EVENT: 46,
        }
    )
    assert Counter(item.identity_match.state for item in result.bundle.candidates) == Counter(
        {IdentityMatchState.MATCHED: 76}
    )

    mao_er = [item for item in result.bundle.candidates if item.subject_key == "chengdu:mao-er"]
    assert len(mao_er) == 4
    assert {item.identity_match.matched_canonical_slug for item in mao_er} == {"mao-sun"}

    huan_huan = [
        item for item in result.bundle.candidates if item.subject_key == "chengdu:huan-huan"
    ]
    assert huan_huan
    assert {item.identity_match.matched_canonical_slug for item in huan_huan} == {"huan-huan"}

    name_languages = {
        item.field_path
        for item in result.bundle.candidates
        if item.subject_key == "chengdu:meng-meng" and item.candidate_kind is CandidateKind.IDENTITY
    }
    assert {
        "identity.names.official.zh",
        "identity.names.official.en",
    }.issubset(name_languages)
    assert result.bundle.to_dict()["write_boundary"] == {
        "trusted_write_targets": [],
        "publication_write_targets": [],
    }


def test_chengdu_bilingual_parser_fails_closed_on_identity_drift(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(bundle_io, "LOCAL_BUNDLE_ROOT", tmp_path / "bundles")
    fixture_dir = tmp_path / "fixture"
    fixture_dir.mkdir()
    for filename in (
        "chengdu-international-cooperation-zh.html",
        "chengdu-international-cooperation-en.html",
    ):
        shutil.copyfile(_FIXTURE_DIR / filename, fixture_dir / filename)
    english_path = fixture_dir / "chengdu-international-cooperation-en.html"
    english_path.write_text(
        english_path.read_text(encoding="utf-8").replace("Mao Er", "Mao San"),
        encoding="utf-8",
    )
    manifest = json.loads(_FIXTURE_MANIFEST.read_text(encoding="utf-8"))
    manifest_path = fixture_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

    with pytest.raises(AdapterRunStopped, match="Mao Er") as stopped:
        run_adapter(
            AdapterRunRequest(
                source_id=SOURCE_ID,
                adapter_id=ADAPTER_ID,
                mode=AcquisitionMode.FIXTURE,
                fixture=manifest_path,
                output_bundle="chengdu-drift.json",
            ),
            adapter_registry=DEFAULT_ADAPTER_REGISTRY,
            clock=IncrementingClock(datetime(2026, 7, 23, 13, 0, tzinfo=UTC)),
        )

    assert stopped.value.result.bundle.run.state is AcquisitionRunState.FAILED
    assert stopped.value.result.bundle.candidates == ()
