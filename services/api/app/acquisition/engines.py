from __future__ import annotations

from collections.abc import Callable
from importlib.metadata import version
from pathlib import Path
from time import perf_counter
from typing import Any

from scrapling.parser import Selector
from scrapy.http import HtmlResponse

from .models import CandidateRecord, EngineResult, EvidenceSnapshot, ResponseEnvelope, SourcePolicy
from .policy import classify_block, should_extract, validate_source_policy, validate_target

_FIELD_SELECTORS = {
    "panda_name_zh": '[data-field="name-zh"]::text',
    "panda_name_en": '[data-field="name-en"]::text',
    "institution_name": '[data-field="institution"]::text',
}
_ADAPTIVE_IDENTIFIER = "panda-profile-card"
_ADAPTIVE_SELECTOR = "#panda-card"


def run_scrapy_parser(
    fixture: str,
    response: ResponseEnvelope,
    policy: SourcePolicy,
) -> EngineResult:
    validate_source_policy(policy)
    validate_target(policy, response.requested_url)
    block_state = classify_block(response)
    started = perf_counter()
    parsed = HtmlResponse(
        url=response.final_url,
        status=response.status,
        headers=dict(response.headers),
        body=response.body,
        encoding="utf-8",
    )
    fields = (
        _extract_fields(lambda selector: parsed.css(selector).get())
        if should_extract(block_state)
        else None
    )
    elapsed = (perf_counter() - started) * 1000
    evidence = EvidenceSnapshot.from_response(
        engine="scrapy",
        engine_version=version("scrapy"),
        response=response,
        block_state=block_state,
        capability=policy.capability,
        selector_mode="deterministic-css",
    )
    candidate = _candidate_from_fields(fields, evidence) if fields else None
    return EngineResult(
        engine="scrapy",
        fixture=fixture,
        evidence=evidence,
        candidate=candidate,
        deterministic_match=candidate is not None,
        metrics_ms={"parse": round(elapsed, 3)},
    )


def run_scrapling_parser(
    fixture: str,
    response: ResponseEnvelope,
    policy: SourcePolicy,
    *,
    adaptive_store: Path | None = None,
    save_adaptive_reference: bool = False,
    request_adaptive_suggestion: bool = False,
) -> EngineResult:
    validate_source_policy(policy)
    validate_target(policy, response.requested_url)
    block_state = classify_block(response)
    storage_args = None
    adaptive = adaptive_store is not None
    if adaptive_store is not None:
        adaptive_store.parent.mkdir(parents=True, exist_ok=True)
        storage_args = {"storage_file": str(adaptive_store), "url": response.final_url}

    started = perf_counter()
    parsed = Selector(
        content=response.body,
        url=response.final_url,
        adaptive=adaptive,
        storage_args=storage_args,
    )
    fields = (
        _extract_fields(lambda selector: parsed.css(selector).get())
        if should_extract(block_state)
        else None
    )
    deterministic_elapsed = (perf_counter() - started) * 1000

    suggestion: dict[str, Any] | None = None
    adaptive_elapsed = 0.0
    if adaptive and should_extract(block_state):
        if save_adaptive_reference:
            parsed.css(
                _ADAPTIVE_SELECTOR,
                auto_save=True,
                identifier=_ADAPTIVE_IDENTIFIER,
            )
        if request_adaptive_suggestion and not fields:
            adaptive_started = perf_counter()
            high_confidence = parsed.css(
                _ADAPTIVE_SELECTOR,
                adaptive=True,
                identifier=_ADAPTIVE_IDENTIFIER,
                percentage=70,
            )
            matches = high_confidence
            confidence_band = "high"
            threshold = 70
            if not matches:
                matches = parsed.css(
                    _ADAPTIVE_SELECTOR,
                    adaptive=True,
                    identifier=_ADAPTIVE_IDENTIFIER,
                    percentage=25,
                )
                confidence_band = "low"
                threshold = 25
            adaptive_elapsed = (perf_counter() - adaptive_started) * 1000
            first = matches.first
            if first is not None:
                suggestion = {
                    "identifier": _ADAPTIVE_IDENTIFIER,
                    "generated_selector": first.generate_css_selector,
                    "text": " ".join(str(first.text).split()),
                    "confidence_band": confidence_band,
                    "accepted_threshold": threshold,
                    "high_confidence_threshold": 70,
                    "evidence_only": True,
                    "trusted_field_population": False,
                }

    evidence = EvidenceSnapshot.from_response(
        engine="scrapling",
        engine_version=version("scrapling"),
        response=response,
        block_state=block_state,
        capability=policy.capability,
        selector_mode="deterministic-css-with-evidence-only-adaptive-suggestion"
        if adaptive
        else "deterministic-css",
        notes=("Adaptive matches never populate candidate fields.",) if adaptive else (),
    )
    candidate = _candidate_from_fields(fields, evidence) if fields else None
    return EngineResult(
        engine="scrapling",
        fixture=fixture,
        evidence=evidence,
        candidate=candidate,
        deterministic_match=candidate is not None,
        adaptive_suggestion=suggestion,
        metrics_ms={
            "parse": round(deterministic_elapsed, 3),
            "adaptive_suggestion": round(adaptive_elapsed, 3),
        },
    )


def _extract_fields(select: Callable[[str], Any]) -> dict[str, str] | None:
    fields: dict[str, str] = {}
    for field, selector in _FIELD_SELECTORS.items():
        value = select(selector)
        normalized = " ".join(str(value).split()) if value is not None else ""
        if not normalized:
            return None
        fields[field] = normalized
    return fields


def _candidate_from_fields(
    fields: dict[str, str],
    evidence: EvidenceSnapshot,
) -> CandidateRecord:
    return CandidateRecord(
        source_url=evidence.final_url,
        evidence_sha256=evidence.body_sha256,
        panda_name_zh=fields["panda_name_zh"],
        panda_name_en=fields["panda_name_en"],
        institution_name=fields["institution_name"],
        engine=evidence.engine,
    )
