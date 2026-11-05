"""Validate data/curation/overseas-status/overseas-status.json.

Usage: python3 scripts/curation/validate_overseas_status.py
CI runs it on every change; the curation.content batch writes the file into the database, and the API
re-validates every entry when it reads the catalog.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import date, datetime
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "data/curation/overseas-status/overseas-status.json"
INSTITUTIONS = ROOT / "data/curation/institutions/institutions.json"
STAGES = {"abroad", "return_announced", "in_transit", "quarantine", "returned"}
REQUIRED = {"status", "pandaSlug", "stage", "institutionSlug", "sourceUrl", "sourcePublisher", "updatedAt"}
OPTIONAL = {"expectedReturn", "returnedOn"}
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
PARTIAL = {"day": re.compile(r"^\d{4}-\d{2}-\d{2}$"), "month": re.compile(r"^\d{4}-\d{2}$"), "year": re.compile(r"^\d{4}$")}


def institution_slugs() -> set[str] | None:
    if not INSTITUTIONS.exists():
        return None
    data = json.loads(INSTITUTIONS.read_text(encoding="utf-8"))
    rows = data if isinstance(data, list) else data.get("institutions", [])
    return {row["slug"] for row in rows if isinstance(row, dict) and "slug" in row}


def real_day(value: object) -> bool:
    try:
        return PARTIAL["day"].match(str(value)) is not None and date.fromisoformat(str(value)).isoformat() == value
    except ValueError:
        return False


def validate_item(item: object, at: str, known: set[str] | None) -> list[str]:
    if not isinstance(item, dict):
        return [f"{at} must be an object"]
    keys = set(item)
    if not REQUIRED <= keys or keys - REQUIRED - OPTIONAL:
        return [f"{at} keys must be {sorted(REQUIRED)} plus optional {sorted(OPTIONAL)}"]
    errors: list[str] = []
    if item["status"] not in {"draft", "published"}:
        errors.append(f"{at}.status must be draft or published")
    if item["stage"] not in STAGES:
        errors.append(f"{at}.stage is not a known stage")
    for key in ("pandaSlug", "institutionSlug"):
        if not SLUG.match(str(item[key])):
            errors.append(f"{at}.{key} must be a slug")
    if known is not None and item["institutionSlug"] not in known:
        errors.append(f"{at}.institutionSlug is not a curated institution")
    if not isinstance(item["sourcePublisher"], str) or not item["sourcePublisher"].strip():
        errors.append(f"{at}.sourcePublisher must be a non-empty string")
    if urlparse(str(item["sourceUrl"])).scheme != "https":
        errors.append(f"{at}.sourceUrl must be an https URL")
    try:
        if datetime.fromisoformat(str(item["updatedAt"])).tzinfo is None:
            errors.append(f"{at}.updatedAt needs a UTC offset")
    except ValueError:
        errors.append(f"{at}.updatedAt must be an ISO date-time")
    expected = item.get("expectedReturn")
    if expected is not None:
        ok = isinstance(expected, dict) and set(expected) == {"on", "precision"} and expected["precision"] in PARTIAL
        ok = ok and PARTIAL[expected["precision"]].match(str(expected["on"])) is not None
        ok = ok and (expected["precision"] != "day" or real_day(expected["on"]))
        if not ok:
            errors.append(f"{at}.expectedReturn must be {{on, precision}} with matching precision")
    if "returnedOn" in item:
        if item["stage"] not in {"quarantine", "returned"}:
            errors.append(f"{at}.returnedOn is only for pandas back in China")
        elif not real_day(item["returnedOn"]):
            errors.append(f"{at}.returnedOn must be YYYY-MM-DD")
    elif item["stage"] == "returned":
        errors.append(f"{at}.returnedOn is required once returned")
    return errors


def validate(document: dict, known: set[str] | None) -> list[str]:
    errors: list[str] = []
    if not isinstance(document.get("version"), str) or not document["version"]:
        errors.append("version must be a non-empty string")
    items = document.get("items")
    if not isinstance(items, list):
        return errors + ["items must be a list"]
    seen: set[str] = set()
    for index, item in enumerate(items):
        errors += validate_item(item, f"items[{index}]", known)
        slug = item.get("pandaSlug") if isinstance(item, dict) else None
        if slug in seen:
            errors.append(f"items[{index}].pandaSlug is a duplicate")
        seen.add(slug)
    return errors


def main(argv: list[str]) -> int:
    document = json.loads(SOURCE.read_text(encoding="utf-8"))
    errors = validate(document, institution_slugs())
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"overseas status ok: {len(document['items'])} entries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
