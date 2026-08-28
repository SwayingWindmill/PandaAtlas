from __future__ import annotations

import hashlib
import mimetypes
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, model_validator

from panda_data.contracts import validate_contract


class WireModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, populate_by_name=True)

    def to_wire(self) -> dict[str, Any]:
        return self.model_dump(by_alias=True, mode="json")


class ArtifactReference(WireModel):
    artifact_id: UUID = Field(alias="artifactId")
    artifact_kind: str = Field(alias="artifactKind", pattern=r"^[a-z][a-z0-9_.-]{1,127}$")
    bucket: str = Field(min_length=1, max_length=255)
    object_key: str = Field(alias="objectKey", min_length=1, max_length=1024)
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")


class ArtifactStorage(WireModel):
    provider: Literal["r2"] = "r2"
    bucket: str = Field(min_length=1, max_length=255)
    object_key: str = Field(alias="objectKey", min_length=1, max_length=1024)


class ArtifactContract(WireModel):
    schema_id: str = Field(alias="schemaId", min_length=1)


class ArtifactManifest(WireModel):
    schema_version: Literal["panda-data.artifact-manifest/v1"] = Field(
        default="panda-data.artifact-manifest/v1", alias="schemaVersion"
    )
    artifact_id: UUID = Field(default_factory=uuid4, alias="artifactId")
    artifact_kind: str = Field(alias="artifactKind", pattern=r"^[a-z][a-z0-9_.-]{1,127}$")
    storage: ArtifactStorage
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    byte_size: int = Field(alias="byteSize", ge=0)
    media_type: str = Field(alias="mediaType", min_length=1, max_length=255)
    contract: ArtifactContract | None = None
    produced_by_job_id: UUID = Field(alias="producedByJobId")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), alias="createdAt")
    metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def require_content_addressed_key(self) -> ArtifactManifest:
        if self.sha256 not in self.storage.object_key:
            raise ValueError("immutable R2 objectKey must contain the artifact sha256")
        return self

    def reference(self) -> ArtifactReference:
        return ArtifactReference(
            artifactId=self.artifact_id,
            artifactKind=self.artifact_kind,
            bucket=self.storage.bucket,
            objectKey=self.storage.object_key,
            sha256=self.sha256,
        )

    def validated_wire(self) -> dict[str, Any]:
        payload = self.to_wire()
        validate_contract("artifact-manifest", payload)
        return payload


class PipelineJob(WireModel):
    schema_version: Literal["panda-data.pipeline-job/v1"] = Field(
        default="panda-data.pipeline-job/v1", alias="schemaVersion"
    )
    job_id: UUID = Field(default_factory=uuid4, alias="jobId")
    job_type: str = Field(alias="jobType", pattern=r"^[a-z][a-z0-9_.-]{1,127}$")
    correlation_id: UUID = Field(default_factory=uuid4, alias="correlationId")
    requested_at: datetime = Field(default_factory=lambda: datetime.now(UTC), alias="requestedAt")
    parameters: dict[str, Any] = Field(default_factory=dict)
    input_artifacts: tuple[ArtifactReference, ...] = Field(default=(), alias="inputArtifacts")

    def validated_wire(self) -> dict[str, Any]:
        payload = self.to_wire()
        validate_contract("pipeline-job", payload)
        return payload


class PipelineError(WireModel):
    code: str = Field(pattern=r"^[a-z][a-z0-9_.-]{1,127}$")
    message: str = Field(min_length=1, max_length=2000)


class PipelineResult(WireModel):
    schema_version: Literal["panda-data.pipeline-result/v1"] = Field(
        default="panda-data.pipeline-result/v1", alias="schemaVersion"
    )
    job_id: UUID = Field(alias="jobId")
    correlation_id: UUID = Field(alias="correlationId")
    state: Literal["completed", "failed"]
    completed_at: datetime = Field(default_factory=lambda: datetime.now(UTC), alias="completedAt")
    artifacts: tuple[ArtifactReference, ...] = ()
    error: PipelineError | None = None

    @model_validator(mode="after")
    def match_error_to_state(self) -> PipelineResult:
        if self.state == "failed" and self.error is None:
            raise ValueError("failed pipeline results require error")
        if self.state == "completed" and self.error is not None:
            raise ValueError("completed pipeline results cannot carry error")
        return self

    def validated_wire(self) -> dict[str, Any]:
        payload = self.to_wire()
        validate_contract("pipeline-result", payload)
        return payload


def sha256_file(path: Path, *, chunk_size: int = 1024 * 1024) -> tuple[str, int]:
    digest = hashlib.sha256()
    byte_size = 0
    with path.open("rb") as handle:
        while chunk := handle.read(chunk_size):
            digest.update(chunk)
            byte_size += len(chunk)
    return digest.hexdigest(), byte_size


def content_addressed_object_key(
    *, artifact_kind: str, sha256: str, filename: str, prefix: str = "panda-data"
) -> str:
    safe_filename = Path(filename).name
    return f"{prefix.strip('/')}/{artifact_kind}/{sha256[:2]}/{sha256}/{safe_filename}"


def build_artifact_manifest(
    path: Path,
    *,
    bucket: str,
    artifact_kind: str,
    job_id: UUID,
    prefix: str = "panda-data",
    media_type: str | None = None,
    contract_schema_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> ArtifactManifest:
    resolved = path.resolve(strict=True)
    sha256, byte_size = sha256_file(resolved)
    object_key = content_addressed_object_key(
        artifact_kind=artifact_kind,
        sha256=sha256,
        filename=resolved.name,
        prefix=prefix,
    )
    guessed_media_type, _ = mimetypes.guess_type(resolved.name)
    manifest = ArtifactManifest(
        artifactKind=artifact_kind,
        storage=ArtifactStorage(bucket=bucket, objectKey=object_key),
        sha256=sha256,
        byteSize=byte_size,
        mediaType=media_type or guessed_media_type or "application/octet-stream",
        contract=(ArtifactContract(schemaId=contract_schema_id) if contract_schema_id else None),
        producedByJobId=job_id,
        metadata=metadata or {},
    )
    manifest.validated_wire()
    return manifest
