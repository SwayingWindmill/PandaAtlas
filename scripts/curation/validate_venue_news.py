"""Validate data/curation/venue-news/venue-news.json.

Usage: python3 scripts/curation/validate_venue_news.py
CI runs it on every change; the curation.content batch writes the file into the database, and the API
re-validates every entry when it reads the catalog.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "data/curation/venue-news/venue-news.json"
INSTITUTIONS = ROOT / "data/curation/institutions/institutions.json"
KINDS = {"enclosure", "schedule", "closure", "arrival", "departure", "event", "other"}
KEYS = {"id", "status", "institutionSlug", "kind", "headline", "pandaSlugs", "sourceUrl", "sourcePublisher", "publishedOn", "updatedAt"}
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def institution_slugs() -> set[str] | None:
    if not INSTITUTIONS.exists():
        return None
    data = json.loads(INSTITUTIONS.read_text(encoding="utf-8"))
    rows = data if isinstance(data, list) else data.get("institutions", [])
    return {row["slug"] for row in rows if isinstance(row, dict) and "slug" in row}


def validate(document: dict, known: set[str] | None) -> list[str]:
    errors: list[str] = []
    if not isinstance(document.get("version"), str) or not document["version"]:
        errors.append("version must be a non-empty string")
    items = document.get("items")
    if not isinstance(items, list):
        return errors + ["items must be a list"]
    seen: set[str] = set()
    for index, item in enumerate(items):
        at = f"items[{index}]"
        if not isinstance(item, dict):
            errors.append(f"{at} must be an object")
            continue
        if set(item) != KEYS:
            errors.append(f"{at} keys must be exactly {sorted(KEYS)}")
            continue
        if not SLUG.match(str(item["id"])) or item["id"] in seen:
            errors.append(f"{at}.id must be a unique slug")
        seen.add(item["id"])
        if item["status"] not in {"draft", "published"}:
            errors.append(f"{at}.status must be draft or published")
        if item["kind"] not in KINDS:
            errors.append(f"{at}.kind is not a known kind")
        if known is not None and item["institutionSlug"] not in known:
            errors.append(f"{at}.institutionSlug is not a curated institution")
        for key in ("headline", "sourcePublisher"):
            if not isinstance(item[key], str) or not item[key].strip():
                errors.append(f"{at}.{key} must be a non-empty string")
        if urlparse(str(item["sourceUrl"])).scheme != "https":
            errors.append(f"{at}.sourceUrl must be an https URL")
        if not DAY.match(str(item["publishedOn"])):
            errors.append(f"{at}.publishedOn must be YYYY-MM-DD")
        try:
            stamp = datetime.fromisoformat(str(item["updatedAt"]))
            if stamp.tzinfo is None:
                errors.append(f"{at}.updatedAt needs a UTC offset")
        except ValueError:
            errors.append(f"{at}.updatedAt must be an ISO date-time")
        if not isinstance(item["pandaSlugs"], list) or not all(SLUG.match(str(s)) for s in item["pandaSlugs"]):
            errors.append(f"{at}.pandaSlugs must be a list of slugs")
    return errors


def main(argv: list[str]) -> int:
    document = json.loads(SOURCE.read_text(encoding="utf-8"))
    errors = validate(document, institution_slugs())
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"venue news ok: {len(document['items'])} entries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
