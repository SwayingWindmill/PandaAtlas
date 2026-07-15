import json
import os
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable


def _validate_stats_payload(stats: dict[str, object]) -> None:
    total_pandas = stats.get("total_pandas")
    latest_snapshot_date = stats.get("latest_snapshot_date")
    featured_pandas = stats.get("featured_pandas")

    if int(total_pandas or 0) < 1:
        raise RuntimeError(f"stats endpoint returned invalid dataset: {stats}")
    if not isinstance(latest_snapshot_date, str) or not latest_snapshot_date:
        raise RuntimeError(f"stats endpoint returned invalid latest snapshot: {stats}")
    if (
        not isinstance(featured_pandas, int)
        or isinstance(featured_pandas, bool)
        or featured_pandas < 0
    ):
        raise RuntimeError(f"stats endpoint returned invalid featured pandas count: {stats}")


def request_json(
    base_url: str,
    path: str,
    *,
    method: str = "GET",
    token: str | None = None,
    payload: dict[str, object] | None = None,
) -> dict[str, object]:
    headers: dict[str, str] = {}
    body: bytes | None = None

    if token:
        headers["Authorization"] = f"Bearer {token}"

    if payload is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(payload).encode("utf-8")

    url = urllib.parse.urljoin(base_url, path)
    request = urllib.request.Request(url, method=method, headers=headers, data=body)
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def build_public_read_summary(
    requester: Callable[[str], dict[str, object]],
) -> dict[str, object]:
    health = requester("health")
    if health.get("status") != "ok":
        raise RuntimeError(f"Health check failed: {health}")
    if health.get("db") not in {"ok", "disabled"}:
        raise RuntimeError(f"Database is not healthy: {health}")

    pandas = requester("api/v1/pandas")
    if int(pandas.get("meta", {}).get("total", 0)) < 1:
        raise RuntimeError("pandas endpoint returned empty dataset")

    first_panda = (pandas.get("items") or [{}])[0]
    panda_slug = first_panda.get("slug")
    panda_id = first_panda.get("id")
    if not isinstance(panda_slug, str) or not panda_slug:
        raise RuntimeError(f"pandas endpoint did not return a usable slug: {pandas}")
    if not isinstance(panda_id, str) or not panda_id:
        raise RuntimeError(f"pandas endpoint did not return a usable id: {pandas}")

    detail = requester(f"api/v1/pandas/{urllib.parse.quote(panda_slug)}")
    if detail.get("slug") != panda_slug:
        raise RuntimeError(f"detail endpoint returned mismatched slug: {detail}")

    lineage = requester(
        f"api/v1/pandas/{urllib.parse.quote(panda_slug)}/lineage?ancestor_depth=2&descendant_depth=2",
    )
    if lineage.get("focus_id") != panda_id:
        raise RuntimeError(f"lineage endpoint returned mismatched focus: {lineage}")

    habitats = requester(
        "api/v1/map/habitats?bbox=102.5,29.7,104.2,31.8&level=national",
    )
    if len(habitats.get("features", [])) < 1:
        raise RuntimeError("habitats endpoint returned empty dataset")

    distribution = requester(
        "api/v1/map/distribution?bbox=100,25,110,36&layer=wild",
    )
    if len(distribution.get("features", [])) < 1:
        raise RuntimeError("distribution endpoint returned empty dataset")

    snapshots = requester("api/v1/map/snapshots")
    if len(snapshots.get("items", [])) < 1:
        raise RuntimeError("snapshots endpoint returned empty dataset")

    stats = requester("api/v1/stats/overview")
    _validate_stats_payload(stats)

    return {
        "health_db": health.get("db"),
        "pandas_total": pandas.get("meta", {}).get("total"),
        "pandas_first_slug": panda_slug,
        "detail_birthplace": detail.get("birthplace"),
        "lineage_focus_id": lineage.get("focus_id"),
        "lineage_nodes": len(lineage.get("nodes", [])),
        "habitats_count": len(habitats.get("features", [])),
        "distribution_features": len(distribution.get("features", [])),
        "distribution_first_cell_code": (
            ((distribution.get("features") or [{}])[0].get("properties") or {}).get("cell_code")
        ),
        "snapshots_count": len(snapshots.get("items", [])),
        "snapshots_latest_date": (snapshots.get("items") or [{}])[0].get("snapshot_date"),
        "stats_total_pandas": stats.get("total_pandas"),
        "stats_latest_snapshot_date": stats.get("latest_snapshot_date"),
        "stats_featured_pandas": stats.get("featured_pandas"),
    }


def run_public_read_smoke(base_url: str) -> dict[str, object]:
    normalized_base = base_url.rstrip("/") + "/"
    return build_public_read_summary(lambda path: request_json(normalized_base, path))


def main() -> None:
    base_url = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")
    print(json.dumps(run_public_read_smoke(base_url), ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP error {err.code}: {detail}") from err
