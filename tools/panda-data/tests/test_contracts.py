from __future__ import annotations

import json
from pathlib import Path
from uuid import UUID

import pytest

from panda_data.contracts import ContractError, check_contracts, validate_contract
from panda_data.pipeline import PipelineJob, build_artifact_manifest

FIXTURES = Path(__file__).resolve().parents[3] / "contracts" / "panda-data" / "fixtures"


def test_canonical_draft_2020_12_contracts_and_fixtures_validate() -> None:
    assert check_contracts() == ("artifact-manifest", "pipeline-job", "pipeline-result")
    validate_contract(
        "artifact-manifest",
        json.loads((FIXTURES / "artifact-manifest.valid.json").read_text()),
    )
    validate_contract(
        "pipeline-job",
        json.loads((FIXTURES / "pipeline-job.valid.json").read_text()),
    )
    validate_contract(
        "pipeline-result",
        json.loads((FIXTURES / "pipeline-result.valid.json").read_text()),
    )


def test_contract_rejects_unexpected_wire_fields() -> None:
    payload = json.loads((FIXTURES / "pipeline-job.valid.json").read_text())
    payload["unexpected"] = True
    with pytest.raises(ContractError, match="unexpected"):
        validate_contract("pipeline-job", payload)


def test_pipeline_models_validate_against_external_schema() -> None:
    job = PipelineJob(jobType="identity.resolve", parameters={"batch": "fixture"})
    wire = job.validated_wire()
    assert wire["schemaVersion"] == "panda-data.pipeline-job/v1"
    assert wire["jobType"] == "identity.resolve"


def test_artifact_manifest_is_content_addressed_and_schema_valid(tmp_path: Path) -> None:
    artifact = tmp_path / "result.json"
    artifact.write_text('{"ok":true}\n', encoding="utf-8")
    manifest = build_artifact_manifest(
        artifact,
        bucket="panda-data-artifacts",
        artifact_kind="identity.result",
        job_id=UUID("11111111-1111-4111-8111-111111111111"),
    )
    wire = manifest.validated_wire()
    assert manifest.sha256 in manifest.storage.object_key
    assert wire["storage"]["provider"] == "r2"
