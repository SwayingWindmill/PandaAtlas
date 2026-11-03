"""Refresh data/curation/learning/published-pandas.json from the production panda list.

A learning challenge can only show pandas that the mobile app can load, and the app loads the
published release from ``GET /api/v2/pandas``. The learning builder checks every challenge answer
and decoy against this snapshot, so a challenge that would be hidden in the app fails in CI
instead. Run this after a new panda release is published, then commit the snapshot:

    python scripts/curation/refresh_published_pandas.py
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SNAPSHOT_PATH = ROOT / "data" / "curation" / "learning" / "published-pandas.json"
DEFAULT_SOURCE = "https://api.zhipanda.com/api/v2/pandas"


def build_snapshot(payload: dict, source: str, fetched_on: str) -> dict:
    release = payload.get("release") or {}
    items = payload.get("items")
    if not isinstance(items, list) or not items:
        raise ValueError("the panda list has no items")
    slugs = sorted({item["canonicalSlug"] for item in items if isinstance(item.get("canonicalSlug"), str)})
    return {
        "$comment": "Canonical slugs in the published panda release. Refresh with scripts/curation/refresh_published_pandas.py.",
        "source": source,
        "fetchedOn": fetched_on,
        "releaseVersion": release.get("version"),
        "slugs": slugs,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source", default=DEFAULT_SOURCE, help="the published panda list endpoint")
    args = parser.parse_args(argv)
    request = urllib.request.Request(args.source, headers={"User-Agent": "PandaAtlas curation"})
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = json.load(response)
    fetched_on = datetime.now(timezone.utc).date().isoformat()
    try:
        snapshot = build_snapshot(payload, args.source, fetched_on)
    except ValueError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    SNAPSHOT_PATH.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"Wrote {len(snapshot['slugs'])} slugs from release {snapshot['releaseVersion']} to {SNAPSHOT_PATH.relative_to(ROOT).as_posix()}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
