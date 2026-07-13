from datetime import date

from app.services import map_service


def test_distribution_reports_required_truncation_metadata(monkeypatch) -> None:
    monkeypatch.setattr(map_service, "_distribution_feature_limit", lambda _zoom: 1)

    monkeypatch.setattr(map_service, "has_database", lambda: False)
    payload = map_service.get_distribution(
        bbox="100,25,110,36",
        snapshot_date=None,
        layer="wild",
        zoom=6,
    )

    assert len(payload.features) == 1
    assert payload.meta.truncated is True
    assert payload.meta.limit == 1
    assert payload.meta.requested_zoom == 6


def test_habitats_reports_required_truncation_metadata(monkeypatch) -> None:
    monkeypatch.setattr(map_service, "HABITAT_FEATURE_LIMIT", 0)

    monkeypatch.setattr(map_service, "has_database", lambda: False)
    payload = map_service.get_habitats(bbox=None, level=None)

    assert payload.features == []
    assert payload.meta.truncated is True
    assert payload.meta.limit == 0
    assert payload.meta.requested_zoom is None


def test_distribution_snapshot_filter_keeps_complete_metadata(monkeypatch) -> None:
    monkeypatch.setattr(map_service, "has_database", lambda: False)
    payload = map_service.get_distribution(
        bbox="100,25,110,36",
        snapshot_date=date(2026, 3, 5),
        layer="wild",
        zoom=4,
    )

    assert payload.meta.truncated is False
    assert payload.meta.limit == 1500
    assert payload.meta.requested_zoom == 4
