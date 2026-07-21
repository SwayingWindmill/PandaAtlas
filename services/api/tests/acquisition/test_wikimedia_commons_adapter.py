from __future__ import annotations

import json
from copy import deepcopy
from datetime import date
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest

from app.acquisition.models import ResponseEnvelope
from app.acquisition.source_registry import load_source_registry
from app.acquisition.wikimedia_commons import (
    DEFAULT_USER_AGENT,
    XI_LUN_FILE_TITLE,
    build_imageinfo_url,
    parse_xi_lun_result,
    validate_bot_user_agent,
)

_FIXTURE = Path(__file__).parent / "fixtures" / "commons-xi-lun-imageinfo.json"


def registry():
    return load_source_registry(today=date(2026, 7, 21))


def response(payload: dict | None = None, *, status: int = 200) -> ResponseEnvelope:
    source = registry().get("wikimedia-commons-action-api")
    request_url = build_imageinfo_url(source)
    body = _FIXTURE.read_bytes() if payload is None else json.dumps(payload).encode()
    return ResponseEnvelope(
        requested_url=request_url,
        final_url=request_url,
        status=status,
        headers={"content-type": "application/json; charset=utf-8"},
        body=body,
    )


def fixture_payload() -> dict:
    return json.loads(_FIXTURE.read_text(encoding="utf-8"))


def test_imageinfo_request_is_exact_filtered_and_non_browser() -> None:
    source = registry().get("wikimedia-commons-action-api")
    url = build_imageinfo_url(source)
    parsed = urlparse(url)
    query = parse_qs(parsed.query)

    assert parsed.scheme == "https"
    assert parsed.hostname == "commons.wikimedia.org"
    assert parsed.path == "/w/api.php"
    assert query["titles"] == [XI_LUN_FILE_TITLE]
    assert query["prop"] == ["imageinfo"]
    assert query["iiprop"] == ["timestamp|user|url|size|sha1|mime|extmetadata"]
    assert "ImageDescription" in query["iiextmetadatafilter"][0]
    assert "LicenseUrl" in query["iiextmetadatafilter"][0]
    assert query["maxlag"] == ["5"]
    assert source.browser_impersonation is False
    validate_bot_user_agent(DEFAULT_USER_AGENT)


@pytest.mark.parametrize(
    "user_agent",
    [
        "python-requests/2.0",
        "Mozilla/5.0 Chrome/147.0.0.0",
        "PandaAtlasBot/0.1",
    ],
)
def test_wikimedia_user_agent_fails_closed(user_agent: str) -> None:
    with pytest.raises(ValueError):
        validate_bot_user_agent(user_agent)


def test_xi_lun_fixture_produces_review_only_media_candidate() -> None:
    result = parse_xi_lun_result(registry(), response())
    candidate = result.candidate

    assert candidate.panda_slug == "xi-lun"
    assert candidate.panda_name_zh == "喜伦"
    assert candidate.panda_name_en == "Xi Lun"
    assert candidate.file_title == XI_LUN_FILE_TITLE
    assert candidate.uploader == "O01326"
    assert candidate.artist == "O01326"
    assert candidate.credit == "Own work"
    assert candidate.license_short_name == "CC BY-SA 4.0"
    assert candidate.license_url == "https://creativecommons.org/licenses/by-sa/4.0"
    assert candidate.attribution_required is True
    assert candidate.width == 5472
    assert candidate.height == 3648
    assert candidate.bytes == 18204374
    assert candidate.mime == "image/jpeg"
    assert candidate.sha1 == "e96415ba1e422405fe36278029dc211005971170"
    assert candidate.review_state == "candidate"
    assert candidate.original_image_downloaded is False
    assert result.evidence.body_bytes == len(_FIXTURE.read_bytes())
    assert result.to_dict()["publication_write_targets"] == []
    assert result.to_dict()["request"]["original_image_requested"] is False


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (
            lambda payload: _page(payload).__setitem__(
                "title", "File:Ya Lun at Zoo Atlanta.jpg"
            ),
            "does not match Xi Lun",
        ),
        (
            lambda payload: _metadata(payload, "ImageDescription").__setitem__(
                "value", "An unidentified giant panda at Zoo Atlanta."
            ),
            "does not identify Xi Lun",
        ),
        (
            lambda payload: _metadata(payload, "Artist").__setitem__(
                "value", "Different photographer"
            ),
            "artist and uploader identities",
        ),
        (
            lambda payload: _metadata(payload, "LicenseShortName").__setitem__(
                "value", "CC BY-NC 4.0"
            ),
            "reviewed reusable license",
        ),
        (
            lambda payload: _metadata(payload, "AttributionRequired").__setitem__(
                "value", "false"
            ),
            "attribution requirement",
        ),
        (
            lambda payload: _info(payload).__setitem__(
                "url", "https://example.invalid/Xi_Lun.jpg"
            ),
            "unexpected host",
        ),
        (
            lambda payload: _info(payload).__setitem__("sha1", "not-a-sha1"),
            "SHA-1 is invalid",
        ),
        (
            lambda payload: _info(payload)["extmetadata"].pop("LicenseUrl"),
            "LicenseUrl is missing",
        ),
    ],
)
def test_xi_lun_metadata_drift_fails_closed(mutate, message: str) -> None:
    payload = deepcopy(fixture_payload())
    mutate(payload)
    with pytest.raises(ValueError, match=message):
        parse_xi_lun_result(registry(), response(payload))


def test_non_json_and_error_status_fail_closed() -> None:
    request_url = build_imageinfo_url(registry().get("wikimedia-commons-action-api"))
    with pytest.raises(ValueError, match="HTTP 403"):
        parse_xi_lun_result(
            registry(),
            ResponseEnvelope(
                requested_url=request_url,
                final_url=request_url,
                status=403,
                headers={"content-type": "application/json"},
                body=b"{}",
            ),
        )
    with pytest.raises(ValueError, match="application/json"):
        parse_xi_lun_result(
            registry(),
            ResponseEnvelope(
                requested_url=request_url,
                final_url=request_url,
                status=200,
                headers={"content-type": "text/html"},
                body=b"<html></html>",
            ),
        )


def _page(payload: dict) -> dict:
    return payload["query"]["pages"][0]


def _info(payload: dict) -> dict:
    return _page(payload)["imageinfo"][0]


def _metadata(payload: dict, key: str) -> dict:
    return _info(payload)["extmetadata"][key]
