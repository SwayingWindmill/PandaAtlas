from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urlparse

import httpx

from .contracts import (
    CandidateKind,
    ConflictState,
    CurrentTrustedValue,
    FieldCandidate,
    IdentityMatchState,
    PandaIdentityMatch,
    SourceLocator,
    SourceLocatorKind,
)
from .contracts import (
    EvidenceSnapshot as BundleEvidenceSnapshot,
)
from .models import CapabilityMode, ResponseEnvelope
from .models import EvidenceSnapshot as LegacyEvidenceSnapshot
from .runner import AdapterParseContext, AdapterRequest
from .source_registry import ReviewedSource, SourceRegistry

SOURCE_ID = "wikimedia-commons-action-api"
ADAPTER_ID = "wikimedia-commons-xi-lun"
ADAPTER_VERSION = "1.0.0"
PARSER_NAME = "wikimedia-commons-imageinfo-xi-lun"
PARSER_VERSION = "1.0.0"
REQUEST_ID = "xi-lun-imageinfo"
DEFAULT_COHORT = "xi-lun-reviewed-media"
XI_LUN_FILE_TITLE = "File:Xi Lun at Zoo Atlanta.jpg"
DEFAULT_USER_AGENT = (
    "PandaAtlasBot/0.1 (https://github.com/SwayingWindmill/PandaAtlas; source metadata review)"
)
_IMAGEINFO_PROPERTIES = "timestamp|user|url|size|sha1|mime|extmetadata"
_EXTMETADATA_FILTER = (
    "ImageDescription|Artist|Credit|LicenseShortName|LicenseUrl|UsageTerms|"
    "AttributionRequired|DateTimeOriginal|Categories"
)
_ALLOWED_LICENSES = {
    "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0",
}
_SHA1_PATTERN = re.compile(r"^[0-9a-f]{40}$")
_DEFAULT_FIXTURE = (
    Path(__file__).resolve().parents[2]
    / "tests"
    / "acquisition"
    / "fixtures"
    / "commons-xi-lun-imageinfo.json"
)


@dataclass(frozen=True, slots=True)
class CommonsMediaCandidate:
    source_id: str
    panda_slug: str
    panda_name_zh: str
    panda_name_en: str
    file_title: str
    uploader: str
    uploaded_at: str
    original_url: str
    description_url: str
    width: int
    height: int
    bytes: int
    mime: str
    sha1: str
    description: str
    artist: str
    credit: str
    license_short_name: str
    license_url: str
    usage_terms: str
    attribution_required: bool
    captured_at_text: str
    categories: tuple[str, ...]
    review_state: str = "candidate"
    original_image_downloaded: bool = False

    def to_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["categories"] = list(self.categories)
        return result


@dataclass(frozen=True, slots=True)
class CommonsAdapterResult:
    source: ReviewedSource
    request_url: str
    user_agent: str
    evidence: LegacyEvidenceSnapshot
    candidate: CommonsMediaCandidate

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": 1,
            "operation": "wikimedia-commons-xi-lun-metadata",
            "outcome": "passed",
            "source": self.source.to_public_dict(),
            "request": {
                "url": self.request_url,
                "user_agent": self.user_agent,
                "browser_impersonation": False,
                "original_image_requested": False,
            },
            "evidence": self.evidence.to_dict(),
            "candidate": self.candidate.to_dict(),
            "publication_write_targets": [],
        }


@dataclass(frozen=True, slots=True)
class WikimediaCommonsXiLunAdapter:
    adapter_id: str = ADAPTER_ID
    adapter_version: str = ADAPTER_VERSION
    source_id: str = SOURCE_ID
    parser_name: str = PARSER_NAME
    parser_version: str = PARSER_VERSION
    default_cohort: str | None = DEFAULT_COHORT
    default_fixture: Path | None = _DEFAULT_FIXTURE

    def build_requests(
        self,
        source: ReviewedSource,
        *,
        cohort: str | None,
    ) -> tuple[AdapterRequest, ...]:
        del cohort
        return (
            AdapterRequest(
                request_id=REQUEST_ID,
                url=build_imageinfo_url(source, title=XI_LUN_FILE_TITLE),
            ),
        )

    def parse(self, context: AdapterParseContext) -> tuple[FieldCandidate, ...]:
        response = context.responses.get(REQUEST_ID)
        evidence = context.evidence_snapshots.get(REQUEST_ID)
        if response is None or evidence is None:
            raise ValueError("Commons adapter did not receive its planned response and evidence")
        policy = context.source.request_policy
        user_agent = policy.user_agent if policy is not None else DEFAULT_USER_AGENT
        candidate = _parse_xi_lun_candidate(
            context.source,
            response,
            request_url=response.requested_url,
            user_agent=user_agent,
        )
        return _to_field_candidates(candidate, evidence)


ADAPTER = WikimediaCommonsXiLunAdapter()


def build_imageinfo_url(source: ReviewedSource, *, title: str = XI_LUN_FILE_TITLE) -> str:
    source.assert_adapter_allowed(ADAPTER_ID)
    if source.source_id != SOURCE_ID or source.base_url is None:
        raise ValueError("Wikimedia adapter requires the reviewed Commons Action API source")
    parameters = {
        "action": "query",
        "format": "json",
        "formatversion": "2",
        "prop": "imageinfo",
        "titles": title,
        "iiprop": _IMAGEINFO_PROPERTIES,
        "iiextmetadatafilter": _EXTMETADATA_FILTER,
        "iiextmetadatalanguage": "en",
        "maxlag": "5",
    }
    url = f"{source.base_url}?{urlencode(parameters)}"
    _validate_request_target(source, url)
    return url


def validate_bot_user_agent(user_agent: str) -> None:
    normalized = " ".join(user_agent.split())
    if not normalized.startswith("PandaAtlasBot/"):
        raise ValueError("Wikimedia requests require a descriptive PandaAtlasBot User-Agent")
    if "https://github.com/SwayingWindmill/PandaAtlas" not in normalized:
        raise ValueError("Wikimedia User-Agent requires a repository contact URL")
    if "Mozilla/" in normalized or "Chrome/" in normalized:
        raise ValueError("Wikimedia bot requests must not impersonate a browser User-Agent")


def fetch_imageinfo(
    registry: SourceRegistry,
    *,
    title: str = XI_LUN_FILE_TITLE,
    user_agent: str = DEFAULT_USER_AGENT,
    timeout_seconds: float = 30,
) -> tuple[str, ResponseEnvelope]:
    source = registry.get(SOURCE_ID)
    source.assert_live_fetch_allowed()
    source.assert_adapter_allowed(ADAPTER_ID)
    validate_bot_user_agent(user_agent)
    policy = source.request_policy
    if policy is None or user_agent != policy.user_agent:
        raise ValueError("Wikimedia live requests must use the registry User-Agent")
    if timeout_seconds != policy.timeout_seconds:
        raise ValueError("Wikimedia live requests must use the registry timeout")
    request_url = build_imageinfo_url(source, title=title)

    with httpx.Client(
        headers={"User-Agent": user_agent, "Accept": policy.accept},
        timeout=timeout_seconds,
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
        raise ValueError("Wikimedia API rate limited the adapter; stop and back off")
    if response.status_code != 200:
        raise ValueError(f"Wikimedia API returned HTTP {response.status_code}")
    return request_url, envelope


def parse_xi_lun_result(
    registry: SourceRegistry,
    response: ResponseEnvelope,
    *,
    request_url: str | None = None,
    user_agent: str = DEFAULT_USER_AGENT,
) -> CommonsAdapterResult:
    source = registry.get(SOURCE_ID)
    source.assert_adapter_allowed(ADAPTER_ID)
    candidate = _parse_xi_lun_candidate(
        source,
        response,
        request_url=request_url or response.requested_url,
        user_agent=user_agent,
    )
    evidence = LegacyEvidenceSnapshot.from_response(
        engine=SOURCE_ID,
        engine_version="imageinfo-v1",
        response=response,
        block_state=_clear_block_state(),
        capability=CapabilityMode.PUBLIC_HTTP,
        selector_mode="structured-json-exact-title",
        notes=(
            "Metadata only; original image bytes were not requested.",
            "Candidate remains subject to curator identity and license review.",
        ),
    )
    return CommonsAdapterResult(
        source=source,
        request_url=request_url or response.requested_url,
        user_agent=user_agent,
        evidence=evidence,
        candidate=candidate,
    )


def _parse_xi_lun_candidate(
    source: ReviewedSource,
    response: ResponseEnvelope,
    *,
    request_url: str,
    user_agent: str,
) -> CommonsMediaCandidate:
    validate_bot_user_agent(user_agent)
    _validate_request_target(source, request_url)

    content_type = _header(response.headers, "content-type")
    if response.status != 200:
        raise ValueError(f"Commons fixture returned HTTP {response.status}")
    if "application/json" not in content_type.lower():
        raise ValueError("Commons response must be application/json")

    try:
        payload = json.loads(response.body)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("Commons response is not valid JSON") from error

    if payload.get("error") or payload.get("warnings"):
        raise ValueError("Commons response contains API errors or warnings")
    pages = (payload.get("query") or {}).get("pages") or []
    if len(pages) != 1:
        raise ValueError("Commons response must contain exactly one page")
    page = pages[0]
    if page.get("missing") is not None:
        raise ValueError("Xi Lun Commons file is missing")
    if page.get("title") != XI_LUN_FILE_TITLE:
        raise ValueError("Commons file title does not match Xi Lun")

    imageinfo = page.get("imageinfo") or []
    if len(imageinfo) != 1:
        raise ValueError("Commons response must contain exactly one image revision")
    info = imageinfo[0]
    metadata = info.get("extmetadata") or {}

    description = _metadata_text(metadata, "ImageDescription")
    artist = _metadata_text(metadata, "Artist")
    credit = _metadata_text(metadata, "Credit")
    license_short_name = _metadata_text(metadata, "LicenseShortName")
    license_url = _metadata_text(metadata, "LicenseUrl")
    usage_terms = _metadata_text(metadata, "UsageTerms")
    attribution_required = _metadata_bool(metadata, "AttributionRequired")
    captured_at_text = _metadata_text(metadata, "DateTimeOriginal")
    categories = tuple(
        item.strip() for item in _metadata_text(metadata, "Categories").split("|") if item.strip()
    )

    if "Xi Lun" not in description:
        raise ValueError("Commons description does not identify Xi Lun")
    uploader = _required_text(info, "user")
    if uploader not in artist:
        raise ValueError("Commons artist and uploader identities do not agree")
    expected_license_url = _ALLOWED_LICENSES.get(license_short_name)
    if expected_license_url is None or license_url != expected_license_url:
        raise ValueError("Commons file does not carry the reviewed reusable license")
    if not attribution_required:
        raise ValueError("Xi Lun Commons file must retain its attribution requirement")
    if credit != "Own work":
        raise ValueError("Xi Lun Commons credit drifted from the reviewed own-work record")

    original_url = _required_https_url(info, "url", host="upload.wikimedia.org")
    description_url = _required_https_url(info, "descriptionurl", host="commons.wikimedia.org")
    width = _positive_int(info, "width")
    height = _positive_int(info, "height")
    byte_count = _positive_int(info, "size")
    mime = _required_text(info, "mime")
    if mime != "image/jpeg":
        raise ValueError("Xi Lun Commons source MIME drifted")
    file_sha1 = _required_text(info, "sha1").lower()
    if not _SHA1_PATTERN.fullmatch(file_sha1):
        raise ValueError("Commons source SHA-1 is invalid")

    return CommonsMediaCandidate(
        source_id=SOURCE_ID,
        panda_slug="xi-lun",
        panda_name_zh="喜伦",
        panda_name_en="Xi Lun",
        file_title=XI_LUN_FILE_TITLE,
        uploader=uploader,
        uploaded_at=_required_text(info, "timestamp"),
        original_url=original_url,
        description_url=description_url,
        width=width,
        height=height,
        bytes=byte_count,
        mime=mime,
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
    )


def _to_field_candidates(
    candidate: CommonsMediaCandidate,
    evidence: BundleEvidenceSnapshot,
) -> tuple[FieldCandidate, ...]:
    identity = PandaIdentityMatch(
        state=IdentityMatchState.NOT_ATTEMPTED,
        source_identity=candidate.panda_slug,
        notes=(
            "The adapter preserves the reviewed Commons subject key; the shared "
            "reconciliation module owns the curation identity match.",
        ),
    )
    current = CurrentTrustedValue(present=False)
    values: tuple[tuple[str, Any, str], ...] = (
        ("media.file_title", candidate.file_title, "query.pages[0].title"),
        ("media.uploader", candidate.uploader, "query.pages[0].imageinfo[0].user"),
        ("media.uploaded_at", candidate.uploaded_at, "query.pages[0].imageinfo[0].timestamp"),
        ("media.original_url", candidate.original_url, "query.pages[0].imageinfo[0].url"),
        (
            "media.description_url",
            candidate.description_url,
            "query.pages[0].imageinfo[0].descriptionurl",
        ),
        ("media.width", candidate.width, "query.pages[0].imageinfo[0].width"),
        ("media.height", candidate.height, "query.pages[0].imageinfo[0].height"),
        ("media.bytes", candidate.bytes, "query.pages[0].imageinfo[0].size"),
        ("media.mime", candidate.mime, "query.pages[0].imageinfo[0].mime"),
        ("media.sha1", candidate.sha1, "query.pages[0].imageinfo[0].sha1"),
        (
            "media.description",
            candidate.description,
            "query.pages[0].imageinfo[0].extmetadata.ImageDescription.value",
        ),
        (
            "media.artist",
            candidate.artist,
            "query.pages[0].imageinfo[0].extmetadata.Artist.value",
        ),
        (
            "media.credit",
            candidate.credit,
            "query.pages[0].imageinfo[0].extmetadata.Credit.value",
        ),
        (
            "media.license_short_name",
            candidate.license_short_name,
            "query.pages[0].imageinfo[0].extmetadata.LicenseShortName.value",
        ),
        (
            "media.license_url",
            candidate.license_url,
            "query.pages[0].imageinfo[0].extmetadata.LicenseUrl.value",
        ),
        (
            "media.usage_terms",
            candidate.usage_terms,
            "query.pages[0].imageinfo[0].extmetadata.UsageTerms.value",
        ),
        (
            "media.attribution_required",
            candidate.attribution_required,
            "query.pages[0].imageinfo[0].extmetadata.AttributionRequired.value",
        ),
        (
            "media.captured_at_text",
            candidate.captured_at_text,
            "query.pages[0].imageinfo[0].extmetadata.DateTimeOriginal.value",
        ),
        (
            "media.categories",
            list(candidate.categories),
            "query.pages[0].imageinfo[0].extmetadata.Categories.value",
        ),
        (
            "media.original_image_downloaded",
            candidate.original_image_downloaded,
            "adapter-policy:metadata-only",
        ),
    )
    return tuple(
        FieldCandidate(
            source_id=SOURCE_ID,
            evidence_snapshot_id=evidence.snapshot_id,
            evidence_body_sha256=evidence.body_sha256,
            candidate_kind=CandidateKind.MEDIA_METADATA,
            subject_key=candidate.panda_slug,
            field_path=field_path,
            source_locator=SourceLocator(
                kind=(
                    SourceLocatorKind.DOCUMENT_SECTION
                    if locator.startswith("adapter-policy:")
                    else SourceLocatorKind.API_FIELD
                ),
                value=locator,
            ),
            raw_value=value,
            normalized_value=value,
            identity_match=identity,
            current_trusted_value=current,
            parser_name=PARSER_NAME,
            parser_version=PARSER_VERSION,
            conflict_state=ConflictState.NOT_COMPARED,
            notes=("Review candidate only; no trusted or public data was modified.",),
        )
        for field_path, value, locator in values
    )


def _validate_request_target(source: ReviewedSource, url: str) -> None:
    source.validate_request_target(url, live=False)


def _metadata_text(metadata: dict[str, Any], key: str) -> str:
    raw = metadata.get(key)
    if not isinstance(raw, dict) or not str(raw.get("value") or "").strip():
        raise ValueError(f"Commons metadata field {key} is missing")
    return _html_to_text(str(raw["value"]))


def _metadata_bool(metadata: dict[str, Any], key: str) -> bool:
    value = _metadata_text(metadata, key).lower()
    if value not in {"true", "false"}:
        raise ValueError(f"Commons metadata field {key} is not Boolean")
    return value == "true"


def _required_text(mapping: dict[str, Any], key: str) -> str:
    value = str(mapping.get(key) or "").strip()
    if not value:
        raise ValueError(f"Commons imageinfo field {key} is missing")
    return value


def _positive_int(mapping: dict[str, Any], key: str) -> int:
    try:
        value = int(mapping[key])
    except (KeyError, TypeError, ValueError) as error:
        raise ValueError(f"Commons imageinfo field {key} is invalid") from error
    if value <= 0:
        raise ValueError(f"Commons imageinfo field {key} must be positive")
    return value


def _required_https_url(mapping: dict[str, Any], key: str, *, host: str) -> str:
    value = _required_text(mapping, key)
    parsed = urlparse(value)
    if parsed.scheme != "https" or parsed.hostname != host:
        raise ValueError(f"Commons imageinfo field {key} has an unexpected host")
    return value


def _header(headers: Any, key: str) -> str:
    for header, value in headers.items():
        if str(header).lower() == key.lower():
            return str(value)
    return ""


def _html_to_text(value: str) -> str:
    parser = _TextExtractor()
    parser.feed(unescape(value))
    parser.close()
    return " ".join("".join(parser.parts).split())


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def _clear_block_state():
    from .models import BlockState

    return BlockState.CLEAR
