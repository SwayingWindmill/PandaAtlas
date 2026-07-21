from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .capabilities import (
    build_fetch_plan,
    scrapling_capability_profile,
    scrapy_capability_profile,
)
from .engines import run_scrapling_parser, run_scrapy_parser
from .lab import run_scrapling_browser_lab
from .models import CapabilityMode, ResponseEnvelope, SourcePolicy

_API_ROOT = Path(__file__).resolve().parents[2]
_FIXTURE_ROOT = _API_ROOT / "tests" / "acquisition" / "fixtures"
_SOURCE_URL = "https://source.example/pandas/bi-li"


def build_comparison_report(
    output_dir: Path,
    *,
    include_browser_lab: bool = False,
) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    adaptive_store = output_dir / "scrapling-adaptive.sqlite"
    if adaptive_store.exists():
        adaptive_store.unlink()

    public_policy = SourcePolicy(
        source_id="controlled-public-html",
        allowed_hosts=("source.example",),
    )
    baseline = _fixture_response("profile-v1.html", status=200)
    drift = _fixture_response("profile-drift.html", status=200)
    challenge = _fixture_response("challenge.html", status=403)

    results = [
        run_scrapy_parser("profile-v1", baseline, public_policy),
        run_scrapling_parser(
            "profile-v1",
            baseline,
            public_policy,
            adaptive_store=adaptive_store,
            save_adaptive_reference=True,
        ),
        run_scrapy_parser("profile-drift", drift, public_policy),
        run_scrapling_parser(
            "profile-drift",
            drift,
            public_policy,
            adaptive_store=adaptive_store,
            request_adaptive_suggestion=True,
        ),
        run_scrapy_parser("challenge", challenge, public_policy),
        run_scrapling_parser("challenge", challenge, public_policy),
    ]

    policies = {
        "public_http": public_policy,
        "authorized_session": SourcePolicy(
            source_id="controlled-authorized-session",
            allowed_hosts=("source.example",),
            capability=CapabilityMode.AUTHORIZED_SESSION,
            authorized_session_ref="runtime-configured",
        ),
        "browser_rendered": SourcePolicy(
            source_id="controlled-browser-rendered",
            allowed_hosts=("source.example",),
            capability=CapabilityMode.BROWSER_RENDERED,
        ),
        "browser_stealth": SourcePolicy(
            source_id="controlled-browser-stealth",
            allowed_hosts=("source.example",),
            capability=CapabilityMode.BROWSER_STEALTH,
            fingerprint_review_ref="crawler-poc-windows-system-chrome",
        ),
        "approved_proxy": SourcePolicy(
            source_id="controlled-approved-proxy",
            allowed_hosts=("source.example",),
            capability=CapabilityMode.APPROVED_PROXY,
            approved_proxy_ref="runtime-configured",
        ),
        "stealth_lab": SourcePolicy(
            source_id="loopback-stealth-lab",
            allowed_hosts=("127.0.0.1", "localhost"),
            capability=CapabilityMode.STEALTH_LAB,
        ),
    }

    result_dicts = [result.to_dict() for result in results]
    _assert_poc_invariants(result_dicts)
    report: dict[str, Any] = {
        "schema_version": 1,
        "operation": "scrapy-scrapling-comparison",
        "outcome": "passed",
        "fixtures": ["profile-v1", "profile-drift", "challenge"],
        "results": result_dicts,
        "capability_profiles": {
            "scrapy": scrapy_capability_profile(),
            "scrapling": scrapling_capability_profile(),
        },
        "execution_plans": {
            policy_name: {
                engine: build_fetch_plan(policy, engine)
                for engine in ("scrapy", "scrapling")
            }
            for policy_name, policy in policies.items()
        },
        "decision": {
            "primary_orchestrator": "scrapy",
            "specialized_adapter": "scrapling",
            "specialized_adapter_use": [
                "browser-rendered sources",
                "source-reviewed browser-stealth sessions with challenge solving disabled",
                "browser-consistent HTTP/TLS identity",
                "authorized session persistence",
                "evidence-only adaptive selector suggestions",
                "loopback-only stealth capability lab",
            ],
            "production_prohibitions": [
                "automatic identity switching after block responses",
                "automatic proxy rotation",
                "challenge solving",
                "adaptive suggestions populating trusted fields",
                "direct database writes or publication",
            ],
            "reasoning": [
                "Both engines produced the same candidate from unchanged deterministic markup.",
                "Both engines failed closed after selector drift.",
                (
                    "Scrapling produced an evidence-only relocation suggestion without "
                    "creating a candidate."
                ),
                "Both engines stopped extraction on the controlled human-challenge response.",
                (
                    "Scrapy has the lower-complexity scheduling and middleware baseline "
                    "for the Python review pipeline."
                ),
                (
                    "Scrapling has the stronger browser, HTTP impersonation, session, "
                    "and anti-detection capability surface."
                ),
            ],
        },
    }
    if include_browser_lab:
        browser_lab = run_scrapling_browser_lab()
        report["browser_lab"] = browser_lab
        report["decision"]["browser_lab_findings"] = {
            "runtime": browser_lab.get("browser_runtime"),
            "dynamic_webdriver_hidden": (
                browser_lab.get("dynamic_browser", {})
                .get("fingerprint_assessment", {})
                .get("webdriver_hidden")
            ),
            "stealth_webdriver_hidden": (
                browser_lab.get("stealth_lab", {})
                .get("fingerprint_assessment", {})
                .get("webdriver_hidden")
            ),
            "dynamic_client_hint_version_consistent": (
                browser_lab.get("dynamic_browser", {})
                .get("fingerprint_assessment", {})
                .get("client_hint_version_consistent")
            ),
            "stealth_client_hint_version_consistent": (
                browser_lab.get("stealth_lab", {})
                .get("fingerprint_assessment", {})
                .get("client_hint_version_consistent")
            ),
        }
        if browser_lab.get("outcome") != "passed":
            report["outcome"] = browser_lab.get("outcome", "failed")
    return report


def write_comparison_report(
    output_path: Path,
    *,
    include_browser_lab: bool = False,
    require_browser_lab: bool = False,
) -> dict[str, Any]:
    report = build_comparison_report(
        output_path.parent,
        include_browser_lab=include_browser_lab,
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    if require_browser_lab and report.get("browser_lab", {}).get("outcome") != "passed":
        raise RuntimeError(
            "Scrapling browser lab did not pass; inspect the machine report for details."
        )
    return report


def _fixture_response(filename: str, *, status: int) -> ResponseEnvelope:
    body = (_FIXTURE_ROOT / filename).read_bytes()
    return ResponseEnvelope(
        requested_url=_SOURCE_URL,
        final_url=_SOURCE_URL,
        status=status,
        headers={"content-type": "text/html; charset=utf-8", "x-fixture": filename},
        body=body,
    )


def _assert_poc_invariants(results: list[dict[str, Any]]) -> None:
    by_key = {(item["engine"], item["fixture"]): item for item in results}
    for engine in ("scrapy", "scrapling"):
        baseline = by_key[(engine, "profile-v1")]
        drift = by_key[(engine, "profile-drift")]
        challenge = by_key[(engine, "challenge")]
        if baseline["candidate"] is None or not baseline["deterministic_match"]:
            raise AssertionError(f"{engine} baseline extraction failed")
        if drift["candidate"] is not None or drift["deterministic_match"]:
            raise AssertionError(f"{engine} selector drift did not fail closed")
        if challenge["candidate"] is not None:
            raise AssertionError(f"{engine} extracted from a human challenge")
        if challenge["evidence"]["block_state"] != "human-challenge-required":
            raise AssertionError(f"{engine} did not classify the challenge")
    suggestion = by_key[("scrapling", "profile-drift")]["adaptive_suggestion"]
    if not suggestion or not suggestion["evidence_only"]:
        raise AssertionError("Scrapling did not retain an evidence-only adaptive suggestion")
    if suggestion["trusted_field_population"]:
        raise AssertionError("Adaptive suggestions cannot populate trusted fields")
