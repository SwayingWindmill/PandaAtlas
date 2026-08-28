from __future__ import annotations

import hashlib
import json
import re
from dataclasses import asdict, dataclass
from html import unescape
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urlencode

import httpx

from .models import ResponseEnvelope
from .source_registry import ReviewedSource, SourceRegistry
from .wikimedia_commons import DEFAULT_USER_AGENT, SOURCE_ID, validate_bot_user_agent

ADAPTER_ID = "wikimedia-commons-media-discovery"
ADAPTER_VERSION = "1.0.0"
MAX_RESULTS = 5
SUPPORTED_PROFILE_IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp"}
_IMAGEINFO_PROPERTIES = "timestamp|user|url|size|sha1|mime|extmetadata"
_EXTMETADATA_FILTER = (
    "ImageDescription|Artist|Credit|LicenseShortName|LicenseUrl|UsageTerms|"
    "AttributionRequired|DateTimeOriginal|Categories"
)
_QUERY_PATTERN = re.compile(
    r'^"[^"]{1,160}" (?:giant panda|Smithsonian panda|大熊猫)$'
)
_SHA1_PATTERN = re.compile(r"^[0-9a-f]{40}$")
_OPEN_LICENSE_PREFIXES = ("CC BY", "CC BY-SA", "CC0")
_PUBLIC_DOMAIN_LABELS = {"Public domain", "PD", "PDM"}


class _PlainTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)

    def text(self) -> str:
        return " ".join(" ".join(self.parts).split())


@dataclass(frozen=True, slots=True)
class CommonsSearchTask:
    task_id: str
    panda_slug: str
    name_zh: str | None
    name_en: str
    query: str
    query_locale: str
    max_results: int = MAX_RESULTS

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> CommonsSearchTask:
        task = cls(
            task_id=_required_text(value, "task_id"),
            panda_slug=_required_text(value, "panda_slug"),
            name_zh=_optional_text(value.get("name_zh")),
            name_en=_required_text(value, "name_en"),
            query=_required_text(value, "query"),
            query_locale=_required_text(value, "query_locale"),
            max_results=_positive_int(value, "max_results"),
        )
        task.validate()
        return task

    def validate(self) -> None:
        if self.query_locale not in {"en", "zh"}:
            raise ValueError("Commons media search task locale must be en or zh")
        if "\n" in self.query or "\r" in self.query or not _QUERY_PATTERN.fullmatch(self.query):
            raise ValueError("Commons media search query is outside the reviewed name-only form")
        if self.max_results < 1 or self.max_results > MAX_RESULTS:
            raise ValueError(f"Commons media search returns at most {MAX_RESULTS} results")


@dataclass(frozen=True, slots=True)
class CommonsDiscoveredMedia:
    candidate_id: str
    source_id: str
    adapter_id: str
    task_id: str
    panda_slug: str
    panda_name_zh: str | None
    panda_name_en: str
    query: str
    search_rank: int
    file_title: str
    uploader: str
    uploaded_at: str
    original_url: str
    description_url: str
    width: int
    height: int
    bytes: int
    mime: str
    profile_image_eligible: bool
    sha1: str
    description: str
    artist: str
    credit: str
    license_short_name: str
    license_url: str
    usage_terms: str
    attribution_required: bool | None
    captured_at_text: str
    categories: tuple[str, ...]
    identity_confidence: float
    identity_basis: str
    rights_state: str
    rights_confidence: float
    rights_basis: str
    review_state: str = "candidate"
    original_image_downloaded: bool = False

    def to_dict(self) -> dict[str, Any]:
        value = asdict(self)
        value["categories"] = list(self.categories)
        return value


@dataclass(frozen=True, slots=True)
class CommonsDiscoveryResult:
    task: CommonsSearchTask
    request_url: str
    response_sha256: str
    continuation_available: bool
    candidates: tuple[CommonsDiscoveredMedia, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": 1,
            "operation": "wikimedia-commons-media-discovery",
            "outcome": "passed",
            "task": asdict(self.task),
            "request": {
                "url": self.request_url,
                "browser_impersonation": False,
                "original_image_requested": False,
                "continuation_requested": False,
            },
            "response_sha256": self.response_sha256,
            "continuation_available": self.continuation_available,
            "candidate_count": len(self.candidates),
            "candidates": [candidate.to_dict() for candidate in self.candidates],
            "publication_write_targets": [],
        }


def build_search_url(source: ReviewedSource, task: CommonsSearchTask) -> str:
    task.validate()
    source.assert_adapter_allowed(ADAPTER_ID)
    if source.source_id != SOURCE_ID or source.base_url is None:
        raise ValueError("Commons discovery requires the reviewed Action API source")
    parameters = {
        "action": "query",
        "format": "json",
        "formatversion": "2",
        "generator": "search",
        "gsrsearch": task.query,
        "gsrnamespace": "6",
        "gsrlimit": str(task.max_results),
        "prop": "imageinfo",
        "iiprop": _IMAGEINFO_PROPERTIES,
        "iiextmetadatafilter": _EXTMETADATA_FILTER,
        "iiextmetadatalanguage": "en",
        "maxlag": "5",
    }
    url = f"{source.base_url}?{urlencode(parameters)}"
    source.validate_request_target(url, live=False)
    return url


def fetch_search(
    registry: SourceRegistry,
    task: CommonsSearchTask,
    *,
    user_agent: str = DEFAULT_USER_AGENT,
) -> tuple[str, ResponseEnvelope]:
    source = registry.get(SOURCE_ID)
    source.assert_live_fetch_allowed()
    source.assert_adapter_allowed(ADAPTER_ID)
    validate_bot_user_agent(user_agent)
    policy = source.request_policy
    if policy is None or user_agent != policy.user_agent:
        raise ValueError("Commons live discovery must use the registry User-Agent")
    request_url = build_search_url(source, task)
    source.validate_request_target(request_url, live=True)
    with httpx.Client(
        headers={"User-Agent": user_agent, "Accept": policy.accept},
        timeout=policy.timeout_seconds,
        follow_redirects=False,
        cookies=None,
    ) as client:
        response = client.get(request_url)
    envelope = ResponseEnvelope(
        requested_url=request_url,
        final_url=str(response.url),
        status=response.status_code,
        headers=dict(response.headers),
        body=response.content,
    )
    if response.status_code == 429:
        raise ValueError("Wikimedia API rate limited media discovery; stop and back off")
    if response.status_code != 200:
        raise ValueError(f"Wikimedia media discovery returned HTTP {response.status_code}")
    return request_url, envelope


def parse_search_response(
    registry: SourceRegistry,
    task: CommonsSearchTask,
    response: ResponseEnvelope,
    *,
    request_url: str | None = None,
) -> CommonsDiscoveryResult:
    source = registry.get(SOURCE_ID)
    source.assert_adapter_allowed(ADAPTER_ID)
    expected_url = build_search_url(source, task)
    actual_url = request_url or response.requested_url
    if actual_url != expected_url or response.final_url != expected_url:
        raise ValueError("Commons media discovery request URL drifted")
    if response.status != 200:
        raise ValueError(f"Commons media discovery fixture returned HTTP {response.status}")
    content_type = _header(response.headers, "content-type")
    if "application/json" not in content_type.lower():
        raise ValueError("Commons media discovery response must be application/json")
    try:
        payload = json.loads(response.body)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("Commons media discovery response is not valid JSON") from error
    if payload.get("error") or payload.get("warnings"):
        raise ValueError("Commons media discovery response contains API errors or warnings")

    pages = (payload.get("query") or {}).get("pages") or []
    if len(pages) > task.max_results:
        raise ValueError("Commons media discovery exceeded the reviewed result limit")
    ordered_pages = sorted(
        pages,
        key=lambda item: (item.get("index", 10_000), item.get("title", "")),
    )
    candidates = tuple(_parse_page(task, page) for page in ordered_pages)
    return CommonsDiscoveryResult(
        task=task,
        request_url=actual_url,
        response_sha256=hashlib.sha256(response.body).hexdigest(),
        continuation_available=bool(payload.get("continue")),
        candidates=candidates,
    )


def _parse_page(task: CommonsSearchTask, page: dict[str, Any]) -> CommonsDiscoveredMedia:
    title = _required_text(page, "title")
    if not title.startswith("File:"):
        raise ValueError("Commons media discovery result is outside the File namespace")
    rank = _positive_int(page, "index")
    imageinfo = page.get("imageinfo") or []
    if len(imageinfo) != 1:
        raise ValueError("Commons media discovery result must contain one image revision")
    info = imageinfo[0]
    metadata = info.get("extmetadata") or {}
    description = _metadata_text(metadata, "ImageDescription")
    artist = _metadata_text(metadata, "Artist")
    credit = _metadata_text(metadata, "Credit")
    license_short_name = _metadata_text(metadata, "LicenseShortName")
    license_url = _metadata_text(metadata, "LicenseUrl")
    usage_terms = _metadata_text(metadata, "UsageTerms")
    attribution_required = _metadata_optional_bool(metadata, "AttributionRequired")
    captured_at_text = _metadata_text(metadata, "DateTimeOriginal")
    categories = tuple(
        item.strip()
        for item in _metadata_text(metadata, "Categories").split("|")
        if item.strip()
    )
    identity_confidence, identity_basis = _identity_assessment(task, title, description)
    rights_state, rights_confidence, rights_basis = _rights_assessment(
        license_short_name, license_url, usage_terms
    )
    mime = _required_text(info, "mime")
    file_sha1 = _required_text(info, "sha1").lower()
    if not _SHA1_PATTERN.fullmatch(file_sha1):
        raise ValueError("Commons media discovery SHA-1 is invalid")
    candidate_identity = "\0".join([task.panda_slug, title, file_sha1]).encode("utf-8")
    candidate_id = f"commons-candidate-{hashlib.sha256(candidate_identity).hexdigest()[:24]}"
    return CommonsDiscoveredMedia(
        candidate_id=candidate_id,
        source_id=SOURCE_ID,
        adapter_id=ADAPTER_ID,
        task_id=task.task_id,
        panda_slug=task.panda_slug,
        panda_name_zh=task.name_zh,
        panda_name_en=task.name_en,
        query=task.query,
        search_rank=rank,
        file_title=title,
        uploader=_required_text(info, "user"),
        uploaded_at=_required_text(info, "timestamp"),
        original_url=_required_https_url(info, "url", "upload.wikimedia.org"),
        description_url=_required_https_url(info, "descriptionurl", "commons.wikimedia.org"),
        width=_positive_int(info, "width"),
        height=_positive_int(info, "height"),
        bytes=_positive_int(info, "size"),
        mime=mime,
        profile_image_eligible=mime in SUPPORTED_PROFILE_IMAGE_MIMES,
        sha1=file_sha1,
        description=description,
        artist=artist,
        credit=credit,
        license_short_name=license_short_name,
        license_url=license_url,
        usage_terms=usage_terms,
        attribution_required=attribution_required,
        captured_at_text=captured_at_text,
        categories=categories,
        identity_confidence=identity_confidence,
        identity_basis=identity_basis,
        rights_state=rights_state,
        rights_confidence=rights_confidence,
        rights_basis=rights_basis,
    )


def _identity_assessment(
    task: CommonsSearchTask, file_title: str, description: str
) -> tuple[float, str]:
    title = _normalized(file_title.removeprefix("File:"))
    body = _normalized(description)
    english = _normalized(task.name_en)
    chinese = _normalized(task.name_zh or "")
    title_match = bool(english and english in title) or bool(chinese and chinese in title)
    body_match = bool(english and english in body) or bool(chinese and chinese in body)
    requires_smithsonian = task.query.endswith(" Smithsonian panda")
    context_match = any(
        marker in f"{title} {body}"
        for marker in ("smithsonian", "national zoo", "washington dc", "washington d c")
    )
    if requires_smithsonian and not context_match:
        if title_match or body_match:
            return 0.45, "canonical-name-without-reviewed-institution-context"
        return 0.20, "search-result-without-reviewed-name-or-institution-context"
    if title_match and body_match:
        return 0.95, "canonical-name-in-title-and-description"
    if title_match:
        return 0.85, "canonical-name-in-title"
    if body_match:
        return 0.75, "canonical-name-in-description"
    return 0.25, "search-result-without-canonical-name-evidence"


def _rights_assessment(
    license_name: str, license_url: str, usage_terms: str
) -> tuple[str, float, str]:
    if license_name in _PUBLIC_DOMAIN_LABELS:
        return "public_domain", 0.95, "commons-public-domain-metadata"
    if license_name == "CC0" and "public domain" in usage_terms.casefold():
        return "public_domain", 0.95, "commons-cc0-public-domain-dedication"
    if license_name.startswith(_OPEN_LICENSE_PREFIXES) and license_url.startswith(
        ("https://", "http://")
    ):
        return "open_license", 0.95, "commons-open-license-metadata"
    if license_name:
        return "restricted_or_unrecognized", 0.60, "commons-license-not-in-open-allowlist"
    return "unknown", 0.20, "commons-license-metadata-missing"


def _normalized(value: str) -> str:
    return " ".join(value.casefold().replace("_", " ").replace("-", " ").split())


def _metadata_text(metadata: dict[str, Any], key: str) -> str:
    value = metadata.get(key)
    if not isinstance(value, dict):
        return ""
    raw = value.get("value")
    if raw is None:
        return ""
    parser = _PlainTextParser()
    parser.feed(unescape(str(raw)))
    parser.close()
    return parser.text()


def _metadata_optional_bool(metadata: dict[str, Any], key: str) -> bool | None:
    text = _metadata_text(metadata, key).strip().lower()
    if not text:
        return None
    if text in {"true", "1", "yes"}:
        return True
    if text in {"false", "0", "no"}:
        return False
    raise ValueError(f"Commons metadata {key} is not boolean")


def _required_text(value: dict[str, Any], key: str) -> str:
    raw = value.get(key)
    if raw is None or not str(raw).strip():
        raise ValueError(f"Commons media discovery field {key} is required")
    return str(raw).strip()


def _optional_text(value: Any) -> str | None:
    if value is None or not str(value).strip():
        return None
    return str(value).strip()


def _positive_int(value: dict[str, Any], key: str) -> int:
    raw = value.get(key)
    if isinstance(raw, bool):
        raise ValueError(f"Commons media discovery field {key} must be a positive integer")
    try:
        parsed = int(raw)
    except (TypeError, ValueError) as error:
        raise ValueError(
            f"Commons media discovery field {key} must be a positive integer"
        ) from error
    if parsed <= 0:
        raise ValueError(f"Commons media discovery field {key} must be positive")
    return parsed


def _required_https_url(value: dict[str, Any], key: str, host: str) -> str:
    from urllib.parse import urlparse

    url = _required_text(value, key)
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != host:
        raise ValueError(f"Commons media discovery field {key} is outside {host}")
    return url


def _header(headers: dict[str, str], name: str) -> str:
    lowered = name.lower()
    for key, value in headers.items():
        if key.lower() == lowered:
            return value
    return ""
