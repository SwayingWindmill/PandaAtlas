"""Validate data/curation/institutions/institutions.json.

CI runs ``--check`` on every change. The ``curation.content`` batch then writes the file into the
database (services/api/src/content-command.ts): it upserts institutions by slug and updates existing
facility places by slug, so a slug that is not in the database yet is skipped rather than created.

A place may list ``legacySlugs``: duplicate places that are the same real place. The batch merges
each into it first (place.merge_place moves residencies, life events and check-ins, keeps the old slug
and deletes the duplicate). Validation refuses two places at the same map point, a former slug that is
still a place here, and panda tags that still use a former slug. ``--live`` also compares the places
the public API serves, by name and map point, to catch duplicates that never had a map point here.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "data" / "curation" / "institutions" / "institutions.json"
PANDAS_PATH = ROOT / "data" / "curation" / "pandas" / "pandas.csv"

# Mirrors services/api/src/modules/places/application/visitor-content.ts.
INSTITUTION_KINDS = {"zoo", "breeding_center", "wildlife_park"}
VISIT_TIP_TOPICS = {"best_time", "finding_pandas", "getting_there", "good_to_know"}
GUIDE_TEXT_FIELDS = ("address", "openingHours", "admission", "pandaArea")
MAX_TEXT = 600
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
COUNTRY = re.compile(r"^[A-Z]{2}$")
ISO_DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")
# Two map points closer than this (about 100 m) are one place.
SAME_POINT_DEGREES = 0.001
LIVE_PLACES_URL = "https://api.zhipanda.com/api/v2/places?limit=500"


def validate_text(value: object, label: str, errors: list[str]) -> None:
    if value is None:
        return
    if not isinstance(value, dict) or set(value) - {"zh", "en"}:
        errors.append(f"{label}: must be an object with zh and/or en")
        return
    parts = [part for part in (value.get("zh"), value.get("en")) if part is not None]
    if not parts:
        errors.append(f"{label}: needs Chinese or English text")
    for part in parts:
        if not isinstance(part, str) or not part.strip() or len(part) > MAX_TEXT:
            errors.append(f"{label}: text must be between 1 and {MAX_TEXT} characters")


def validate_url(value: object, label: str, errors: list[str]) -> None:
    if value is None:
        return
    if not isinstance(value, str) or urlparse(value).scheme != "https" or not urlparse(value).netloc:
        errors.append(f"{label}: must be an absolute https URL")


def validate_sourced(value: dict, label: str, errors: list[str]) -> None:
    verified_on = value.get("verifiedOn")
    try:
        if not isinstance(verified_on, str) or not ISO_DAY.match(verified_on):
            raise ValueError
        date.fromisoformat(verified_on)
    except ValueError:
        errors.append(f"{label}.verifiedOn: must be a YYYY-MM-DD day")
    sources = value.get("sourceUrls")
    if not isinstance(sources, list) or not sources:
        errors.append(f"{label}.sourceUrls: needs at least one source URL")
        return
    for index, source in enumerate(sources):
        validate_url(source, f"{label}.sourceUrls[{index}]", errors)


def validate_profile(profile: object, label: str, errors: list[str]) -> None:
    if not isinstance(profile, dict):
        errors.append(f"{label}: must be an object")
        return
    unknown = set(profile) - {"kind", "summary", "websiteUrl", "liveCamUrl", "verifiedOn", "sourceUrls"}
    if unknown:
        errors.append(f"{label}: unknown fields {sorted(unknown)}")
    if profile.get("kind") not in INSTITUTION_KINDS:
        errors.append(f"{label}.kind: must be one of {sorted(INSTITUTION_KINDS)}")
    validate_text(profile.get("summary"), f"{label}.summary", errors)
    validate_url(profile.get("websiteUrl"), f"{label}.websiteUrl", errors)
    validate_url(profile.get("liveCamUrl"), f"{label}.liveCamUrl", errors)
    validate_sourced(profile, label, errors)


HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def validate_window(window: object, label: str, errors: list[str]) -> None:
    if window is None:
        return
    if not isinstance(window, dict) or set(window) != {"start", "end"}:
        errors.append(f"{label}: must be {{start, end}}")
        return
    start, end = window["start"], window["end"]
    if not (isinstance(start, str) and isinstance(end, str) and HHMM.match(start) and HHMM.match(end)):
        errors.append(f"{label}: times must be HH:MM")
    elif start >= end:
        errors.append(f"{label}: must start before it ends")


def validate_viewing(viewing: object, label: str, errors: list[str]) -> None:
    if viewing is None:
        return
    if not isinstance(viewing, dict) or set(viewing) - {"activeWindows", "napWindow"}:
        errors.append(f"{label}: unknown fields")
        return
    windows = viewing.get("activeWindows")
    if not isinstance(windows, list) or not 1 <= len(windows) <= 6:
        errors.append(f"{label}.activeWindows: needs 1 to 6 windows")
        return
    for index, window in enumerate(windows):
        validate_window(window, f"{label}.activeWindows[{index}]", errors)
    try:
        ordered = sorted(windows, key=lambda w: w["start"])
        if any(b["start"] < a["end"] for a, b in zip(ordered, ordered[1:])):
            errors.append(f"{label}.activeWindows: overlap")
    except (KeyError, TypeError):
        pass
    validate_window(viewing.get("napWindow"), f"{label}.napWindow", errors)


def validate_photo_spots(spots: object, label: str, errors: list[str]) -> None:
    if spots is None:
        return
    if not isinstance(spots, list) or len(spots) > 12:
        errors.append(f"{label}: must be a list of at most 12")
        return
    for index, spot in enumerate(spots):
        if not isinstance(spot, dict) or spot.get("name") is None or set(spot) - {"name", "window"}:
            errors.append(f"{label}[{index}]: needs a name")
            continue
        validate_text(spot["name"], f"{label}[{index}].name", errors)
        validate_window(spot.get("window"), f"{label}[{index}].window", errors)


def validate_guide(guide: object, label: str, errors: list[str]) -> None:
    if not isinstance(guide, dict):
        errors.append(f"{label}: must be an object")
        return
    unknown = set(guide) - {*GUIDE_TEXT_FIELDS, "tips", "viewing", "photoSpots", "verifiedOn", "sourceUrls"}
    if unknown:
        errors.append(f"{label}: unknown fields {sorted(unknown)}")
    for field in GUIDE_TEXT_FIELDS:
        validate_text(guide.get(field), f"{label}.{field}", errors)
    tips = guide.get("tips")
    if not isinstance(tips, list):
        errors.append(f"{label}.tips: must be a list")
    else:
        for index, tip in enumerate(tips):
            if not isinstance(tip, dict) or tip.get("topic") not in VISIT_TIP_TOPICS:
                errors.append(f"{label}.tips[{index}]: topic must be one of {sorted(VISIT_TIP_TOPICS)}")
                continue
            if tip.get("text") is None:
                errors.append(f"{label}.tips[{index}]: needs text")
            validate_text(tip.get("text"), f"{label}.tips[{index}].text", errors)
    validate_viewing(guide.get("viewing"), f"{label}.viewing", errors)
    validate_photo_spots(guide.get("photoSpots"), f"{label}.photoSpots", errors)
    validate_sourced(guide, label, errors)


def validate_content(content: object) -> list[str]:
    errors: list[str] = []
    institutions = content.get("institutions") if isinstance(content, dict) else None
    if not isinstance(institutions, list) or not institutions:
        return ["institutions: must be a non-empty list"]
    institution_slugs: set[str] = set()
    place_slugs: set[str] = set()
    for index, institution in enumerate(institutions):
        label = f"institutions[{index}]"
        slug = institution.get("slug")
        if not isinstance(slug, str) or not SLUG.match(slug):
            errors.append(f"{label}.slug: must be a lowercase kebab-case slug")
        elif slug in institution_slugs:
            errors.append(f"{label}.slug: duplicate institution {slug}")
        institution_slugs.add(slug)
        label = f"institution {slug}"
        if not any(isinstance(institution.get(key), str) and institution[key].strip() for key in ("nameZh", "nameEn")):
            errors.append(f"{label}: needs nameZh or nameEn")
        country = institution.get("countryCode")
        if country is not None and (not isinstance(country, str) or not COUNTRY.match(country)):
            errors.append(f"{label}.countryCode: must be two uppercase letters")
        validate_profile(institution.get("profile"), f"{label}.profile", errors)
        for place_index, place in enumerate(institution.get("places") or []):
            place_slug = place.get("slug")
            place_label = f"{label}.places[{place_index}]"
            if not isinstance(place_slug, str) or not SLUG.match(place_slug):
                errors.append(f"{place_label}.slug: must be a lowercase kebab-case slug")
                continue
            if place_slug in place_slugs:
                errors.append(f"{place_label}.slug: place {place_slug} is listed twice")
            place_slugs.add(place_slug)
            has_lon, has_lat = "longitude" in place, "latitude" in place
            if has_lon != has_lat:
                errors.append(f"{place_label}: longitude and latitude go together")
            elif has_lon:
                lon, lat = place["longitude"], place["latitude"]
                if not isinstance(lon, (int, float)) or not -180 <= lon <= 180:
                    errors.append(f"{place_label}.longitude: must be between -180 and 180")
                if not isinstance(lat, (int, float)) or not -90 <= lat <= 90:
                    errors.append(f"{place_label}.latitude: must be between -90 and 90")
            if "visitGuide" in place:
                validate_guide(place["visitGuide"], f"{place_label}.visitGuide", errors)
    errors += validate_merges(institutions, place_slugs)
    return errors


def listed_places(institutions: list) -> list[dict]:
    return [place for institution in institutions for place in institution.get("places") or []]


def validate_merges(institutions: list, place_slugs: set[str]) -> list[str]:
    """Each real place is listed once; its duplicates are named in legacySlugs, never as places."""
    errors: list[str] = []
    former_owner: dict[str, str] = {}
    places = listed_places(institutions)
    for place in places:
        slug = place.get("slug")
        former = place.get("legacySlugs", [])
        if not isinstance(former, list):
            errors.append(f"place {slug}.legacySlugs: must be a list of slugs")
            continue
        for old in former:
            if not isinstance(old, str) or not SLUG.match(old):
                errors.append(f"place {slug}.legacySlugs: {old!r} is not a lowercase kebab-case slug")
            elif old in place_slugs:
                errors.append(f"place {slug}.legacySlugs: {old} is still listed as a place; remove it")
            elif old in former_owner:
                errors.append(f"place {slug}.legacySlugs: {old} is already merged into {former_owner[old]}")
            else:
                former_owner[old] = slug
    pointed = [place for place in places if "longitude" in place and "latitude" in place]
    for index, first in enumerate(pointed):
        for second in pointed[index + 1 :]:
            if same_point(first, second):
                errors.append(
                    f"places {first.get('slug')} and {second.get('slug')} share a map point; if they are one place, "
                    "keep one and list the other in its legacySlugs"
                )
    return errors


def same_point(first: dict, second: dict) -> bool:
    try:
        return (
            abs(first["longitude"] - second["longitude"]) < SAME_POINT_DEGREES
            and abs(first["latitude"] - second["latitude"]) < SAME_POINT_DEGREES
        )
    except (KeyError, TypeError):
        return False


def validate_panda_tags(content: dict, pandas_path: Path = PANDAS_PATH) -> list[str]:
    """Panda tags name places by slug; a merged slug must be replaced by the surviving one."""
    former = {
        old: place["slug"]
        for place in listed_places(content["institutions"])
        for old in place.get("legacySlugs", [])
    }
    errors: list[str] = []
    with pandas_path.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            for tag in (tag.strip() for tag in (row.get("tags") or "").split(";")):
                if tag in former:
                    errors.append(f"pandas.csv[{row.get('slug')}]: tag {tag} was merged; use {former[tag]}")
    return errors


def normalized_name(value: object) -> str:
    text = unicodedata.normalize("NFKC", value if isinstance(value, str) else "").casefold()
    return re.sub(r"[^\w]+", " ", text).strip()


def find_duplicate_places(places: list[dict]) -> list[str]:
    """Pairs of served places that look like one place: the same name, one name inside the other, or one point."""
    findings: list[str] = []
    for index, first in enumerate(places):
        for second in places[index + 1 :]:
            reason = None
            for key in ("nameZh", "nameEn"):
                a, b = normalized_name(first.get(key)), normalized_name(second.get(key))
                if a and b and (a == b or (len(min(a, b, key=len)) >= 8 and (a in b or b in a))):
                    reason = f"{key} {first.get(key)!r} / {second.get(key)!r}"
                    break
            if reason is None and same_point(first, second):
                reason = "same map point"
            if reason is not None:
                findings.append(f"{first.get('slug')} and {second.get('slug')} look like one place ({reason})")
    return findings


def live_places(url: str = LIVE_PLACES_URL) -> list[dict]:
    # The API's edge refuses Python's default user agent.
    request = Request(url, headers={"User-Agent": "panda-atlas-curation/1", "Accept": "application/json"})
    with urlopen(request, timeout=30) as response:  # noqa: S310 - fixed https URL
        return json.load(response)["items"]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true", help="validate the data file")
    mode.add_argument("--live", action="store_true", help="report places the public API serves twice")
    args = parser.parse_args(argv)

    content = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    errors = validate_content(content)
    if not errors:
        errors = validate_panda_tags(content)
    if errors:
        for error in errors:
            print(f"error: {error}", file=sys.stderr)
        return 1

    if args.live:
        merged = {old for place in listed_places(content["institutions"]) for old in place.get("legacySlugs", [])}
        served = [place for place in live_places() if place.get("slug") not in merged]
        findings = find_duplicate_places(served)
        for finding in findings:
            print(f"error: {finding}", file=sys.stderr)
        if findings:
            return 1
        print(f"No duplicate among the {len(served)} places the public API serves, after the merges listed here.")
        return 0

    print(f"Institution content ok: {len(content['institutions'])} institutions.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
