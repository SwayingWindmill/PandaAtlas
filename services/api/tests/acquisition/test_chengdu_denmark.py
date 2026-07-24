from __future__ import annotations

import json
import shutil
from collections import Counter
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from app.acquisition import bundles as bundle_io
from app.acquisition.adapters import DEFAULT_ADAPTER_REGISTRY
from app.acquisition.chengdu_denmark import ADAPTER_ID, SOURCE_ID
from app.acquisition.contracts import (
    AcquisitionMode,
    AcquisitionRunState,
    CandidateKind,
    IdentityMatchState,
)
from app.acquisition.runner import AdapterRunRequest, AdapterRunStopped, run_adapter

_FIXTURE_DIR = Path(__file__).parent / "fixtures"
_FIXTURE_MANIFEST = _FIXTURE_DIR / "chengdu-denmark-handover-2019.manifest.json"


class IncrementingClock:
    def __init__(self, start: datetime) -> None:
        self.current = start

    def __call__(self) -> datetime:
        value = self.current
        self.current += timedelta(seconds=1)
        return value


def test_chengdu_denmark_fixture_emits_profile_parent_and_transfer_candidates(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(bundle_io, "LOCAL_BUNDLE_ROOT", tmp_path / "bundles")

    result = run_adapter(
        AdapterRunRequest(
            source_id=SOURCE_ID,
            adapter_id=ADAPTER_ID,
            mode=AcquisitionMode.FIXTURE,
            output_bundle="chengdu-denmark.json",
        ),
        adapter_registry=DEFAULT_ADAPTER_REGISTRY,
        clock=IncrementingClock(datetime(2026, 7, 23, 18, 0, tzinfo=UTC)),
    )

    assert result.request_count == 2
    assert result.bundle.run.state is AcquisitionRunState.COMPLETED
    assert len(result.bundle.evidence_snapshots) == 2
    assert len(result.bundle.candidates) == 30
    assert Counter(item.candidate_kind for item in result.bundle.candidates) == Counter(
        {
            CandidateKind.IDENTITY: 18,
            CandidateKind.RELATIONSHIP: 8,
            CandidateKind.EVENT: 4,
        }
    )
    assert Counter(item.identity_match.state for item in result.bundle.candidates) == Counter(
        {IdentityMatchState.MATCHED: 30}
    )

    mao_er = [item for item in result.bundle.candidates if item.subject_key == "chengdu:mao-er"]
    assert len(mao_er) == 16
    assert {item.identity_match.matched_canonical_slug for item in mao_er} == {"mao-sun"}
    assert {item.field_path for item in mao_er} >= {
        "identity.names.official.zh",
        "identity.names.official.en",
        "identity.aliases.zh",
        "identity.aliases.en",
        "identity.external_identifier.studbook",
        "identity.birth_date",
        "identity.sex",
        "relationship.father",
        "relationship.mother",
        "event",
    }

    xing_er = [item for item in result.bundle.candidates if item.subject_key == "chengdu:xing-er"]
    assert len(xing_er) == 14
    assert {item.identity_match.matched_canonical_slug for item in xing_er} == {"xing-er"}
    assert result.bundle.to_dict()["write_boundary"] == {
        "trusted_write_targets": [],
        "publication_write_targets": [],
    }


def test_chengdu_denmark_parser_fails_closed_on_profile_drift(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(bundle_io, "LOCAL_BUNDLE_ROOT", tmp_path / "bundles")
    fixture_dir = tmp_path / "fixture"
    fixture_dir.mkdir()
    for filename in (
        "chengdu-denmark-handover-2019-zh.html",
        "chengdu-denmark-handover-2019-en.html",
    ):
        shutil.copyfile(_FIXTURE_DIR / filename, fixture_dir / filename)
    english_path = fixture_dir / "chengdu-denmark-handover-2019-en.html"
    english_path.write_text(
        english_path.read_text(encoding="utf-8").replace("Pedigree No.: 919", "Pedigree No.: 918"),
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
                output_bundle="chengdu-denmark-drift.json",
            ),
            adapter_registry=DEFAULT_ADAPTER_REGISTRY,
            clock=IncrementingClock(datetime(2026, 7, 23, 19, 0, tzinfo=UTC)),
        )

    assert stopped.value.result.bundle.run.state is AcquisitionRunState.FAILED
    assert stopped.value.result.bundle.candidates == ()
