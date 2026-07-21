from __future__ import annotations

import json
from copy import deepcopy
from datetime import date
from pathlib import Path

import pytest

from app.acquisition.source_registry import AccessStatus, load_source_registry

_REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
_REGISTRY_PATH = _REPOSITORY_ROOT / "data" / "acquisition-sources" / "registry.json"


def test_reviewed_source_registry_enforces_current_access_decisions() -> None:
    registry = load_source_registry(today=date(2026, 7, 21))

    commons = registry.get("wikimedia-commons-action-api")
    assert commons.access_status is AccessStatus.APPROVED
    assert commons.live_fetch is True
    assert commons.browser_impersonation is False
    assert commons.max_requests_per_minute == 6
    assert commons.concurrency_per_host == 1
    assert commons.allowed_paths == ("/w/api.php",)

    zoo_atlanta = registry.get("zoo-atlanta-public-pages")
    assert zoo_atlanta.access_status is AccessStatus.PERMISSION_REQUIRED
    assert zoo_atlanta.live_fetch is False
    with pytest.raises(ValueError, match="not approved"):
        zoo_atlanta.assert_live_fetch_allowed()

    fu_bao = registry.get("fu-bao-current-location-official-source")
    assert fu_bao.access_status is AccessStatus.MANUAL_REVIEW_REQUIRED
    assert fu_bao.live_fetch is False


def test_registry_review_expiry_fails_closed() -> None:
    with pytest.raises(ValueError, match="review expired"):
        load_source_registry(today=date(2027, 2, 1))


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (
            lambda raw: raw.__setitem__("review_document_sha256", "0" * 64),
            "review document SHA-256 drifted",
        ),
        (
            lambda raw: _source(raw, "wikimedia-commons-action-api").__setitem__(
                "browser_impersonation", True
            ),
            "must not impersonate a browser",
        ),
        (
            lambda raw: _source(raw, "wikimedia-commons-action-api").__setitem__(
                "max_requests_per_minute", 0
            ),
            "invalid request rate",
        ),
        (
            lambda raw: _source(raw, "wikimedia-commons-action-api").__setitem__(
                "terms_url", None
            ),
            "lacks terms or robots evidence",
        ),
        (
            lambda raw: _source(raw, "zoo-atlanta-public-pages").__setitem__(
                "live_fetch", True
            ),
            "must not enable live fetch",
        ),
        (
            lambda raw: _source(raw, "fu-bao-current-location-official-source").__setitem__(
                "allowed_paths", ["/news"]
            ),
            "must not expose automated paths",
        ),
    ],
)
def test_registry_drift_is_rejected(
    tmp_path: Path,
    mutate,
    message: str,
) -> None:
    raw = json.loads(_REGISTRY_PATH.read_text(encoding="utf-8"))
    changed = deepcopy(raw)
    mutate(changed)
    path = tmp_path / "registry.json"
    path.write_text(json.dumps(changed), encoding="utf-8")

    with pytest.raises(ValueError, match=message):
        load_source_registry(path, today=date(2026, 7, 21))


def _source(raw: dict, source_id: str) -> dict:
    return next(item for item in raw["sources"] if item["source_id"] == source_id)
