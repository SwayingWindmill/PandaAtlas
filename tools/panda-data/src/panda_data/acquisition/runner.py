from __future__ import annotations

import json
import mimetypes
import time
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from types import MappingProxyType
from typing import Protocol
from urllib.parse import urljoin, urlparse
from uuid import uuid4

import httpx

from .bundles import write_local_bundle
from .contracts import (
    AcquisitionBundle,
    AcquisitionCapability,
    AcquisitionMode,
    AcquisitionRun,
    AcquisitionRunState,
    EvidenceBlockState,
    EvidenceSnapshot,
    FieldCandidate,
)
from .curl_transport import fetch_curl_response
from .models import ResponseEnvelope
from .reconciliation import reconcile_candidates
from .source_registry import (
    AuthenticationMode,
    RedirectPolicy,
    ReviewedSource,
    SourceRegistry,
    load_source_registry,
    validate_source_registry,
)

_CHALLENGE_MARKERS = (
    b"captcha",
    b"cf-chl-",
    b"cloudflare ray id",
    b"verify you are human",
    b"security challenge",
)
_REDIRECT_STATUSES = frozenset({301, 302, 303, 307, 308})


@dataclass(frozen=True, slots=True)
class AdapterRequest:
    request_id: str
    url: str
    method: str = "GET"

    def __post_init__(self) -> None:
        if not self.request_id.strip():
            raise ValueError("adapter request ID cannot be empty")
        if self.method.upper() != "GET":
            raise ValueError("reviewed acquisition adapters currently support GET only")
        object.__setattr__(self, "method", "GET")


@dataclass(frozen=True, slots=True)
class AdapterParseContext:
    source: ReviewedSource
    cohort: str | None
    mode: AcquisitionMode
    responses: Mapping[str, ResponseEnvelope]
    evidence_snapshots: Mapping[str, EvidenceSnapshot]


class AcquisitionAdapter(Protocol):
    adapter_id: str
    adapter_version: str
    source_id: str
    parser_name: str
    parser_version: str
    default_cohort: str | None
    default_fixture: Path | None

    def build_requests(
        self,
        source: ReviewedSource,
        *,
        cohort: str | None,
    ) -> tuple[AdapterRequest, ...]: ...

    def parse(self, context: AdapterParseContext) -> tuple[FieldCandidate, ...]: ...


@dataclass(frozen=True, slots=True)
class AdapterRegistry:
    adapters: tuple[AcquisitionAdapter, ...]

    def __post_init__(self) -> None:
        adapter_ids = [adapter.adapter_id for adapter in self.adapters]
        if len(adapter_ids) != len(set(adapter_ids)):
            raise ValueError("adapter registry contains duplicate adapter IDs")
        for adapter in self.adapters:
            for label, value in (
                ("adapter_id", adapter.adapter_id),
                ("adapter_version", adapter.adapter_version),
                ("source_id", adapter.source_id),
                ("parser_name", adapter.parser_name),
                ("parser_version", adapter.parser_version),
            ):
                if not value.strip():
                    raise ValueError(f"adapter {label} cannot be empty")

    def get(self, adapter_id: str) -> AcquisitionAdapter:
        matches = [adapter for adapter in self.adapters if adapter.adapter_id == adapter_id]
        if len(matches) != 1:
            raise KeyError(f"acquisition adapter {adapter_id!r} was not found exactly once")
        return matches[0]


@dataclass(frozen=True, slots=True)
class AdapterRunRequest:
    source_id: str
    adapter_id: str
    mode: AcquisitionMode
    cohort: str | None = None
    fixture: Path | None = None
    output_bundle: str | Path | None = None
    overwrite: bool = False

    def __post_init__(self) -> None:
        if not self.source_id.strip():
            raise ValueError("source_id cannot be empty")
        if not self.adapter_id.strip():
            raise ValueError("adapter_id cannot be empty")
        if self.cohort is not None and not self.cohort.strip():
            raise ValueError("cohort cannot be blank")
        if self.mode is AcquisitionMode.LIVE and self.fixture is not None:
            raise ValueError("live acquisition runs cannot accept a fixture")


@dataclass(frozen=True, slots=True)
class AdapterRunResult:
    bundle: AcquisitionBundle
    output_path: Path
    request_count: int


class AdapterRunStopped(RuntimeError):
    def __init__(self, message: str, *, result: AdapterRunResult) -> None:
        super().__init__(message)
        self.result = result


class _ReviewedRequestStopped(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        response: ResponseEnvelope,
        block_state: EvidenceBlockState,
        run_state: AcquisitionRunState = AcquisitionRunState.BLOCKED,
    ) -> None:
        super().__init__(message)
        self.response = response
        self.block_state = block_state
        self.run_state = run_state
        self.completed_responses: dict[str, ResponseEnvelope] = {}


class _ReviewedBatchFailed(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        completed_responses: Mapping[str, ResponseEnvelope],
    ) -> None:
        super().__init__(message)
        self.completed_responses = dict(completed_responses)


def run_adapter(
    request: AdapterRunRequest,
    *,
    adapter_registry: AdapterRegistry,
    source_registry: SourceRegistry | None = None,
    clock: Callable[[], datetime] | None = None,
    sleeper: Callable[[float], None] = time.sleep,
) -> AdapterRunResult:
    now = clock or _utc_now
    started_at = _require_aware(now())
    if source_registry is None:
        registry = load_source_registry(today=started_at.date())
    else:
        validate_source_registry(source_registry, today=started_at.date())
        registry = source_registry
    source = registry.get(request.source_id)
    adapter = adapter_registry.get(request.adapter_id)
    source.assert_adapter_allowed(adapter.adapter_id)
    if adapter.source_id != source.source_id:
        raise ValueError(
            f"adapter {adapter.adapter_id} belongs to {adapter.source_id}, not {source.source_id}"
        )
    if request.mode is AcquisitionMode.LIVE:
        source.assert_live_fetch_allowed()

    cohort = request.cohort if request.cohort is not None else adapter.default_cohort
    run_id = _build_run_id(source.source_id, adapter.adapter_id, started_at)
    planned_requests = adapter.build_requests(source, cohort=cohort)
    _validate_planned_requests(source, planned_requests, live=request.mode is AcquisitionMode.LIVE)

    responses: dict[str, ResponseEnvelope] = {}
    evidence_by_request: dict[str, EvidenceSnapshot] = {}
    try:
        if request.mode is AcquisitionMode.FIXTURE:
            fixture = request.fixture or adapter.default_fixture
            if fixture is None:
                raise ValueError(f"adapter {adapter.adapter_id} has no default fixture")
            responses = _load_fixture_responses(planned_requests, fixture.resolve())
        elif request.mode is AcquisitionMode.LIVE:
            responses = _fetch_live_responses(
                source,
                planned_requests,
                sleeper=sleeper,
            )
        else:
            raise ValueError(f"runner does not execute acquisition mode {request.mode.value}")

        _validate_response_targets(
            source,
            planned_requests,
            responses,
            live=request.mode is AcquisitionMode.LIVE,
        )
        evidence_by_request = _build_evidence_snapshots(
            source,
            planned_requests,
            responses,
            captured_at=_require_aware(now()),
        )
        context = AdapterParseContext(
            source=source,
            cohort=cohort,
            mode=request.mode,
            responses=MappingProxyType(dict(responses)),
            evidence_snapshots=MappingProxyType(dict(evidence_by_request)),
        )
        parsed_candidates = adapter.parse(context)
        reconciliation = reconcile_candidates(
            parsed_candidates,
            source=source,
            cohort=cohort,
        )
        candidates = reconciliation.candidates
        completed_at = _require_aware(now())
        bundle = _build_bundle(
            source=source,
            registry=registry,
            adapter=adapter,
            mode=request.mode,
            state=AcquisitionRunState.COMPLETED,
            run_id=run_id,
            cohort=cohort,
            started_at=started_at,
            completed_at=completed_at,
            evidence=tuple(evidence_by_request[item.request_id] for item in planned_requests),
            candidates=candidates,
            run_notes=reconciliation.summary.run_notes(),
        )
    except _ReviewedRequestStopped as error:
        responses.update(error.completed_responses)
        if error.completed_responses:
            evidence_by_request = _build_evidence_snapshots(
                source,
                planned_requests,
                error.completed_responses,
                captured_at=_require_aware(now()),
            )
        matching_request = next(
            item for item in planned_requests if item.url == error.response.requested_url
        )
        responses[matching_request.request_id] = error.response
        evidence_by_request[matching_request.request_id] = _evidence_from_response(
            source,
            error.response,
            captured_at=_require_aware(now()),
            block_state=error.block_state,
        )
        result = _write_terminal_bundle(
            request=request,
            source=source,
            registry=registry,
            adapter=adapter,
            mode=request.mode,
            state=error.run_state,
            run_id=run_id,
            cohort=cohort,
            started_at=started_at,
            completed_at=_require_aware(now()),
            evidence=tuple(evidence_by_request.values()),
            message=str(error),
        )
        raise AdapterRunStopped(str(error), result=result) from error
    except _ReviewedBatchFailed as error:
        evidence_by_request = _build_evidence_snapshots(
            source,
            planned_requests,
            error.completed_responses,
            captured_at=_require_aware(now()),
        )
        result = _write_terminal_bundle(
            request=request,
            source=source,
            registry=registry,
            adapter=adapter,
            mode=request.mode,
            state=AcquisitionRunState.FAILED,
            run_id=run_id,
            cohort=cohort,
            started_at=started_at,
            completed_at=_require_aware(now()),
            evidence=tuple(evidence_by_request.values()),
            message=str(error),
        )
        raise AdapterRunStopped(str(error), result=result) from error
    except Exception as error:
        if responses and not evidence_by_request:
            evidence_by_request = _build_evidence_snapshots(
                source,
                planned_requests,
                responses,
                captured_at=_require_aware(now()),
            )
        result = _write_terminal_bundle(
            request=request,
            source=source,
            registry=registry,
            adapter=adapter,
            mode=request.mode,
            state=AcquisitionRunState.FAILED,
            run_id=run_id,
            cohort=cohort,
            started_at=started_at,
            completed_at=_require_aware(now()),
            evidence=tuple(evidence_by_request.values()),
            message=str(error),
        )
        raise AdapterRunStopped(str(error), result=result) from error

    output_path = write_local_bundle(
        bundle,
        request.output_bundle,
        overwrite=request.overwrite,
    )
    return AdapterRunResult(
        bundle=bundle,
        output_path=output_path,
        request_count=len(planned_requests),
    )


def _validate_planned_requests(
    source: ReviewedSource,
    requests: Sequence[AdapterRequest],
    *,
    live: bool,
) -> None:
    if not requests:
        raise ValueError("acquisition adapter must plan at least one request")
    request_ids = [request.request_id for request in requests]
    if len(request_ids) != len(set(request_ids)):
        raise ValueError("acquisition adapter planned duplicate request IDs")
    urls = [request.url for request in requests]
    if len(urls) != len(set(urls)):
        raise ValueError("acquisition adapter planned duplicate request URLs")
    for request in requests:
        source.validate_request_target(request.url, live=live)
        policy = source.request_policy
        if live and policy is not None and request.method not in policy.allowed_methods:
            raise ValueError("adapter request method is outside the reviewed request policy")


def _validate_response_targets(
    source: ReviewedSource,
    requests: Sequence[AdapterRequest],
    responses: Mapping[str, ResponseEnvelope],
    *,
    live: bool,
) -> None:
    request_by_id = {request.request_id: request for request in requests}
    if set(responses) != set(request_by_id):
        raise ValueError("acquisition responses do not match the planned request IDs")
    for request_id, response in responses.items():
        planned = request_by_id[request_id]
        if response.requested_url != planned.url:
            raise ValueError("acquisition response requested URL drifted from its plan")
        source.validate_request_target(response.final_url, live=live)


def _load_fixture_responses(
    requests: Sequence[AdapterRequest],
    fixture: Path,
) -> dict[str, ResponseEnvelope]:
    if not fixture.is_file():
        raise FileNotFoundError(f"acquisition fixture not found: {fixture}")
    if len(requests) == 1:
        request = requests[0]
        content_type = mimetypes.guess_type(fixture.name)[0] or "application/octet-stream"
        return {
            request.request_id: ResponseEnvelope(
                requested_url=request.url,
                final_url=request.url,
                status=200,
                headers={
                    "content-type": content_type,
                    "x-panda-atlas-fixture": fixture.name,
                },
                body=fixture.read_bytes(),
            )
        }

    raw = json.loads(fixture.read_text(encoding="utf-8"))
    if raw.get("schema_version") != "panda-atlas-acquisition-fixtures/v1":
        raise ValueError("multi-request fixture must use the acquisition fixture manifest v1")
    entries = raw.get("responses")
    if not isinstance(entries, list):
        raise ValueError("acquisition fixture manifest responses must be a list")
    request_by_id = {request.request_id: request for request in requests}
    responses: dict[str, ResponseEnvelope] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            raise ValueError("acquisition fixture manifest contains a non-object response")
        request_id = str(entry.get("request_id") or "")
        planned = request_by_id.get(request_id)
        if planned is None:
            raise ValueError(f"fixture manifest references unknown request {request_id!r}")
        body_path = (fixture.parent / str(entry.get("body_path") or "")).resolve()
        try:
            body_path.relative_to(fixture.parent.resolve())
        except ValueError as error:
            raise ValueError("fixture manifest body path escapes its directory") from error
        if not body_path.is_file():
            raise FileNotFoundError(f"fixture manifest body is missing: {body_path}")
        headers_raw = entry.get("headers") or {}
        if not isinstance(headers_raw, dict):
            raise ValueError("fixture response headers must be an object")
        responses[request_id] = ResponseEnvelope(
            requested_url=planned.url,
            final_url=str(entry.get("final_url") or planned.url),
            status=int(entry.get("status", 200)),
            headers={str(key): str(value) for key, value in headers_raw.items()},
            body=body_path.read_bytes(),
        )
    if set(responses) != set(request_by_id):
        missing = sorted(set(request_by_id) - set(responses))
        raise ValueError(f"fixture manifest omitted planned requests: {missing}")
    return responses


def _fetch_live_responses(
    source: ReviewedSource,
    requests: Sequence[AdapterRequest],
    *,
    sleeper: Callable[[float], None],
) -> dict[str, ResponseEnvelope]:
    source.assert_live_fetch_allowed()
    policy = source.request_policy
    assert policy is not None
    if policy.authentication is not AuthenticationMode.NONE:
        raise ValueError("generic runner does not execute reviewed-session authentication")
    if policy.send_cookies:
        raise ValueError("generic runner does not send source cookies")
    if source.concurrency_per_host != 1:
        raise ValueError("generic runner requires reviewed per-host concurrency of one")

    if source.source_id == "chengdu-panda-base-international-cooperation":
        return _fetch_live_responses_with_fetcher(
            source,
            requests,
            fetch_response=lambda request, current_url: fetch_curl_response(
                source,
                request,
                current_url,
            ),
            sleeper=sleeper,
        )

    with httpx.Client(
        headers={"User-Agent": policy.user_agent, "Accept": policy.accept},
        timeout=policy.timeout_seconds,
        follow_redirects=False,
        cookies=None,
    ) as client:
        return _fetch_live_responses_with_fetcher(
            source,
            requests,
            fetch_response=lambda request, current_url: _httpx_response_envelope(
                request,
                current_url,
                client,
            ),
            sleeper=sleeper,
        )


def _fetch_live_responses_with_fetcher(
    source: ReviewedSource,
    requests: Sequence[AdapterRequest],
    *,
    fetch_response: Callable[[AdapterRequest, str], ResponseEnvelope],
    sleeper: Callable[[float], None],
) -> dict[str, ResponseEnvelope]:
    responses: dict[str, ResponseEnvelope] = {}
    interval_seconds = _reviewed_request_interval_seconds(source)
    for index, request in enumerate(requests):
        if index:
            sleeper(interval_seconds)
        try:
            responses[request.request_id] = _fetch_one(
                source,
                request,
                fetch_response=fetch_response,
                sleeper=sleeper,
            )
        except _ReviewedRequestStopped as error:
            error.completed_responses.update(responses)
            raise
        except Exception as error:
            raise _ReviewedBatchFailed(
                str(error),
                completed_responses=responses,
            ) from error
    return responses


def _reviewed_request_interval_seconds(source: ReviewedSource) -> float:
    reviewed_interval = 60 / source.max_requests_per_minute
    if source.source_id == "chengdu-panda-base-international-cooperation":
        return max(reviewed_interval, 90.0)
    return reviewed_interval


def _httpx_response_envelope(
    request: AdapterRequest,
    current_url: str,
    client: httpx.Client,
) -> ResponseEnvelope:
    response = client.request(request.method, current_url)
    return ResponseEnvelope(
        requested_url=request.url,
        final_url=str(response.url),
        status=response.status_code,
        headers=dict(response.headers),
        body=response.content,
    )


def _fetch_one(
    source: ReviewedSource,
    request: AdapterRequest,
    *,
    fetch_response: Callable[[AdapterRequest, str], ResponseEnvelope],
    sleeper: Callable[[float], None],
) -> ResponseEnvelope:
    policy = source.request_policy
    assert policy is not None
    attempt = 1
    while True:
        current_url = request.url
        redirects = 0
        while True:
            envelope = fetch_response(request, current_url)
            if envelope.status not in _REDIRECT_STATUSES:
                break
            location = _header(envelope.headers, "location")
            if policy.redirect_policy is RedirectPolicy.DENY:
                raise _ReviewedRequestStopped(
                    "reviewed source returned a redirect but redirects are denied",
                    response=envelope,
                    block_state=EvidenceBlockState.BLOCKED,
                )
            if not location or redirects >= policy.max_redirects:
                raise _ReviewedRequestStopped(
                    "reviewed source exceeded its redirect policy",
                    response=envelope,
                    block_state=EvidenceBlockState.BLOCKED,
                )
            redirected_url = urljoin(current_url, location)
            if urlparse(redirected_url).hostname != urlparse(request.url).hostname:
                raise _ReviewedRequestStopped(
                    "reviewed source attempted a cross-host redirect",
                    response=envelope,
                    block_state=EvidenceBlockState.BLOCKED,
                )
            source.validate_request_target(redirected_url, live=True)
            current_url = redirected_url
            redirects += 1

        if policy.stop_on_challenge and _looks_like_challenge(envelope):
            raise _ReviewedRequestStopped(
                "reviewed source returned a human or anti-bot challenge",
                response=envelope,
                block_state=EvidenceBlockState.HUMAN_CHALLENGE_REQUIRED,
            )
        if envelope.status in policy.stop_statuses:
            message = f"reviewed source returned stop status HTTP {envelope.status}"
            retry_after = _header(envelope.headers, "retry-after")
            if envelope.status == 429 and policy.honor_retry_after and retry_after:
                message = f"{message}; Retry-After={retry_after}"
            raise _ReviewedRequestStopped(
                message,
                response=envelope,
                block_state=_block_state_for_status(envelope.status),
            )
        if 500 <= envelope.status <= 599 and policy.retry_server_errors:
            if attempt < policy.max_attempts:
                sleeper(policy.retry_backoff_seconds)
                attempt += 1
                continue
        if envelope.status != 200:
            raise _ReviewedRequestStopped(
                f"reviewed source returned unexpected HTTP {envelope.status}",
                response=envelope,
                block_state=EvidenceBlockState.BLOCKED,
                run_state=AcquisitionRunState.FAILED,
            )
        return envelope


def _build_evidence_snapshots(
    source: ReviewedSource,
    requests: Sequence[AdapterRequest],
    responses: Mapping[str, ResponseEnvelope],
    *,
    captured_at: datetime,
) -> dict[str, EvidenceSnapshot]:
    evidence: dict[str, EvidenceSnapshot] = {}
    for request in requests:
        response = responses.get(request.request_id)
        if response is None:
            continue
        evidence[request.request_id] = _evidence_from_response(
            source,
            response,
            captured_at=captured_at,
            block_state=EvidenceBlockState.CLEAR,
        )
    return evidence


def _evidence_from_response(
    source: ReviewedSource,
    response: ResponseEnvelope,
    *,
    captured_at: datetime,
    block_state: EvidenceBlockState,
) -> EvidenceSnapshot:
    return EvidenceSnapshot.from_http_response(
        source_id=source.source_id,
        requested_url=response.requested_url,
        final_url=response.final_url,
        captured_at=captured_at,
        status=response.status,
        headers=response.headers,
        body=response.body,
        block_state=block_state,
        capability=_capability(source.capability),
        notes=("Response retained as review evidence; no trusted or public write occurred.",),
    )


def _build_bundle(
    *,
    source: ReviewedSource,
    registry: SourceRegistry,
    adapter: AcquisitionAdapter,
    mode: AcquisitionMode,
    state: AcquisitionRunState,
    run_id: str,
    cohort: str | None,
    started_at: datetime,
    completed_at: datetime,
    evidence: tuple[EvidenceSnapshot, ...],
    candidates: tuple[FieldCandidate, ...],
    failure_message: str | None = None,
    run_notes: tuple[str, ...] = (),
) -> AcquisitionBundle:
    notes = [
        f"source_registry_review={registry.review_document}",
        f"source_registry_review_sha256={registry.review_document_sha256}",
        f"source_policy={json.dumps(source.to_public_dict(), ensure_ascii=False, sort_keys=True)}",
    ]
    if failure_message:
        notes.append(f"terminal_message={failure_message}")
    notes.extend(run_notes)
    run = AcquisitionRun(
        run_id=run_id,
        source_id=source.source_id,
        adapter_id=adapter.adapter_id,
        adapter_version=adapter.adapter_version,
        parser_name=adapter.parser_name,
        parser_version=adapter.parser_version,
        mode=mode,
        state=state,
        started_at=started_at,
        completed_at=completed_at,
        cohort=cohort,
        source_reviewed_at=source.reviewed_at,
        source_review_expires_at=source.review_expires_at,
        notes=tuple(notes),
    )
    return AcquisitionBundle(
        run=run,
        evidence_snapshots=evidence,
        candidates=candidates,
        created_at=completed_at,
    )


def _write_terminal_bundle(
    *,
    request: AdapterRunRequest,
    source: ReviewedSource,
    registry: SourceRegistry,
    adapter: AcquisitionAdapter,
    mode: AcquisitionMode,
    state: AcquisitionRunState,
    run_id: str,
    cohort: str | None,
    started_at: datetime,
    completed_at: datetime,
    evidence: tuple[EvidenceSnapshot, ...],
    message: str,
) -> AdapterRunResult:
    bundle = _build_bundle(
        source=source,
        registry=registry,
        adapter=adapter,
        mode=mode,
        state=state,
        run_id=run_id,
        cohort=cohort,
        started_at=started_at,
        completed_at=completed_at,
        evidence=evidence,
        candidates=(),
        failure_message=message,
    )
    output_path = write_local_bundle(
        bundle,
        request.output_bundle,
        overwrite=request.overwrite,
    )
    return AdapterRunResult(
        bundle=bundle,
        output_path=output_path,
        request_count=len(evidence),
    )


def _block_state_for_status(status: int) -> EvidenceBlockState:
    if status == 429:
        return EvidenceBlockState.RATE_LIMITED
    if status in {401, 403, 407}:
        return EvidenceBlockState.AUTHORIZATION_REQUIRED
    return EvidenceBlockState.BLOCKED


def _header(headers: Mapping[str, str], name: str) -> str:
    for key, value in headers.items():
        if str(key).lower() == name.lower():
            return str(value).strip()
    return ""


def _looks_like_challenge(response: ResponseEnvelope) -> bool:
    content_type = next(
        (
            str(value).lower()
            for key, value in response.headers.items()
            if str(key).lower() == "content-type"
        ),
        "",
    )
    if "html" not in content_type:
        return False
    body = response.body[:200_000].lower()
    return any(marker in body for marker in _CHALLENGE_MARKERS)


def _capability(value: str) -> AcquisitionCapability:
    try:
        return AcquisitionCapability(value)
    except ValueError as error:
        raise ValueError(
            f"reviewed source capability {value!r} is not supported by bundle v1"
        ) from error


def _build_run_id(source_id: str, adapter_id: str, started_at: datetime) -> str:
    timestamp = started_at.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")
    source = _slug_fragment(source_id)
    adapter = _slug_fragment(adapter_id)
    return f"run-{source}-{adapter}-{timestamp}-{uuid4().hex[:12]}"


def _slug_fragment(value: str) -> str:
    return "".join(character if character.isalnum() else "-" for character in value).strip("-")


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _require_aware(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("acquisition runner clock must return timezone-aware datetimes")
    return value
