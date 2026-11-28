"""Validate data/curation/comparisons/comparisons.json.

Usage: python3 scripts/curation/validate_comparisons.py
CI runs it on every change; the curation.content batch writes the file into the database, and the API
re-validates every entry when it reads the catalog.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "data/curation/comparisons/comparisons.json"
PUBLISHED_PANDAS = ROOT / "data/curation/learning/published-pandas.json"
KEYS = {"id", "status", "title", "dek", "pandaSlugs", "updatedAt"}
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
TITLE_MAX = 16
DEK_MAX = 30


def published_slugs() -> set[str] | None:
    if not PUBLISHED_PANDAS.exists():
        return None
    return set(json.loads(PUBLISHED_PANDAS.read_text(encoding="utf-8")).get("slugs", []))


def validate(document: dict, published: set[str] | None) -> list[str]:
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
        for key, limit in (("title", TITLE_MAX), ("dek", DEK_MAX)):
            value = item[key]
            if not isinstance(value, str) or not value.strip():
                errors.append(f"{at}.{key} must be a non-empty string")
            elif len(value) > limit:
                errors.append(f"{at}.{key} must be {limit} characters or fewer")
        pair = item["pandaSlugs"]
        if not isinstance(pair, list) or len(pair) != 2 or not all(SLUG.match(str(s)) for s in pair):
            errors.append(f"{at}.pandaSlugs must be two slugs")
        elif pair[0] == pair[1]:
            errors.append(f"{at}.pandaSlugs must be two different pandas")
        elif published is not None and item["status"] == "published":
            missing = [s for s in pair if s not in published]
            if missing:
                errors.append(f"{at}.pandaSlugs are not published: {', '.join(missing)}")
        try:
            stamp = datetime.fromisoformat(str(item["updatedAt"]))
            if stamp.tzinfo is None:
                errors.append(f"{at}.updatedAt needs a UTC offset")
        except ValueError:
            errors.append(f"{at}.updatedAt must be an ISO date-time")
    return errors


def main(argv: list[str]) -> int:
    document = json.loads(SOURCE.read_text(encoding="utf-8"))
    errors = validate(document, published_slugs())
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"comparisons ok: {len(document['items'])} entries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
