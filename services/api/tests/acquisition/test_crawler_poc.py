from __future__ import annotations

from pathlib import Path

import pytest

pytest.importorskip("scrapy")
pytest.importorskip("scrapling")

from app.acquisition import poc
from app.acquisition.capabilities import build_fetch_plan
from app.acquisition.engines import run_scrapling_parser, run_scrapy_parser
from app.acquisition.lab import _browser_identity_passed
from app.acquisition.models import CapabilityMode, ResponseEnvelope, SourcePolicy
from app.acquisition.poc import build_comparison_report
from app.acquisition.policy import classify_block, validate_source_policy, validate_target

FIXTURES = Path(__file__).parent / "fixtures"
SOURCE_URL = "https://source.example/pandas/bi-li"


def response(filename: str, status: int = 200) -> ResponseEnvelope:
    return ResponseEnvelope(
        requested_url=SOURCE_URL,
        final_url=SOURCE_URL,
        status=status,
        headers={"content-type": "text/html; charset=utf-8"},
        body=(FIXTURES / filename).read_bytes(),
    )


def public_policy() -> SourcePolicy:
    return SourcePolicy(source_id="test-source", allowed_hosts=("source.example",))


def test_both_engines_emit_the_same_candidate_for_deterministic_markup(tmp_path: Path) -> None:
    envelope = response("profile-v1.html")
    scrapy_result = run_scrapy_parser("profile-v1", envelope, public_policy())
    scrapling_result = run_scrapling_parser(
        "profile-v1",
        envelope,
        public_policy(),
        adaptive_store=tmp_path / "adaptive.sqlite",
        save_adaptive_reference=True,
    )

    assert scrapy_result.candidate is not None
    assert scrapling_result.candidate is not None
    assert scrapy_result.candidate.panda_name_zh == "比力"
    assert scrapy_result.candidate.panda_name_en == "Bi Li"
    assert scrapy_result.candidate.institution_name == "Singapore Zoo"
    assert scrapy_result.candidate.to_dict() | {"engine": "scrapling"} == (
        scrapling_result.candidate.to_dict()
    )
    assert scrapy_result.evidence.body_sha256 == scrapling_result.evidence.body_sha256


def test_selector_drift_fails_closed_and_adaptive_is_evidence_only(tmp_path: Path) -> None:
    store = tmp_path / "adaptive.sqlite"
    run_scrapling_parser(
        "profile-v1",
        response("profile-v1.html"),
        public_policy(),
        adaptive_store=store,
        save_adaptive_reference=True,
    )
    scrapy_result = run_scrapy_parser(
        "profile-drift",
        response("profile-drift.html"),
        public_policy(),
    )
    scrapling_result = run_scrapling_parser(
        "profile-drift",
        response("profile-drift.html"),
        public_policy(),
        adaptive_store=store,
        request_adaptive_suggestion=True,
    )

    assert scrapy_result.candidate is None
    assert scrapling_result.candidate is None
    assert scrapling_result.adaptive_suggestion is not None
    assert scrapling_result.adaptive_suggestion["confidence_band"] == "low"
    assert scrapling_result.adaptive_suggestion["accepted_threshold"] == 25
    assert scrapling_result.adaptive_suggestion["high_confidence_threshold"] == 70
    assert scrapling_result.adaptive_suggestion["evidence_only"] is True
    assert scrapling_result.adaptive_suggestion["trusted_field_population"] is False


def test_challenge_is_terminal_for_both_engines() -> None:
    envelope = response("challenge.html", status=403)
    assert classify_block(envelope).value == "human-challenge-required"
    for result in (
        run_scrapy_parser("challenge", envelope, public_policy()),
        run_scrapling_parser("challenge", envelope, public_policy()),
    ):
        assert result.candidate is None
        assert result.evidence.block_state.value == "human-challenge-required"


@pytest.mark.parametrize(
    ("policy", "message"),
    [
        (
            SourcePolicy(
                source_id="bad-robots",
                allowed_hosts=("source.example",),
                obey_robots=False,
            ),
            "robots",
        ),
        (
            SourcePolicy(
                source_id="rotating",
                allowed_hosts=("source.example",),
                proxy_rotation=True,
            ),
            "proxy rotation",
        ),
        (
            SourcePolicy(
                source_id="external-stealth",
                allowed_hosts=("example.com",),
                capability=CapabilityMode.STEALTH_LAB,
            ),
            "loopback",
        ),
        (
            SourcePolicy(
                source_id="missing-session-ref",
                allowed_hosts=("source.example",),
                capability=CapabilityMode.AUTHORIZED_SESSION,
            ),
            "credential reference",
        ),
        (
            SourcePolicy(
                source_id="missing-proxy-ref",
                allowed_hosts=("source.example",),
                capability=CapabilityMode.APPROVED_PROXY,
            ),
            "proxy reference",
        ),
    ],
)
def test_source_policy_fails_closed(policy: SourcePolicy, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        validate_source_policy(policy)


def test_target_allowlist_is_mandatory() -> None:
    with pytest.raises(ValueError, match="not allowlisted"):
        validate_target(public_policy(), "https://other.example/pandas")


def test_production_scrapling_plan_enables_identity_consistency_not_evasion() -> None:
    plan = build_fetch_plan(public_policy(), "scrapling")
    assert plan["fetcher"] == "Fetcher"
    assert plan["options"]["stealthy_headers"] is True
    assert plan["options"]["impersonate"] == "chrome"
    assert plan["proxy_rotation"] is False
    assert plan["automatic_identity_switch"] is False
    assert plan["on_401_403_429_challenge"] == "stop-and-review"


def test_stealth_plan_is_loopback_only_and_disables_challenge_solving() -> None:
    policy = SourcePolicy(
        source_id="lab",
        allowed_hosts=("127.0.0.1",),
        capability=CapabilityMode.STEALTH_LAB,
    )
    plan = build_fetch_plan(policy, "scrapling")
    assert plan["fetcher"] == "StealthyFetcher"
    assert plan["options"]["solve_cloudflare"] is False
    assert plan["options"]["hide_canvas"] is False


def test_machine_report_recommends_hybrid_with_explicit_boundaries(tmp_path: Path) -> None:
    report = build_comparison_report(tmp_path)
    assert report["outcome"] == "passed"
    assert report["decision"]["primary_orchestrator"] == "scrapy"
    assert report["decision"]["specialized_adapter"] == "scrapling"
    assert "automatic proxy rotation" in report["decision"]["production_prohibitions"]
    assert "challenge solving" in report["decision"]["production_prohibitions"]
    drift = next(
        item
        for item in report["results"]
        if item["engine"] == "scrapling" and item["fixture"] == "profile-drift"
    )
    assert drift["candidate"] is None
    assert drift["adaptive_suggestion"]["confidence_band"] == "low"


def test_browser_identity_requires_chrome_headers_and_hidden_webdriver() -> None:
    result = {
        "outcome": "passed",
        "status": 200,
        "probe": {
            "request": {"user_agent": "Mozilla/5.0 Chrome/146.0.0.0"},
            "navigator": {
                "userAgent": "Mozilla/5.0 Chrome/146.0.0.0",
                "languages": ["en-US", "en"],
                "webdriver": False,
            },
        },
    }
    assert _browser_identity_passed(result)
    assert _browser_identity_passed(result, require_hidden_webdriver=True)

    exposed = {
        **result,
        "probe": {
            **result["probe"],
            "navigator": {**result["probe"]["navigator"], "webdriver": True},
        },
    }
    assert _browser_identity_passed(exposed)
    assert not _browser_identity_passed(exposed, require_hidden_webdriver=True)


def test_strict_browser_failure_writes_report_before_raising(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        poc,
        "run_scrapling_browser_lab",
        lambda: {"outcome": "environment-blocked", "error": "missing runtime"},
    )
    report_path = tmp_path / "report.json"
    with pytest.raises(RuntimeError, match="machine report"):
        poc.write_comparison_report(
            report_path,
            include_browser_lab=True,
            require_browser_lab=True,
        )
    assert report_path.exists()
    assert "environment-blocked" in report_path.read_text(encoding="utf-8")
