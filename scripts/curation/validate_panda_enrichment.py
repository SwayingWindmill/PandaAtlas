"""Validate data/curation/panda-enrichment/top-pandas.json.

Usage: python scripts/curation/validate_panda_enrichment.py
CI runs this validator on every curation change; the curation.content batch command
writes the validated document transactionally into Postgres and updates evidence/facts/residencies/lineage.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import date, datetime
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "data/curation/panda-enrichment/top-pandas.json"
INSTITUTIONS = ROOT / "data/curation/institutions/institutions.json"
PUBLISHED_PANDAS = ROOT / "data/curation/learning/published-pandas.json"

VERSION = re.compile(r"^\d{4}\.\d{2}\.\d{2}\.\d+$")
DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")
SOURCE_KEY = re.compile(r"^[a-z0-9][a-z0-9-]{1,63}$")
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

DOC_KEYS = {"version", "updatedAt", "sources", "items"}
SOURCE_KEYS = {
    "key",
    "publisher",
    "title",
    "url",
    "lastVerifiedOn",
    "publishedOn",
    "languageTag",
    "accessState",
    "evidenceTier",
    "publicSummary",
}
REQUIRED_SOURCE_KEYS = {"key", "publisher", "title", "url", "lastVerifiedOn", "languageTag", "accessState"}
ACCESS_STATES = {"accessible", "redirected", "changed", "unavailable", "archived", "restricted"}

ITEM_KEYS = {"pandaSlug", "facts", "currentResidency", "lineage"}
FACT_KEYS = {"fieldKey", "value", "certainty", "lastVerifiedOn", "sourceKeys"}
ALLOWED_FACT_FIELDS = {"sex", "birth_date", "birth_date_precision", "life_status", "death_date", "birthplace"}
CERTAINTIES = {"confirmed", "provisional"}

RESIDENCY_KEYS = {"placeSlug", "startOn", "startPrecision", "status", "lastVerifiedOn", "sourceKeys"}
REQUIRED_RESIDENCY_KEYS = {"placeSlug", "startPrecision", "status", "sourceKeys"}
DATE_PRECISIONS = {"day", "month", "year", "unknown"}
RESIDENCY_STATUSES = {"confirmed", "confirmed_country_level", "provisional"}

LINEAGE_KEYS = {"mother", "father"}
PARENT_KEYS = {"parentSlug", "status", "reviewedOn", "sourceKeys"}
REQUIRED_PARENT_KEYS = {"parentSlug", "sourceKeys"}
LINEAGE_STATUSES = {"confirmed", "tentative"}


def known_panda_slugs() -> set[str] | None:
    if not PUBLISHED_PANDAS.exists():
        return None
    data = json.loads(PUBLISHED_PANDAS.read_text(encoding="utf-8"))
    slugs = data.get("slugs") if isinstance(data, dict) else None
    if isinstance(slugs, list):
        return {str(s) for s in slugs if isinstance(s, str)}
    return None


def known_facility_place_slugs() -> set[str] | None:
    if not INSTITUTIONS.exists():
        return None
    data = json.loads(INSTITUTIONS.read_text(encoding="utf-8"))
    institutions = data if isinstance(data, list) else data.get("institutions", [])
    place_slugs: set[str] = set()
    for inst in institutions:
        if not isinstance(inst, dict):
            continue
        for place in inst.get("places") or []:
            if isinstance(place, dict) and isinstance(place.get("slug"), str):
                place_slugs.add(place["slug"])
    return place_slugs


def real_day(value: object) -> bool:
    if not isinstance(value, str) or not DAY.match(value):
        return False
    try:
        return date.fromisoformat(value).isoformat() == value
    except ValueError:
        return False


def non_empty_str(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def validate_source_keys(value: object, known_sources: set[str], at: str) -> list[str]:
    if not isinstance(value, list) or not value:
        return [f"{at} must be a non-empty list"]
    errors: list[str] = []
    for idx, key in enumerate(value):
        if not isinstance(key, str) or not SOURCE_KEY.match(key):
            errors.append(f"{at}[{idx}] must be a valid source key")
        elif key not in known_sources:
            errors.append(f"{at}[{idx}] references unknown sourceKey {key!r}")
    return errors


def validate_source(source: object, at: str) -> tuple[list[str], str | None]:
    if not isinstance(source, dict):
        return [f"{at} must be an object"], None
    errors: list[str] = []
    extra = set(source) - SOURCE_KEYS
    missing = REQUIRED_SOURCE_KEYS - set(source)
    if missing:
        errors.append(f"{at} missing keys: {sorted(missing)}")
    if extra:
        errors.append(f"{at} has unknown keys: {sorted(extra)}")
    key = source.get("key")
    if not isinstance(key, str) or not SOURCE_KEY.match(key):
        errors.append(f"{at}.key is malformed")
        key = None
    for field in ("publisher", "title", "languageTag"):
        if field in source and not non_empty_str(source[field]):
            errors.append(f"{at}.{field} must be a non-empty string")
    for field in ("evidenceTier", "publicSummary"):
        if field in source and not non_empty_str(source[field]):
            errors.append(f"{at}.{field} must be a non-empty string")
    if "url" in source:
        url = str(source["url"])
        parsed = urlparse(url)
        if parsed.scheme != "https" or not parsed.netloc:
            errors.append(f"{at}.url must be an https URL")
        elif parsed.netloc == "vertexaisearch.cloud.google.com":
            errors.append(f"{at}.url must not be a search redirect URL")
    if "lastVerifiedOn" in source and not real_day(source["lastVerifiedOn"]):
        errors.append(f"{at}.lastVerifiedOn must be a valid YYYY-MM-DD date")
    if "publishedOn" in source and not real_day(source["publishedOn"]):
        errors.append(f"{at}.publishedOn must be a valid YYYY-MM-DD date")
    if source.get("accessState") not in ACCESS_STATES:
        errors.append(f"{at}.accessState must be one of {sorted(ACCESS_STATES)}")
    return errors, key


def validate_fact(fact: object, known_sources: set[str], at: str) -> tuple[list[str], str | None]:
    if not isinstance(fact, dict):
        return [f"{at} must be an object"], None
    errors: list[str] = []
    if set(fact) != FACT_KEYS:
        missing = FACT_KEYS - set(fact)
        extra = set(fact) - FACT_KEYS
        if missing:
            errors.append(f"{at} missing keys: {sorted(missing)}")
        if extra:
            errors.append(f"{at} has unknown keys: {sorted(extra)}")
    field_key = fact.get("fieldKey")
    if field_key not in ALLOWED_FACT_FIELDS:
        errors.append(f"{at}.fieldKey must be one of {sorted(ALLOWED_FACT_FIELDS)}")
        field_key = None
    value = fact.get("value")
    if field_key == "sex" and value not in {"male", "female"}:
        errors.append(f"{at}.value for sex must be male or female")
    elif field_key == "life_status" and value not in {"alive", "deceased"}:
        errors.append(f"{at}.value for life_status must be alive or deceased")
    elif field_key in {"birth_date", "death_date"} and not real_day(value):
        errors.append(f"{at}.value for {field_key} must be a valid YYYY-MM-DD date")
    elif field_key == "birth_date_precision" and value not in {"day", "month", "year"}:
        errors.append(f"{at}.value for birth_date_precision must be day, month, or year")
    elif field_key == "birthplace" and not non_empty_str(value):
        errors.append(f"{at}.value for birthplace must be a non-empty string")
    if fact.get("certainty") not in CERTAINTIES:
        errors.append(f"{at}.certainty must be one of {sorted(CERTAINTIES)}")
    if not real_day(fact.get("lastVerifiedOn")):
        errors.append(f"{at}.lastVerifiedOn must be a valid YYYY-MM-DD date")
    errors.extend(validate_source_keys(fact.get("sourceKeys"), known_sources, f"{at}.sourceKeys"))
    return errors, field_key if isinstance(field_key, str) else None


def validate_residency(
    residency: object,
    known_sources: set[str],
    known_places: set[str] | None,
    at: str,
) -> list[str]:
    if not isinstance(residency, dict):
        return [f"{at} must be an object"]
    errors: list[str] = []
    missing = REQUIRED_RESIDENCY_KEYS - set(residency)
    extra = set(residency) - RESIDENCY_KEYS
    if missing:
        errors.append(f"{at} missing keys: {sorted(missing)}")
    if extra:
        errors.append(f"{at} has unknown keys: {sorted(extra)}")
    place_slug = residency.get("placeSlug")
    if not isinstance(place_slug, str) or not SLUG.match(place_slug):
        errors.append(f"{at}.placeSlug must be a slug")
    elif known_places is not None and place_slug not in known_places:
        errors.append(f"{at}.placeSlug {place_slug!r} is not a curated facility place in institutions.json")
    precision = residency.get("startPrecision")
    if precision not in DATE_PRECISIONS:
        errors.append(f"{at}.startPrecision must be one of {sorted(DATE_PRECISIONS)}")
    start_on = residency.get("startOn")
    if precision == "unknown":
        if start_on is not None:
            errors.append(f"{at}.startOn must be omitted or null when startPrecision is unknown")
    elif not real_day(start_on):
        errors.append(f"{at}.startOn must be a valid YYYY-MM-DD date when startPrecision is {precision}")
    if residency.get("status") not in RESIDENCY_STATUSES:
        errors.append(f"{at}.status must be one of {sorted(RESIDENCY_STATUSES)}")
    if "lastVerifiedOn" in residency and not real_day(residency["lastVerifiedOn"]):
        errors.append(f"{at}.lastVerifiedOn must be a valid YYYY-MM-DD date")
    errors.extend(validate_source_keys(residency.get("sourceKeys"), known_sources, f"{at}.sourceKeys"))
    return errors


def validate_parent(
    parent: object,
    panda_slug: str,
    known_sources: set[str],
    known_pandas: set[str] | None,
    at: str,
) -> tuple[list[str], str | None]:
    if not isinstance(parent, dict):
        return [f"{at} must be an object"], None
    errors: list[str] = []
    missing = REQUIRED_PARENT_KEYS - set(parent)
    extra = set(parent) - PARENT_KEYS
    if missing:
        errors.append(f"{at} missing keys: {sorted(missing)}")
    if extra:
        errors.append(f"{at} has unknown keys: {sorted(extra)}")
    parent_slug = parent.get("parentSlug")
    if not isinstance(parent_slug, str) or not SLUG.match(parent_slug):
        errors.append(f"{at}.parentSlug must be a slug")
        parent_slug = None
    else:
        if parent_slug == panda_slug:
            errors.append(f"{at}.parentSlug cannot equal pandaSlug {panda_slug!r}")
        if known_pandas is not None and parent_slug not in known_pandas:
            errors.append(f"{at}.parentSlug {parent_slug!r} is not in published-pandas.json")
    if "status" in parent and parent["status"] not in LINEAGE_STATUSES:
        errors.append(f"{at}.status must be one of {sorted(LINEAGE_STATUSES)}")
    if "reviewedOn" in parent and not real_day(parent["reviewedOn"]):
        errors.append(f"{at}.reviewedOn must be a valid YYYY-MM-DD date")
    errors.extend(validate_source_keys(parent.get("sourceKeys"), known_sources, f"{at}.sourceKeys"))
    return errors, parent_slug


def validate_item(
    item: object,
    known_sources: set[str],
    known_pandas: set[str] | None,
    known_places: set[str] | None,
    at: str,
) -> tuple[list[str], str | None]:
    if not isinstance(item, dict):
        return [f"{at} must be an object"], None
    errors: list[str] = []
    extra = set(item) - ITEM_KEYS
    if extra:
        errors.append(f"{at} has unknown keys: {sorted(extra)}")
    panda_slug = item.get("pandaSlug")
    if not isinstance(panda_slug, str) or not SLUG.match(panda_slug):
        errors.append(f"{at}.pandaSlug must be a slug")
        panda_slug = None
    elif known_pandas is not None and panda_slug not in known_pandas:
        errors.append(f"{at}.pandaSlug {panda_slug!r} is not in published-pandas.json")

    facts = item.get("facts")
    has_facts = False
    fact_values: dict[str, str] = {}
    if facts is not None:
        if not isinstance(facts, list):
            errors.append(f"{at}.facts must be a list")
        else:
            seen_fields: set[str] = set()
            for idx, fact in enumerate(facts):
                f_errors, field_key = validate_fact(fact, known_sources, f"{at}.facts[{idx}]")
                errors.extend(f_errors)
                if field_key is not None:
                    if field_key in seen_fields:
                        errors.append(f"{at}.facts has duplicate fieldKey {field_key!r}")
                    seen_fields.add(field_key)
                    if isinstance(fact, dict) and isinstance(fact.get("value"), str):
                        fact_values[field_key] = fact["value"]
            has_facts = len(facts) > 0

    if "birth_date" in fact_values and "death_date" in fact_values:
        if real_day(fact_values["birth_date"]) and real_day(fact_values["death_date"]):
            if fact_values["death_date"] < fact_values["birth_date"]:
                errors.append(f"{at} has death_date earlier than birth_date")

    residency = item.get("currentResidency")
    if residency is not None:
        if fact_values.get("life_status") == "deceased":
            errors.append(f"{at} cannot set currentResidency when life_status is deceased")
        errors.extend(validate_residency(residency, known_sources, known_places, f"{at}.currentResidency"))

    lineage = item.get("lineage")
    has_lineage = False
    if lineage is not None:
        if not isinstance(lineage, dict):
            errors.append(f"{at}.lineage must be an object")
        else:
            l_extra = set(lineage) - LINEAGE_KEYS
            if l_extra:
                errors.append(f"{at}.lineage has unknown keys: {sorted(l_extra)}")
            parent_slugs: dict[str, str] = {}
            for role in ("mother", "father"):
                if role in lineage:
                    has_lineage = True
                    p_errors, p_slug = validate_parent(
                        lineage[role],
                        panda_slug or "",
                        known_sources,
                        known_pandas,
                        f"{at}.lineage.{role}",
                    )
                    errors.extend(p_errors)
                    if p_slug is not None:
                        parent_slugs[role] = p_slug
            if not has_lineage:
                errors.append(f"{at}.lineage must define mother and/or father")
            if "mother" in parent_slugs and "father" in parent_slugs and parent_slugs["mother"] == parent_slugs["father"]:
                errors.append(f"{at}.lineage mother and father cannot match")

    if not has_facts and residency is None and not has_lineage:
        errors.append(f"{at} must specify at least one of facts, currentResidency, or lineage")

    return errors, panda_slug


def validate(
    document: object,
    known_pandas: set[str] | None,
    known_places: set[str] | None,
) -> list[str]:
    if not isinstance(document, dict):
        return ["document must be a JSON object"]
    errors: list[str] = []
    missing = DOC_KEYS - set(document)
    extra = set(document) - DOC_KEYS
    if missing:
        errors.append(f"document missing keys: {sorted(missing)}")
    if extra:
        errors.append(f"document has unknown keys: {sorted(extra)}")

    version = document.get("version")
    if not isinstance(version, str) or not VERSION.match(version):
        errors.append("version must match YYYY.MM.DD.N")

    updated_at = document.get("updatedAt")
    try:
        if not isinstance(updated_at, str) or datetime.fromisoformat(updated_at).tzinfo is None:
            errors.append("updatedAt must be an ISO-8601 timestamp with timezone offset")
    except ValueError:
        errors.append("updatedAt must be an ISO-8601 timestamp with timezone offset")

    sources_raw = document.get("sources")
    known_sources: set[str] = set()
    if not isinstance(sources_raw, list) or not sources_raw:
        errors.append("sources must be a non-empty list")
    else:
        for idx, source in enumerate(sources_raw):
            s_errors, key = validate_source(source, f"sources[{idx}]")
            errors.extend(s_errors)
            if key is not None:
                if key in known_sources:
                    errors.append(f"sources[{idx}].key {key!r} is a duplicate")
                known_sources.add(key)

    items_raw = document.get("items")
    if not isinstance(items_raw, list) or not items_raw:
        errors.append("items must be a non-empty list")
    else:
        seen_pandas: set[str] = set()
        for idx, item in enumerate(items_raw):
            i_errors, slug = validate_item(item, known_sources, known_pandas, known_places, f"items[{idx}]")
            errors.extend(i_errors)
            if slug is not None:
                if slug in seen_pandas:
                    errors.append(f"items[{idx}].pandaSlug {slug!r} is a duplicate")
                seen_pandas.add(slug)

    return errors


def main(argv: list[str]) -> int:
    target = Path(argv[0]) if argv else SOURCE
    document = json.loads(target.read_text(encoding="utf-8"))
    errors = validate(document, known_panda_slugs(), known_facility_place_slugs())
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"panda enrichment ok: {len(document['items'])} pandas, {len(document['sources'])} sources")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
