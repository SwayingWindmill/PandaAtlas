from __future__ import annotations

import csv
import hashlib
import io
import json
import re
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any
from urllib.parse import urlparse

from app.data.golden_dataset import project_panda_details, public_trusted_panda_record
from app.data.mock_data import MOCK_DISTRIBUTION, MOCK_HABITATS
from app.schemas.map import (
    DistributionGeoJsonFeature,
    DistributionSnapshot,
    HabitatGeoJsonFeature,
)
from app.schemas.panda import PandaDetail

ENTITY_COLLECTIONS = (
    "sources",
    "institutions",
    "places",
    "facilities",
    "pandas",
    "facts",
    "parentage_assertions",
    "residencies",
    "events",
    "media",
)
SUPPORTED_PUBLIC_SCHEMA_VERSIONS = {"1.0.0", "1.1.0", "1.2.0"}
ALLOWED_PUBLIC_FIELDS = {
    "access_state",
    "aliases",
    "alt_en",
    "alt_zh",
    "bytes",
    "canonical_slug",
    "changes_current_residency",
    "child_id",
    "coarse_location",
    "conclusion_status",
    "content",
    "coordinates",
    "cover_image_url",
    "credit",
    "country_code",
    "display_mode",
    "density",
    "birth_date",
    "birthplace",
    "current_location",
    "death_date",
    "derivatives",
    "end_date",
    "event_date",
    "event_status",
    "event_type",
    "evidence_tier",
    "external_identifiers",
    "facility_id",
    "facility_ids",
    "facility_type",
    "field",
    "freshness",
    "geometry",
    "from_facility_id",
    "gender",
    "height",
    "id",
    "kind",
    "intro",
    "institution_ids",
    "institution_type",
    "is_featured",
    "language",
    "level",
    "last_verified_at",
    "legacy_slugs",
    "license_state",
    "life_status",
    "locale",
    "localized_content",
    "locality",
    "max_age_days",
    "media_release",
    "mime_type",
    "name_en",
    "name",
    "name_zh",
    "names",
    "panda_id",
    "parent_id",
    "participants",
    "place_ids",
    "place_type",
    "policy",
    "precision",
    "presentation_role",
    "primary",
    "province",
    "properties",
    "published_at",
    "publisher",
    "record_tier",
    "residency_type",
    "rights",
    "revision_summaries",
    "role",
    "sex",
    "source_ids",
    "search_terms",
    "sha256",
    "source_url",
    "start_date",
    "state",
    "status",
    "subject_id",
    "summary",
    "snapshot_date",
    "system",
    "title",
    "type",
    "tags",
    "to_coarse_location",
    "to_facility_id",
    "translation_status",
    "url",
    "value",
    "version",
    "width",
    "notes",
    "cell_code",
}
DROP_PUBLIC_FIELDS = {
    "precise_wildlife_location",
    "precise_location",
    "exact_coordinates",
    "exact_location",
}
SENSITIVE_FIELD_MARKERS = (
    "contact",
    "email",
    "phone",
    "personal",
    "private",
    "restricted",
    "curator",
    "review_owner",
    "evidence_body",
)
_OMIT = object()
CANONICAL_ENTITY_TYPES = {
    "panda": "pandas",
    "source": "sources",
    "facility": "facilities",
    "institution": "institutions",
    "place": "places",
    "fact": "facts",
    "parentage_assertion": "parentage_assertions",
    "residency": "residencies",
    "event": "events",
    "media_item": "media",
}
EMAIL_PATTERN = re.compile(r"\b[^\s@]+@[^\s@]+\.[^\s@]+\b")
PRECISE_COORDINATE_PATTERN = re.compile(
    r"(?<!\d)-?\d{1,3}\.\d{4,}\s*[,/]\s*-?\d{1,3}\.\d{4,}(?!\d)"
)
PUBLIC_MEDIA_SCHEMA_VERSION = "1.2.0"
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")


class ProjectionSecurityError(ValueError):
    """Raised when public source state contains an unclassified sensitive field."""


class ProjectionCompatibilityError(ValueError):
    """Raised when projection code cannot preserve the requested public semantics."""


@dataclass(frozen=True)
class PublicReleaseInput:
    source_state: dict[str, Any]
    publication_batch_id: str
    projection_code_version: str
    database_migration_version: str
    released_at: datetime


@dataclass(frozen=True)
class PublicRelease:
    release_metadata: dict[str, str]
    manifest: dict[str, Any]
    files: dict[str, str]

    def checksum(self, filename: str) -> str:
        return hashlib.sha256(self.files[filename].encode("utf-8")).hexdigest()


def _canonical_json(value: object, *, pretty: bool = False) -> str:
    if pretty:
        return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def _iso_z(value: datetime) -> str:
    if value.tzinfo is None:
        raise ValueError("released_at must be timezone-aware")
    return value.isoformat(timespec="seconds").replace("+00:00", "Z")


def _sanitize_public_value(value: Any, *, path: str, published_sources: set[str]) -> Any:
    if isinstance(value, list):
        sanitized = [
            _sanitize_public_value(item, path=f"{path}[]", published_sources=published_sources)
            for item in value
        ]
        return [item for item in sanitized if item is not _OMIT]
    if isinstance(value, str):
        if EMAIL_PATTERN.search(value):
            raise ProjectionSecurityError(f"Personal email is not allowed at {path}")
        if PRECISE_COORDINATE_PATTERN.search(value):
            raise ProjectionSecurityError(f"Precise coordinates are not allowed at {path}")
        return value
    if isinstance(value, (int, float)) and "coordinates" in path:
        if abs(float(value) - round(float(value), 3)) > 1e-9:
            raise ProjectionSecurityError(f"Precise coordinates are not allowed at {path}")
        return value
    if not isinstance(value, dict):
        return value

    translation_status = value.get("translation_status")
    if translation_status is not None and translation_status != "approved":
        return _OMIT

    result: dict[str, Any] = {}
    for key in sorted(value):
        lowered = key.lower()
        if lowered in DROP_PUBLIC_FIELDS:
            continue
        if key not in ALLOWED_PUBLIC_FIELDS:
            classification = (
                "Sensitive"
                if any(marker in lowered for marker in SENSITIVE_FIELD_MARKERS)
                else "Unknown"
            )
            raise ProjectionSecurityError(
                f"{classification} public field is not allowed at {path}.{key}"
            )
        item = value[key]
        if key == "source_ids" and isinstance(item, list):
            result[key] = sorted(
                {str(source_id) for source_id in item if str(source_id) in published_sources}
            )
            continue
        sanitized = _sanitize_public_value(
            item,
            path=f"{path}.{key}",
            published_sources=published_sources,
        )
        if sanitized is not _OMIT:
            result[key] = sanitized
    return result


def _project_records(source_state: dict[str, Any]) -> list[dict[str, Any]]:
    published_sources = {
        str(record["id"])
        for record in source_state.get("sources", [])
        if record.get("publication_status") == "published"
    }
    records: list[dict[str, Any]] = []
    direct_records = source_state.get("records")
    if isinstance(direct_records, list):
        published_sources.update(
            str(record["id"])
            for record in direct_records
            if record.get("entity_type") in {"source", "sources"}
        )
        for source_record in direct_records:
            entity_type = CANONICAL_ENTITY_TYPES.get(
                str(source_record["entity_type"]), str(source_record["entity_type"])
            )
            if entity_type.startswith("api_"):
                public = source_record.get("public", {})
                _assert_runtime_safe(
                    public,
                    path=f"records.{source_record.get('id', 'unknown')}.public",
                )
                entity_id = str(source_record["id"])
                if entity_type == "api_pandas" and str(public.get("id")) != entity_id:
                    raise ProjectionCompatibilityError(
                        "api_pandas entity id must match its public id"
                    )
                if entity_type in {"api_distribution", "api_habitats"} and str(
                    public.get("id")
                ) != entity_id:
                    raise ProjectionCompatibilityError(
                        f"{entity_type} entity id must match its public id"
                    )
                if entity_type == "api_snapshots" and str(
                    public.get("version")
                ) != entity_id:
                    raise ProjectionCompatibilityError(
                        "api_snapshots entity id must match its public version"
                    )
                if entity_type == "api_stats" and entity_id != "overview":
                    raise ProjectionCompatibilityError(
                        "api_stats entity id must be overview"
                    )
            else:
                public = _sanitize_public_value(
                    source_record.get("public", {}),
                    path=f"records.{source_record.get('id', 'unknown')}.public",
                    published_sources=published_sources,
                )
            records.append(
                {
                    "entity_type": entity_type,
                    "id": str(source_record["id"]),
                    "public": public,
                }
            )
        records.sort(key=lambda record: (record["entity_type"], record["id"]))
        return records
    for entity_type in ENTITY_COLLECTIONS:
        for source_record in source_state.get(entity_type, []):
            if source_record.get("publication_status") != "published":
                continue
            public = _sanitize_public_value(
                source_record.get("public", {}),
                path=f"{entity_type}.{source_record.get('id', 'unknown')}.public",
                published_sources=published_sources,
            )
            records.append(
                {
                    "entity_type": entity_type,
                    "id": str(source_record["id"]),
                    "public": public,
                }
            )
    records.sort(key=lambda record: (record["entity_type"], record["id"]))
    return records


def _required_media_text(public: dict[str, Any], field: str, media_id: str) -> str:
    value = public.get(field)
    if not isinstance(value, str) or not value.strip():
        raise ProjectionCompatibilityError(f"Public media {media_id} requires non-empty {field}")
    return value.strip()


def _https_media_url(value: Any, label: str) -> str:
    if not isinstance(value, str):
        raise ProjectionCompatibilityError(f"{label} must be an HTTPS URL")
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ProjectionCompatibilityError(f"{label} must be an HTTPS URL")
    return value


def _positive_media_integer(value: Any, label: str, *, allow_zero: bool = False) -> int:
    minimum = 0 if allow_zero else 1
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        comparator = "non-negative" if allow_zero else "positive"
        raise ProjectionCompatibilityError(f"{label} must be a {comparator} integer")
    return value


def _validated_public_media(record: dict[str, Any]) -> dict[str, Any]:
    media_id = str(record["id"])
    public = dict(record.get("public", {}))
    panda_id = _required_media_text(public, "panda_id", media_id)
    source_url = _https_media_url(
        _required_media_text(public, "source_url", media_id),
        f"Public media {media_id} source_url",
    )
    rights = _required_media_text(public, "rights", media_id)
    credit = _required_media_text(public, "credit", media_id)
    alt_zh = _required_media_text(public, "alt_zh", media_id)
    alt_en = _required_media_text(public, "alt_en", media_id)
    source_ids = public.get("source_ids")
    if (
        not isinstance(source_ids, list)
        or not source_ids
        or not all(isinstance(source_id, str) and source_id for source_id in source_ids)
    ):
        raise ProjectionCompatibilityError(
            f"Public media {media_id} requires at least one reviewed source_id"
        )
    status = public.get("status")
    if status not in {"available", "withdrawn", "unavailable"}:
        raise ProjectionCompatibilityError(
            f"Public media {media_id} has unsupported status {status!r}"
        )

    normalized = {
        **public,
        "panda_id": panda_id,
        "source_url": source_url,
        "rights": rights,
        "credit": credit,
        "alt_zh": alt_zh,
        "alt_en": alt_en,
        "status": status,
        "source_ids": sorted(set(source_ids)),
    }
    for optional_field in (
        "url",
        "sha256",
        "mime_type",
        "width",
        "height",
        "bytes",
    ):
        normalized.setdefault(optional_field, None)
    normalized.setdefault("derivatives", [])
    if status != "available":
        if public.get("url") not in {None, ""}:
            raise ProjectionCompatibilityError(
                f"Public media {media_id} cannot expose an image URL while {status}"
            )
        if public.get("derivatives") not in (None, []):
            raise ProjectionCompatibilityError(
                f"Public media {media_id} cannot expose derivatives while {status}"
            )
        normalized.update({"url": None, "derivatives": []})
        return {"id": media_id, **normalized}

    normalized["url"] = _https_media_url(public.get("url"), f"Public media {media_id} url")
    sha256 = public.get("sha256")
    if not isinstance(sha256, str) or not SHA256_PATTERN.fullmatch(sha256):
        raise ProjectionCompatibilityError(f"Public media {media_id} requires a lowercase SHA-256")
    mime_type = public.get("mime_type")
    if mime_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise ProjectionCompatibilityError(
            f"Public media {media_id} has unsupported MIME type {mime_type!r}"
        )
    normalized.update(
        {
            "sha256": sha256,
            "mime_type": mime_type,
            "width": _positive_media_integer(public.get("width"), f"Public media {media_id} width"),
            "height": _positive_media_integer(
                public.get("height"), f"Public media {media_id} height"
            ),
            "bytes": _positive_media_integer(
                public.get("bytes"), f"Public media {media_id} bytes", allow_zero=True
            ),
        }
    )
    derivatives = public.get("derivatives")
    if not isinstance(derivatives, list) or not derivatives:
        raise ProjectionCompatibilityError(
            f"Public media {media_id} requires at least one generated derivative"
        )
    normalized_derivatives = []
    for index, derivative in enumerate(derivatives):
        if not isinstance(derivative, dict):
            raise ProjectionCompatibilityError(
                f"Public media {media_id} derivative {index} must be an object"
            )
        derivative_sha256 = derivative.get("sha256")
        if not isinstance(derivative_sha256, str) or not SHA256_PATTERN.fullmatch(
            derivative_sha256
        ):
            raise ProjectionCompatibilityError(
                f"Public media {media_id} derivative {index} requires a lowercase SHA-256"
            )
        if derivative.get("mime_type") != "image/webp":
            raise ProjectionCompatibilityError(
                f"Public media {media_id} derivative {index} must be image/webp"
            )
        normalized_derivatives.append(
            {
                **derivative,
                "kind": _required_media_text(derivative, "kind", f"{media_id} derivative {index}"),
                "url": _https_media_url(
                    derivative.get("url"),
                    f"Public media {media_id} derivative {index} url",
                ),
                "sha256": derivative_sha256,
                "mime_type": "image/webp",
                "width": _positive_media_integer(
                    derivative.get("width"),
                    f"Public media {media_id} derivative {index} width",
                ),
                "height": _positive_media_integer(
                    derivative.get("height"),
                    f"Public media {media_id} derivative {index} height",
                ),
                "bytes": _positive_media_integer(
                    derivative.get("bytes"),
                    f"Public media {media_id} derivative {index} bytes",
                    allow_zero=True,
                ),
            }
        )
    normalized["derivatives"] = sorted(
        normalized_derivatives, key=lambda item: (item["width"], item["kind"])
    )
    return {"id": media_id, **normalized}


def _validated_media_release_record(record: dict[str, Any]) -> dict[str, Any]:
    media_id = str(record["id"])
    public = dict(record.get("public", {}))
    panda_id = _required_media_text(public, "panda_id", media_id)
    license_state = public.get("license_state")
    display_mode = public.get("display_mode")
    valid_pairs = {
        "no_licensed_media": "designed_empty_state",
        "source_link_only": "link_to_source",
    }
    if valid_pairs.get(license_state) != display_mode:
        raise ProjectionCompatibilityError(
            f"Public media policy {media_id} has inconsistent license/display state"
        )
    source_ids = public.get("source_ids")
    if not isinstance(source_ids, list) or not all(
        isinstance(source_id, str) and source_id for source_id in source_ids
    ):
        raise ProjectionCompatibilityError(f"Public media policy {media_id} has invalid source_ids")
    return {
        **public,
        "panda_id": panda_id,
        "license_state": license_state,
        "display_mode": display_mode,
        "source_ids": sorted(set(source_ids)),
    }


def _attach_public_media(
    records: list[dict[str, Any]], public_schema_version: str
) -> list[dict[str, Any]]:
    if public_schema_version != PUBLIC_MEDIA_SCHEMA_VERSION:
        return records

    panda_ids = {record["id"] for record in records if record["entity_type"] == "pandas"}
    media_by_panda: dict[str, list[dict[str, Any]]] = {}
    media_release_by_panda: dict[str, dict[str, Any]] = {}
    normalized_media: dict[str, dict[str, Any]] = {}
    for record in records:
        if record["entity_type"] != "media":
            continue
        if "status" in record.get("public", {}):
            media = _validated_public_media(record)
            media_by_panda.setdefault(media["panda_id"], []).append(media)
        else:
            policy = _validated_media_release_record(record)
            media = {"id": str(record["id"]), **policy}
            if policy["panda_id"] in media_release_by_panda:
                raise ProjectionCompatibilityError(
                    f"Panda {policy['panda_id']} has multiple public media policies"
                )
            media_release_by_panda[policy["panda_id"]] = {
                "license_state": policy["license_state"],
                "display_mode": policy["display_mode"],
                "source_ids": policy["source_ids"],
            }
        if media["panda_id"] not in panda_ids:
            raise ProjectionCompatibilityError(
                f"Public media {media['id']} references unpublished panda {media['panda_id']}"
            )
        normalized_media[record["id"]] = media

    result = []
    for record in records:
        if record["entity_type"] == "media":
            media = normalized_media[record["id"]]
            result.append(
                {
                    **record,
                    "public": {key: value for key, value in media.items() if key != "id"},
                }
            )
            continue
        if record["entity_type"] != "pandas":
            result.append(record)
            continue
        media = sorted(
            media_by_panda.get(record["id"], []),
            key=lambda item: (
                item["status"] != "available",
                item.get("presentation_role") != "primary",
                item["id"],
            ),
        )
        cover = next((item["url"] for item in media if item["status"] == "available"), None)
        derived_media_release = (
            {
                "license_state": "licensed",
                "display_mode": "gallery",
                "source_ids": sorted(
                    {source_id for item in media for source_id in item["source_ids"]}
                ),
            }
            if media
            else media_release_by_panda.get(record["id"], record["public"].get("media_release"))
        )
        result.append(
            {
                **record,
                "public": {
                    **record["public"],
                    "media": media,
                    "cover_image_url": cover,
                    "media_release": derived_media_release,
                },
            }
        )
    return result


def _bind_runtime_media(
    pandas: list[dict[str, Any]],
    projected_records: list[dict[str, Any]],
    release: dict[str, str],
) -> list[dict[str, Any]]:
    if release["public_schema_version"] != PUBLIC_MEDIA_SCHEMA_VERSION:
        return pandas

    archive_by_id = {
        record["id"]: record["public"]
        for record in projected_records
        if record["entity_type"] == "pandas"
    }
    result = []
    for panda in pandas:
        panda_id = str(panda["id"])
        archive = archive_by_id.get(panda_id)
        if archive is None:
            raise ProjectionCompatibilityError(
                f"Runtime panda {panda_id} has no archive panda record"
            )
        expected_media = archive.get("media", [])
        supplied_media = panda.get("media") or []
        if supplied_media and _canonical_json(supplied_media) != _canonical_json(expected_media):
            raise ProjectionCompatibilityError(
                f"Archive/API media semantics conflict for {panda_id}"
            )
        expected_cover = archive.get("cover_image_url")
        supplied_cover = panda.get("cover_image_url")
        if supplied_cover not in {None, expected_cover}:
            raise ProjectionCompatibilityError(
                f"Archive/API cover image semantics conflict for {panda_id}"
            )
        result.append(
            {
                **panda,
                "media": expected_media,
                "cover_image_url": expected_cover,
                "media_release": archive.get("media_release"),
            }
        )
    return result


def _runtime_dataset(
    source_state: dict[str, Any], projected_records: list[dict[str, Any]]
) -> dict[str, Any]:
    dataset: dict[str, Any] = {
        "dataset": source_state["dataset"],
        **{collection: [] for collection in ENTITY_COLLECTIONS},
    }
    for record in projected_records:
        collection = str(record.get("entity_type"))
        if collection in ENTITY_COLLECTIONS:
            dataset[collection].append(
                {
                    "id": str(record["id"]),
                    "publication_status": "published",
                    "public": record.get("public", {}),
                }
            )
    return dataset


def _runtime_api(
    source_state: dict[str, Any], release: dict[str, str], projected_records: list[dict[str, Any]]
) -> dict[str, Any]:
    dataset = _runtime_dataset(source_state, projected_records)
    institutions = [
        {"id": str(record["id"]), **record["public"]}
        for record in projected_records
        if record["entity_type"] == "institutions"
    ]
    places = [
        {"id": str(record["id"]), **record["public"]}
        for record in projected_records
        if record["entity_type"] == "places"
    ]
    api_panda_records = [
        record["public"]
        for record in projected_records
        if record["entity_type"] == "api_pandas"
    ]
    if api_panda_records:
        pandas = api_panda_records
    else:
        pandas = [
            public_trusted_panda_record(record)
            for record in project_panda_details(
                dataset, effective_date=date.fromisoformat(release["released_at"][:10])
            )
        ]
    pandas = _bind_runtime_media(pandas, projected_records, release)
    if "records" in source_state and any(
        record["entity_type"] == "pandas" for record in projected_records
    ) and not api_panda_records:
        raise ProjectionCompatibilityError(
            "Reviewed PostgreSQL releases require api_pandas snapshot revisions"
        )
    if "records" in source_state:
        entity_types = {record["entity_type"] for record in projected_records}
        required_runtime_types = {
            "api_pandas",
            "api_distribution",
            "api_habitats",
            "api_snapshots",
        }
        missing = sorted(required_runtime_types - entity_types)
        if missing:
            raise ProjectionCompatibilityError(
                "Reviewed PostgreSQL release is missing runtime snapshot revisions: "
                + ", ".join(missing)
            )
        archive_panda_ids = {
            record["id"]
            for record in projected_records
            if record["entity_type"] == "pandas"
            and record["public"].get("record_tier") != "dependency_stub"
        }
        api_panda_ids = {
            str(record["public"].get("id"))
            for record in projected_records
            if record["entity_type"] == "api_pandas"
        }
        if not archive_panda_ids:
            raise ProjectionCompatibilityError(
                "Reviewed PostgreSQL releases require archive panda revisions for CSV/JSON exports"
            )
        if archive_panda_ids != api_panda_ids:
            raise ProjectionCompatibilityError(
                "Reviewed PostgreSQL api_pandas snapshot does not cover the published panda set"
            )
        archive_by_id = {
            record["id"]: record["public"]
            for record in projected_records
            if record["entity_type"] == "pandas"
        }
        api_by_id = {
            str(record["public"]["id"]): record["public"]
            for record in projected_records
            if record["entity_type"] == "api_pandas"
        }
        for panda_id in sorted(api_panda_ids):
            archive = archive_by_id[panda_id]
            api_record = api_by_id[panda_id]
            names = archive.get("names", [])
            archive_values = {
                "slug": archive.get("canonical_slug") or archive.get("slug"),
                "name_zh": next(
                    (
                        item.get("value")
                        for item in names
                        if item.get("language") == "zh-Hans" and item.get("primary")
                    ),
                    archive.get("name_zh"),
                ),
                "name_en": next(
                    (
                        item.get("value")
                        for item in names
                        if item.get("language") == "en" and item.get("primary")
                    ),
                    archive.get("name_en"),
                ),
                "gender": archive.get("sex") or archive.get("gender"),
                "status": archive.get("life_status") or archive.get("status"),
            }
            conflicts = sorted(
                field
                for field, archive_value in archive_values.items()
                if archive_value != api_record.get(field)
            )
            revision = api_record.get("public_revision") or {}
            if revision.get("data_version") != release["dataset_release_version"]:
                conflicts.append("public_revision.data_version")
            if revision.get("public_schema_version") != release["public_schema_version"]:
                conflicts.append("public_revision.public_schema_version")
            if conflicts:
                raise ProjectionCompatibilityError(
                    f"Archive/API panda semantics conflict for {panda_id}: "
                    + ", ".join(conflicts)
                )
    supplied = source_state.get("runtime_api")
    if isinstance(supplied, dict):
        _assert_runtime_safe(supplied)
        distribution = supplied.get("distribution", {"type": "FeatureCollection", "features": []})
        habitats = supplied.get("habitats", {"type": "FeatureCollection", "features": []})
        snapshots = supplied.get("snapshots", [])
    elif "pandas" in source_state:
        distribution = MOCK_DISTRIBUTION
        habitats = MOCK_HABITATS
        snapshot_dates = sorted(
            {
                str(feature.get("properties", {}).get("snapshot_date"))
                for feature in MOCK_DISTRIBUTION.get("features", [])
                if feature.get("properties", {}).get("snapshot_date")
            },
            reverse=True,
        )
        snapshots = [
            {"snapshot_date": value, "version": f"release-{index + 1}", "notes": None}
            for index, value in enumerate(snapshot_dates)
        ]
    else:
        distribution = {
            "type": "FeatureCollection",
            "features": [
                record["public"]
                for record in projected_records
                if record["entity_type"]
                in {"distribution_cell", "distribution_cells", "api_distribution"}
            ],
        }
        habitats = {
            "type": "FeatureCollection",
            "features": [
                record["public"]
                for record in projected_records
                if record["entity_type"] in {"habitat", "habitats", "api_habitats"}
            ],
        }
        snapshots = [
            record["public"]
            for record in projected_records
            if record["entity_type"]
            in {"distribution_snapshot", "distribution_snapshots", "api_snapshots"}
        ]
    pandas = [
        PandaDetail.model_validate(item).model_dump(mode="json") for item in pandas
    ]
    distribution_features = [
        DistributionGeoJsonFeature.model_validate(item).model_dump(mode="json")
        for item in distribution.get("features", [])
    ]
    habitat_features = [
        HabitatGeoJsonFeature.model_validate(item).model_dump(mode="json")
        for item in habitats.get("features", [])
    ]
    snapshots = [
        DistributionSnapshot.model_validate(item).model_dump(mode="json")
        for item in snapshots
    ]
    snapshots.sort(key=lambda item: (item["snapshot_date"], item["version"]), reverse=True)
    _assert_wildlife_geometry_is_generalized(distribution_features)
    latest_snapshot = snapshots[0]["snapshot_date"] if snapshots else release["released_at"][:10]
    stats = {
        "total_pandas": len(pandas),
        "active_habitats": len(habitat_features),
        "latest_snapshot_date": latest_snapshot,
        "wild_distribution_cells": sum(
            feature.get("properties", {}).get("layer") == "wild"
            and feature.get("properties", {}).get("snapshot_date") == latest_snapshot
            for feature in distribution_features
        ),
        "featured_pandas": sum("featured" in record.get("tags", []) for record in pandas),
    }
    runtime = {
        "release": release,
        "institutions": institutions,
        "places": places,
        "pandas": pandas,
        "distribution": {"type": "FeatureCollection", "features": distribution_features},
        "habitats": {"type": "FeatureCollection", "features": habitat_features},
        "snapshots": snapshots,
        "stats": stats,
    }
    _assert_runtime_safe(runtime)
    return runtime


def _assert_runtime_safe(value: Any, *, path: str = "runtime_api") -> None:
    if isinstance(value, str):
        if EMAIL_PATTERN.search(value):
            raise ProjectionSecurityError(f"Personal email is not allowed at {path}")
        if PRECISE_COORDINATE_PATTERN.search(value):
            raise ProjectionSecurityError(f"Precise coordinates are not allowed at {path}")
        return
    if isinstance(value, list):
        for index, item in enumerate(value):
            _assert_runtime_safe(item, path=f"{path}[{index}]")
        return
    if isinstance(value, dict):
        for key, item in value.items():
            lowered = str(key).lower()
            if lowered in DROP_PUBLIC_FIELDS or any(
                marker in lowered for marker in SENSITIVE_FIELD_MARKERS
            ):
                raise ProjectionSecurityError(f"Sensitive public field at {path}.{key}")
            _assert_runtime_safe(item, path=f"{path}.{key}")


def _coordinate_positions(value: Any) -> list[tuple[float, float]]:
    if isinstance(value, list):
        if len(value) >= 2 and all(isinstance(item, (int, float)) for item in value[:2]):
            return [(float(value[0]), float(value[1]))]
        return [position for item in value for position in _coordinate_positions(item)]
    return []


def _assert_wildlife_geometry_is_generalized(
    features: list[dict[str, Any]],
) -> None:
    for feature in features:
        if feature.get("properties", {}).get("layer") != "wild":
            continue
        geometry = feature.get("geometry", {})
        if geometry.get("type") in {"Point", "MultiPoint", "LineString"}:
            raise ProjectionSecurityError("Wild distribution must use aggregated polygon cells")
        positions = _coordinate_positions(geometry.get("coordinates"))
        if not positions:
            raise ProjectionSecurityError("Wild distribution cell has no polygon coordinates")
        longitude_span = max(item[0] for item in positions) - min(item[0] for item in positions)
        latitude_span = max(item[1] for item in positions) - min(item[1] for item in positions)
        if longitude_span < 0.05 or latitude_span < 0.05:
            raise ProjectionSecurityError("Wild distribution cell is too precise for publication")


def _runtime_records(runtime: dict[str, Any]) -> list[dict[str, Any]]:
    records = [
        {"entity_type": "api_pandas", "id": str(item["id"]), "public": item}
        for item in runtime["pandas"]
    ]
    records.extend(
        {
            "entity_type": "api_distribution",
            "id": str(feature.get("id", index)),
            "public": feature,
        }
        for index, feature in enumerate(runtime["distribution"]["features"])
    )
    records.extend(
        {
            "entity_type": "api_habitats",
            "id": str(feature.get("id", index)),
            "public": feature,
        }
        for index, feature in enumerate(runtime["habitats"]["features"])
    )
    records.extend(
        {"entity_type": "api_snapshots", "id": str(item["version"]), "public": item}
        for item in runtime["snapshots"]
    )
    records.append({"entity_type": "api_stats", "id": "overview", "public": runtime["stats"]})
    return records


def _panda_json(records: list[dict[str, Any]], release: dict[str, str]) -> str:
    pandas = [
        {"id": record["id"], **record["public"]}
        for record in records
        if record["entity_type"] == "pandas"
        and record["public"].get("record_tier") != "dependency_stub"
    ]
    payload: dict[str, Any] = {"release": release, "records": pandas}
    if release["public_schema_version"] == PUBLIC_MEDIA_SCHEMA_VERSION:
        payload["media"] = [
            {"id": record["id"], **record["public"]}
            for record in records
            if record["entity_type"] == "media"
        ]
    return _canonical_json(payload, pretty=True)


def _panda_csv(records: list[dict[str, Any]], release: dict[str, str]) -> str:
    buffer = io.StringIO(newline="")
    fieldnames = [
        "dataset_release_version",
        "public_schema_version",
        "id",
        "canonical_slug",
        "name_zh",
        "name_en",
        "sex",
        "life_status",
        "public_json",
    ]
    writer = csv.DictWriter(buffer, fieldnames=fieldnames, lineterminator="\n")
    writer.writeheader()
    for record in records:
        if record["entity_type"] != "pandas":
            continue
        public = record["public"]
        if public.get("record_tier") == "dependency_stub":
            continue
        names = public.get("names", [])
        writer.writerow(
            {
                "dataset_release_version": release["dataset_release_version"],
                "public_schema_version": release["public_schema_version"],
                "id": record["id"],
                "canonical_slug": public.get("canonical_slug", public.get("slug", "")),
                "name_zh": next(
                    (
                        name.get("value", "")
                        for name in names
                        if name.get("language") == "zh-Hans" and name.get("primary")
                    ),
                    public.get("name_zh", ""),
                ),
                "name_en": next(
                    (
                        name.get("value", "")
                        for name in names
                        if name.get("language") == "en" and name.get("primary")
                    ),
                    public.get("name_en", ""),
                ),
                "sex": public.get("sex", public.get("gender", "unknown")),
                "life_status": public.get("life_status", public.get("status", "unknown")),
                "public_json": _canonical_json(public),
            }
        )
    return buffer.getvalue()


def _sql_literal(value: object) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def _d1_sql(
    records: list[dict[str, Any]],
    release: dict[str, str],
    licenses: dict[str, Any],
) -> str:
    version = _sql_literal(release["dataset_release_version"])
    lines = [
        "begin immediate;",
        "insert into public_releases (",
        "  dataset_release_version, public_schema_version, database_migration_version,",
        "  publication_batch_id, projection_code_version, released_at, licenses_json",
        ") values (",
        "  "
        + ", ".join(
            _sql_literal(release[key])
            for key in (
                "dataset_release_version",
                "public_schema_version",
                "database_migration_version",
                "publication_batch_id",
                "projection_code_version",
                "released_at",
            )
        )
        + ", "
        + _sql_literal(_canonical_json(licenses)),
        ");",
    ]
    for record in records:
        lines.append(
            "insert into public_release_records "
            "(dataset_release_version, entity_type, entity_id, public_json) values ("
            f"{version}, {_sql_literal(record['entity_type'])}, {_sql_literal(record['id'])}, "
            f"{_sql_literal(_canonical_json(record['public']))});"
        )
    lines.extend(
        [
            "update public_release_pointer",
            "set dataset_release_version = "
            f"{version}, switched_at = {_sql_literal(release['released_at'])}",
            "where singleton = 1;",
            "commit;",
            "",
        ]
    )
    return "\n".join(lines)


def build_public_release(release_input: PublicReleaseInput) -> PublicRelease:
    dataset = release_input.source_state["dataset"]
    public_schema_version = str(dataset["public_schema_version"])
    if public_schema_version not in SUPPORTED_PUBLIC_SCHEMA_VERSIONS:
        raise ProjectionCompatibilityError(
            f"Unsupported Public Schema version: {public_schema_version}"
        )
    release = {
        "dataset_release_version": str(dataset["version"]),
        "public_schema_version": public_schema_version,
        "database_migration_version": release_input.database_migration_version,
        "publication_batch_id": release_input.publication_batch_id,
        "projection_code_version": release_input.projection_code_version,
        "released_at": _iso_z(release_input.released_at),
    }
    records = _project_records(release_input.source_state)
    records = _attach_public_media(records, public_schema_version)
    archive_records = [
        record for record in records if not record["entity_type"].startswith("api_")
    ]
    runtime = _runtime_api(release_input.source_state, release, records)
    runtime_records = _runtime_records(runtime)
    files = {
        "pandas.csv": _panda_csv(archive_records, release),
        "pandas.json": _panda_json(archive_records, release),
        "api.json": _canonical_json(runtime, pretty=True),
        "d1.sql": _d1_sql(
            [*archive_records, *runtime_records], release, dataset["licenses"]
        ),
    }
    counts = {
        entity_type: sum(
            record["entity_type"] == entity_type for record in archive_records
        )
        for entity_type in ENTITY_COLLECTIONS
    }
    counts.update(
        {
            entity_type: sum(record["entity_type"] == entity_type for record in runtime_records)
            for entity_type in (
                "api_pandas",
                "api_distribution",
                "api_habitats",
                "api_snapshots",
                "api_stats",
            )
        }
    )
    manifest_files = {
        filename: {
            "bytes": len(content.encode("utf-8")),
            "sha256": hashlib.sha256(content.encode("utf-8")).hexdigest(),
        }
        for filename, content in sorted(files.items())
    }
    manifest = {
        **release,
        "licenses": dataset["licenses"],
        "record_counts": counts,
        "files": manifest_files,
    }
    return PublicRelease(release_metadata=release, manifest=manifest, files=files)
