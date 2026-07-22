from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass, replace
from datetime import UTC, date, datetime, timedelta
from hashlib import sha256
from pathlib import Path
from types import MappingProxyType

import httpx
import pytest

from app.acquisition import bundles as bundle_io
from app.acquisition import runner as runner_module
from app.acquisition.adapters import DEFAULT_ADAPTER_REGISTRY
from app.acquisition.contracts import (
    AcquisitionBundle,
    AcquisitionCapability,
    AcquisitionMode,
    AcquisitionRun,
    AcquisitionRunState,
    CandidateKind,
    ConflictState,
    CurrentTrustedValue,
    EvidenceBlockState,
    EvidenceSnapshot,
    FieldCandidate,
    IdentityMatchState,
    PandaIdentityMatch,
    SourceLocator,
    SourceLocatorKind,
)
from app.acquisition.curation import (
    DecisionAction,
    DecisionLog,
    export_curation_patch,
    load_acquisition_bundle,
    load_decision_log,
    record_decision,
    summarize_candidates,
    write_curation_patch,
    write_decision_log,
)
from app.acquisition.curation import io as curation_io
from app.acquisition.reconciliation import (
    CurationPanda,
    ReconciliationSnapshot,
    SourceKeyLink,
    reconcile_candidates,
)
from app.acquisition.runner import (
    AdapterParseContext,
    AdapterRegistry,
    AdapterRequest,
    AdapterRunRequest,
    AdapterRunStopped,
    run_adapter,
)
from app.acquisition.source_registry import ReviewedSource, load_source_registry


class IncrementingClock:
    def __init__(self, start: datetime) -> None:
        self._current = start

    def __call__(self) -> datetime:
        value = self._current
        self._current += timedelta(seconds=1)
        return value


@dataclass(frozen=True, slots=True)
class JsonNameAdapter:
    duplicate_candidate: bool = False

    adapter_id = "wikimedia-commons-xi-lun"
    adapter_version = "test-v1"
    source_id = "wikimedia-commons-action-api"
    parser_name = "test-json-name"
    parser_version = "test-v1"
    default_cohort = "test-xi-lun"
    default_fixture: Path | None = None

    def build_requests(
        self,
        source: ReviewedSource,
        *,
        cohort: str | None,
    ) -> tuple[AdapterRequest, ...]:
        del source, cohort
        return (
            AdapterRequest(
                request_id="profile",
                url="https://commons.wikimedia.org/w/api.php?action=query",
            ),
        )

    def parse(self, context: AdapterParseContext) -> tuple[FieldCandidate, ...]:
        payload = json.loads(context.responses["profile"].body)
        snapshot = context.evidence_snapshots["profile"]
        candidate = FieldCandidate(
            source_id=self.source_id,
            evidence_snapshot_id=snapshot.snapshot_id,
            evidence_body_sha256=snapshot.body_sha256,
            candidate_kind=CandidateKind.IDENTITY,
            subject_key="xi-lun",
            field_path="identity.names.official.en",
            source_locator=SourceLocator(
                kind=SourceLocatorKind.JSON_PATH,
                value="$.name",
            ),
            raw_value=payload["name"],
            normalized_value=payload["name"],
            identity_match=PandaIdentityMatch(
                state=IdentityMatchState.NOT_ATTEMPTED,
                source_identity="xi-lun",
            ),
            current_trusted_value=CurrentTrustedValue(present=False),
            parser_name=self.parser_name,
            parser_version=self.parser_version,
        )
        if self.duplicate_candidate:
            return candidate, candidate
        return (candidate,)


def test_smithsonian_fixture_pipeline_is_reproducible_and_exports_patch(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _redirect_local_artifacts(tmp_path, monkeypatch)
    first = run_adapter(
        AdapterRunRequest(
            source_id="smithsonian-national-zoo-panda-pages",
            adapter_id="smithsonian-panda-profiles",
            mode=AcquisitionMode.FIXTURE,
            output_bundle="smithsonian-a.json",
        ),
        adapter_registry=DEFAULT_ADAPTER_REGISTRY,
        clock=IncrementingClock(datetime(2026, 7, 22, 9, 0, tzinfo=UTC)),
    )
    second = run_adapter(
        AdapterRunRequest(
            source_id="smithsonian-national-zoo-panda-pages",
            adapter_id="smithsonian-panda-profiles",
            mode=AcquisitionMode.FIXTURE,
            output_bundle="smithsonian-b.json",
        ),
        adapter_registry=DEFAULT_ADAPTER_REGISTRY,
        clock=IncrementingClock(datetime(2026, 7, 22, 10, 0, tzinfo=UTC)),
    )

    first_bundle = load_acquisition_bundle("smithsonian-a.json")
    second_bundle = load_acquisition_bundle("smithsonian-b.json")
    assert first.request_count == second.request_count == 3
    assert len(first_bundle.evidence_snapshots) == 3
    assert len(first_bundle.candidates) == 74
    assert Counter(item.candidate_kind for item in first_bundle.candidates) == Counter(
        {
            CandidateKind.IDENTITY: 39,
            CandidateKind.EVENT: 21,
            CandidateKind.RELATIONSHIP: 9,
            CandidateKind.RESIDENCY: 5,
        }
    )
    assert Counter(item.conflict_state for item in first_bundle.candidates) == Counter(
        {
            ConflictState.UNCHANGED: 39,
            ConflictState.NOT_COMPARED: 14,
            ConflictState.NEW: 9,
            ConflictState.MISSING_CURRENT_VALUE: 8,
            ConflictState.ENRICHMENT: 4,
        }
    )
    assert {item.identity_match.matched_canonical_slug for item in first_bundle.candidates} == {
        "an-an",
        "bao-bao",
        "bao-li",
        "bei-bei",
        "hsing-hsing",
        "jia-mei",
        "ling-ling-smithsonian",
        "mei-xiang",
        "qing-bao",
        "qing-qing",
        "tai-shan",
        "tian-tian",
        "xiao-qi-ji",
    }

    assert first_bundle.bundle_id != second_bundle.bundle_id
    assert [item.snapshot_id for item in first_bundle.evidence_snapshots] == [
        item.snapshot_id for item in second_bundle.evidence_snapshots
    ]
    assert [item.candidate_id for item in first_bundle.candidates] == [
        item.candidate_id for item in second_bundle.candidates
    ]
    assert [item.deduplication_key for item in first_bundle.candidates] == [
        item.deduplication_key for item in second_bundle.candidates
    ]
    assert first_bundle.to_dict()["write_boundary"] == {
        "trusted_write_targets": [],
        "publication_write_targets": [],
    }

    candidates = [
        item
        for item in first_bundle.candidates
        if item.identity_match.matched_canonical_slug == "bao-li"
        and item.candidate_kind is CandidateKind.RESIDENCY
        and item.conflict_state is ConflictState.ENRICHMENT
    ]
    assert len(candidates) == 1
    accepted = candidates[0]
    decision_time = first_bundle.created_at + timedelta(minutes=1)
    decision_log, decision = record_decision(
        first_bundle,
        existing_log=None,
        candidate_id=accepted.candidate_id,
        action=DecisionAction.ACCEPTED,
        reviewer="integration-test-curator",
        decided_at=decision_time,
        recorded_at=decision_time + timedelta(seconds=1),
        note="Accept the source-stated Smithsonian facility enrichment.",
    )
    decision_path = write_decision_log(
        decision_log,
        "smithsonian.decisions.json",
        overwrite=False,
    )
    loaded_log = load_decision_log(decision_path)
    assert loaded_log.decision_log_id == decision_log.decision_log_id
    assert loaded_log.decisions == (decision,)

    summary = summarize_candidates(first_bundle, loaded_log)
    assert summary.candidate_count == 74
    assert summary.decision_counts == {"accepted": 1, "unreviewed": 73}

    patch = export_curation_patch(
        first_bundle,
        loaded_log,
        created_at=decision_time + timedelta(minutes=1),
    )
    patch_path = write_curation_patch(patch, "smithsonian.patch.json", overwrite=False)
    patch_payload = json.loads(patch_path.read_text(encoding="utf-8"))
    assert patch.proposal_counts() == {"residency": 1}
    assert len(patch.sources) == 1
    assert patch_payload["write_boundary"] == {
        "canonical_curation_write_targets": [],
        "trusted_write_targets": [],
        "publication_write_targets": [],
    }
    with pytest.raises(ValueError, match="cannot write curation, trusted, or public"):
        replace(
            patch,
            trusted_write_targets=("data/curation/pandas/pandas.csv",),
        )

    with pytest.raises(ValueError, match="source review expired"):
        export_curation_patch(
            first_bundle,
            loaded_log,
            created_at=datetime(2026, 10, 23, tzinfo=UTC),
        )


def test_changed_source_body_creates_new_evidence_lineage(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _redirect_local_artifacts(tmp_path, monkeypatch)
    first_fixture = tmp_path / "source-v1.json"
    second_fixture = tmp_path / "source-v2.json"
    first_fixture.write_text(
        json.dumps({"name": "Xi Lun", "source_revision": 1}),
        encoding="utf-8",
    )
    second_fixture.write_text(
        json.dumps({"name": "Xi Lun", "source_revision": 2}),
        encoding="utf-8",
    )
    adapter_registry = AdapterRegistry(adapters=(JsonNameAdapter(),))

    first = run_adapter(
        AdapterRunRequest(
            source_id="wikimedia-commons-action-api",
            adapter_id="wikimedia-commons-xi-lun",
            mode=AcquisitionMode.FIXTURE,
            fixture=first_fixture,
            output_bundle="changed-source-a.json",
        ),
        adapter_registry=adapter_registry,
        clock=IncrementingClock(datetime(2026, 7, 22, 11, 0, tzinfo=UTC)),
    )
    first_file_hash = sha256(first.output_path.read_bytes()).hexdigest()
    second = run_adapter(
        AdapterRunRequest(
            source_id="wikimedia-commons-action-api",
            adapter_id="wikimedia-commons-xi-lun",
            mode=AcquisitionMode.FIXTURE,
            fixture=second_fixture,
            output_bundle="changed-source-b.json",
        ),
        adapter_registry=adapter_registry,
        clock=IncrementingClock(datetime(2026, 7, 22, 12, 0, tzinfo=UTC)),
    )

    assert sha256(first.output_path.read_bytes()).hexdigest() == first_file_hash
    assert (
        first.bundle.candidates[0].normalized_value == second.bundle.candidates[0].normalized_value
    )
    assert (
        first.bundle.evidence_snapshots[0].snapshot_id
        != second.bundle.evidence_snapshots[0].snapshot_id
    )
    assert (
        first.bundle.evidence_snapshots[0].body_sha256
        != second.bundle.evidence_snapshots[0].body_sha256
    )
    assert first.bundle.candidates[0].candidate_id != second.bundle.candidates[0].candidate_id
    assert (
        first.bundle.candidates[0].deduplication_key
        != second.bundle.candidates[0].deduplication_key
    )
    assert first.output_path.exists() and second.output_path.exists()


def test_duplicate_candidate_fails_closed_with_evidence_retained(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _redirect_local_artifacts(tmp_path, monkeypatch)
    fixture = tmp_path / "duplicate.json"
    fixture.write_text(json.dumps({"name": "Xi Lun"}), encoding="utf-8")

    with pytest.raises(AdapterRunStopped) as caught:
        run_adapter(
            AdapterRunRequest(
                source_id="wikimedia-commons-action-api",
                adapter_id="wikimedia-commons-xi-lun",
                mode=AcquisitionMode.FIXTURE,
                fixture=fixture,
                output_bundle="duplicate-terminal.json",
            ),
            adapter_registry=AdapterRegistry(adapters=(JsonNameAdapter(duplicate_candidate=True),)),
            clock=IncrementingClock(datetime(2026, 7, 22, 13, 0, tzinfo=UTC)),
        )

    bundle = caught.value.result.bundle
    assert bundle.run.state is AcquisitionRunState.FAILED
    assert len(bundle.evidence_snapshots) == 1
    assert bundle.candidates == ()
    assert caught.value.result.output_path.exists()
    assert bundle.to_dict()["write_boundary"] == {
        "trusted_write_targets": [],
        "publication_write_targets": [],
    }


def test_ambiguous_identity_and_contradiction_are_preserved_and_refused() -> None:
    source = load_source_registry(today=date(2026, 7, 22)).get("wikimedia-commons-action-api")
    evidence = _evidence(body=b'{"subject":"test"}')

    ambiguous_raw = _candidate(
        evidence,
        subject_key="conflicting-subject",
        field_path="identity.external_identifier.zoo",
        raw_value={"system": "zoo", "value": "B-2"},
        normalized_value={"system": "zoo", "value": "B-2"},
    )
    ambiguous_snapshot = _reconciliation_snapshot(
        pandas=(
            _panda("alpha", "Alpha", stable_id="panda-alpha"),
            _panda("beta", "Beta", stable_id="panda-beta"),
        ),
        source_key_links={
            (source.source_id, "conflicting-subject"): SourceKeyLink(
                source_id=source.source_id,
                source_key="conflicting-subject",
                canonical_slug="alpha",
                basis="reviewed source key",
            )
        },
        external_identifier_index={
            ("zoo", "B-2"): ("beta",),
        },
    )
    ambiguous = reconcile_candidates(
        (ambiguous_raw,),
        source=source,
        cohort="test-cohort",
        snapshot=ambiguous_snapshot,
    ).candidates[0]
    assert ambiguous.identity_match.state is IdentityMatchState.AMBIGUOUS
    assert ambiguous.identity_match.candidate_panda_ids == ("panda-alpha", "panda-beta")
    assert ambiguous.conflict_state is ConflictState.NOT_COMPARED

    ambiguous_bundle = _bundle(source, evidence, ambiguous)
    ambiguous_log, _ = record_decision(
        ambiguous_bundle,
        existing_log=None,
        candidate_id=ambiguous.candidate_id,
        action=DecisionAction.ACCEPTED,
        reviewer="integration-test-curator",
        decided_at=ambiguous_bundle.created_at + timedelta(seconds=1),
        recorded_at=ambiguous_bundle.created_at + timedelta(seconds=2),
    )
    with pytest.raises(ValueError, match="ambiguous identity match"):
        export_curation_patch(
            ambiguous_bundle,
            ambiguous_log,
            created_at=ambiguous_bundle.created_at + timedelta(seconds=3),
        )

    contradiction_raw = _candidate(
        evidence,
        subject_key="alpha",
        field_path="identity.sex",
        raw_value="female",
        normalized_value="female",
    )
    contradiction_snapshot = _reconciliation_snapshot(
        pandas=(
            _panda(
                "alpha",
                "Alpha",
                stable_id="panda-alpha",
                gender="male",
            ),
        ),
        source_key_links={
            (source.source_id, "alpha"): SourceKeyLink(
                source_id=source.source_id,
                source_key="alpha",
                canonical_slug="alpha",
                basis="reviewed source key",
            )
        },
        field_assertion_ids={
            ("alpha", "sex"): ("fact-alpha-sex",),
        },
    )
    contradiction = reconcile_candidates(
        (contradiction_raw,),
        source=source,
        cohort="test-cohort",
        snapshot=contradiction_snapshot,
    ).candidates[0]
    assert contradiction.identity_match.state is IdentityMatchState.MATCHED
    assert contradiction.current_trusted_value == CurrentTrustedValue(
        present=True,
        value="male",
        assertion_ids=("fact-alpha-sex",),
    )
    assert contradiction.conflict_state is ConflictState.CONTRADICTION

    contradiction_bundle = _bundle(source, evidence, contradiction)
    contradiction_log, _ = record_decision(
        contradiction_bundle,
        existing_log=None,
        candidate_id=contradiction.candidate_id,
        action=DecisionAction.ACCEPTED,
        reviewer="integration-test-curator",
        decided_at=contradiction_bundle.created_at + timedelta(seconds=1),
        recorded_at=contradiction_bundle.created_at + timedelta(seconds=2),
    )
    with pytest.raises(ValueError, match="unresolved contradiction"):
        export_curation_patch(
            contradiction_bundle,
            contradiction_log,
            created_at=contradiction_bundle.created_at + timedelta(seconds=3),
        )


def test_blocked_live_source_writes_terminal_evidence_only(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _redirect_local_artifacts(tmp_path, monkeypatch)

    class FakeClient:
        def __init__(self, *args, **kwargs) -> None:
            del args, kwargs

        def __enter__(self) -> FakeClient:
            return self

        def __exit__(self, *args) -> None:
            del args

        def request(self, method: str, url: str) -> httpx.Response:
            request = httpx.Request(method, url)
            return httpx.Response(
                429,
                request=request,
                headers={
                    "content-type": "application/json",
                    "retry-after": "120",
                },
                content=b'{"error":"rate limited"}',
            )

    monkeypatch.setattr(runner_module.httpx, "Client", FakeClient)
    with pytest.raises(AdapterRunStopped) as caught:
        run_adapter(
            AdapterRunRequest(
                source_id="wikimedia-commons-action-api",
                adapter_id="wikimedia-commons-xi-lun",
                mode=AcquisitionMode.LIVE,
                output_bundle="blocked-live.json",
            ),
            adapter_registry=DEFAULT_ADAPTER_REGISTRY,
            clock=IncrementingClock(datetime(2026, 7, 22, 14, 0, tzinfo=UTC)),
            sleeper=lambda _: None,
        )

    terminal = caught.value.result.bundle
    assert terminal.run.state is AcquisitionRunState.BLOCKED
    assert terminal.candidates == ()
    assert len(terminal.evidence_snapshots) == 1
    assert terminal.evidence_snapshots[0].status == 429
    assert terminal.evidence_snapshots[0].block_state is EvidenceBlockState.RATE_LIMITED
    assert any("Retry-After=120" in note for note in terminal.run.notes)
    assert caught.value.result.output_path.exists()
    assert load_acquisition_bundle("blocked-live.json").bundle_id == terminal.bundle_id


def test_all_artifact_models_reject_write_targets() -> None:
    source = load_source_registry(today=date(2026, 7, 22)).get("wikimedia-commons-action-api")
    evidence = _evidence(body=b'{"name":"Xi Lun"}')
    candidate = replace(
        _candidate(
            evidence,
            subject_key="xi-lun",
            field_path="identity.names.official.en",
            raw_value="Xi Lun",
            normalized_value="Xi Lun",
        ),
        identity_match=PandaIdentityMatch(
            state=IdentityMatchState.MATCHED,
            source_identity="xi-lun",
            matched_canonical_slug="xi-lun",
        ),
        current_trusted_value=CurrentTrustedValue(present=True, value="Xi Lun"),
        conflict_state=ConflictState.UNCHANGED,
    )
    bundle = _bundle(source, evidence, candidate)
    with pytest.raises(ValueError, match="cannot expose trusted or publication"):
        replace(bundle, trusted_write_targets=("data/curation/pandas/pandas.csv",))

    decision_log = DecisionLog(
        acquisition_bundle_id=bundle.bundle_id,
        created_at=bundle.created_at,
        updated_at=bundle.created_at,
    )
    with pytest.raises(ValueError, match="cannot expose curation, trusted, or publication"):
        replace(
            decision_log,
            canonical_curation_write_targets=("data/curation/pandas/pandas.csv",),
        )


def _redirect_local_artifacts(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    bundle_root = tmp_path / "bundles"
    decision_root = tmp_path / "decisions"
    patch_root = tmp_path / "patches"
    monkeypatch.setattr(bundle_io, "LOCAL_BUNDLE_ROOT", bundle_root)
    monkeypatch.setattr(curation_io, "ACQUISITION_BUNDLE_ROOT", bundle_root)
    monkeypatch.setattr(curation_io, "DECISION_ROOT", decision_root)
    monkeypatch.setattr(curation_io, "PATCH_ROOT", patch_root)


def _evidence(*, body: bytes) -> EvidenceSnapshot:
    return EvidenceSnapshot.from_http_response(
        source_id="wikimedia-commons-action-api",
        requested_url="https://commons.wikimedia.org/w/api.php?action=query",
        final_url="https://commons.wikimedia.org/w/api.php?action=query",
        captured_at=datetime(2026, 7, 22, 8, 0, tzinfo=UTC),
        status=200,
        headers={"content-type": "application/json"},
        body=body,
        block_state=EvidenceBlockState.CLEAR,
        capability=AcquisitionCapability.PUBLIC_HTTP,
    )


def _candidate(
    evidence: EvidenceSnapshot,
    *,
    subject_key: str,
    field_path: str,
    raw_value,
    normalized_value,
) -> FieldCandidate:
    return FieldCandidate(
        source_id=evidence.source_id,
        evidence_snapshot_id=evidence.snapshot_id,
        evidence_body_sha256=evidence.body_sha256,
        candidate_kind=CandidateKind.IDENTITY,
        subject_key=subject_key,
        field_path=field_path,
        source_locator=SourceLocator(
            kind=SourceLocatorKind.JSON_PATH,
            value="$.value",
        ),
        raw_value=raw_value,
        normalized_value=normalized_value,
        identity_match=PandaIdentityMatch(
            state=IdentityMatchState.NOT_ATTEMPTED,
            source_identity=subject_key,
        ),
        current_trusted_value=CurrentTrustedValue(present=False),
        parser_name="integration-test-parser",
        parser_version="1.0.0",
    )


def _panda(
    slug: str,
    name: str,
    *,
    stable_id: str,
    gender: str = "unknown",
) -> CurationPanda:
    return CurationPanda(
        canonical_slug=slug,
        stable_id=stable_id,
        name_zh=None,
        name_en=name,
        gender=gender,
        birth_date=None,
        birth_date_precision="unknown",
        birth_date_text=None,
        death_date=None,
        life_status="unknown",
        birthplace=None,
        current_location=None,
        father_slug=None,
        mother_slug=None,
        primary_source_ids=(),
        evidence_status="verified",
        aliases=(),
        external_identifiers=(),
    )


def _reconciliation_snapshot(
    *,
    pandas: tuple[CurationPanda, ...],
    source_key_links: dict[tuple[str, str], SourceKeyLink],
    external_identifier_index: dict[tuple[str, str], tuple[str, ...]] | None = None,
    field_assertion_ids: dict[tuple[str, str], tuple[str, ...]] | None = None,
) -> ReconciliationSnapshot:
    return ReconciliationSnapshot(
        pandas_by_slug=MappingProxyType({item.canonical_slug: item for item in pandas}),
        events_by_panda=MappingProxyType({}),
        media_by_panda=MappingProxyType({}),
        source_urls_by_id=MappingProxyType({}),
        source_key_links=MappingProxyType(source_key_links),
        external_identifier_index=MappingProxyType(external_identifier_index or {}),
        field_assertion_ids=MappingProxyType(field_assertion_ids or {}),
        parent_assertion_ids=MappingProxyType({}),
        inputs=(),
    )


def _bundle(
    source: ReviewedSource,
    evidence: EvidenceSnapshot,
    candidate: FieldCandidate,
) -> AcquisitionBundle:
    started_at = datetime(2026, 7, 22, 8, 0, tzinfo=UTC)
    completed_at = started_at + timedelta(seconds=1)
    run = AcquisitionRun(
        run_id=f"run-integration-{candidate.subject_key}",
        source_id=source.source_id,
        adapter_id="integration-test-adapter",
        adapter_version="1.0.0",
        parser_name=candidate.parser_name,
        parser_version=candidate.parser_version,
        mode=AcquisitionMode.FIXTURE,
        state=AcquisitionRunState.COMPLETED,
        started_at=started_at,
        completed_at=completed_at,
        cohort="integration-test-cohort",
        source_reviewed_at=source.reviewed_at,
        source_review_expires_at=source.review_expires_at,
    )
    return AcquisitionBundle(
        run=run,
        evidence_snapshots=(evidence,),
        candidates=(candidate,),
        created_at=completed_at,
    )
