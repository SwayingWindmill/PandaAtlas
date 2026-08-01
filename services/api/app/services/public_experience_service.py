from __future__ import annotations

from collections import Counter
from datetime import date
from typing import Any

from fastapi import HTTPException

from app.schemas.panda import PaginationMeta, PandaDetail, PublicSourceSummary
from app.schemas.public_experience import (
    PublicFamilyStoryListResponse,
    PublicFamilyStoryResponse,
    PublicFamilyStorySummary,
    PublicMomentFacets,
    PublicMomentOccurrence,
    PublicMomentParticipant,
    PublicMomentsResponse,
    PublicParentageAssertion,
    PublicProfileModuleId,
    PublicProfileModuleSummary,
    PublicProfileV2Response,
)
from app.services.release_read_service import get_release_panda
from app.services.release_service import get_current_api_release


def _payload() -> dict[str, Any]:
    return get_current_api_release()


def _release(payload: dict[str, Any]) -> dict[str, str]:
    release = payload.get("release")
    if not isinstance(release, dict):
        raise HTTPException(status_code=503, detail="Public release metadata unavailable")
    return {str(key): str(value) for key, value in release.items() if value is not None}


def _pandas(payload: dict[str, Any]) -> list[PandaDetail]:
    return [PandaDetail.model_validate(item) for item in payload.get("pandas", [])]


def _matches_reference(detail: PandaDetail, reference: str) -> bool:
    normalized = reference.strip().lower()
    values = {str(detail.id).lower(), detail.slug.lower()}
    if detail.identity:
        values.add(detail.identity.canonical_slug.lower())
        values.update(item.value.lower() for item in detail.identity.legacy_slugs)
        values.update(item.value.lower() for item in detail.identity.external_identifiers)
        values.update(
            f"{item.system}:{item.value}".lower() for item in detail.identity.external_identifiers
        )
    return normalized in values


def _parentage(
    payload: dict[str, Any], pandas: list[PandaDetail]
) -> list[PublicParentageAssertion]:
    supplied = payload.get("parentage_assertions")
    if isinstance(supplied, list):
        return [PublicParentageAssertion.model_validate(item) for item in supplied]

    # Compatibility for releases before Public Schema 1.3.0. Flat parent fields were
    # projected only from confirmed assertions; no tentative or disputed status is inferred.
    assertions: list[PublicParentageAssertion] = []
    published_ids = {row.id for row in pandas}
    for panda in pandas:
        for role, parent_id in (("father", panda.father_id), ("mother", panda.mother_id)):
            if parent_id is None or parent_id not in published_ids:
                continue
            assertions.append(
                PublicParentageAssertion(
                    id=f"compat-{panda.id}-{role}",
                    child_id=panda.id,
                    parent_id=parent_id,
                    role=role,
                    status="confirmed",
                    source_ids=[],
                )
            )
    return assertions


def _events(payload: dict[str, Any], pandas: list[PandaDetail]) -> list[dict[str, Any]]:
    supplied = payload.get("events")
    if isinstance(supplied, list):
        by_id = {str(item["id"]): dict(item) for item in supplied}
        return [by_id[key] for key in sorted(by_id)]
    by_id: dict[str, dict[str, Any]] = {}
    for panda in pandas:
        for event in panda.events:
            by_id[event.id] = event.model_dump(mode="json")
    return [by_id[key] for key in sorted(by_id)]


def _source_summaries(
    payload: dict[str, Any], pandas: list[PandaDetail]
) -> list[PublicSourceSummary]:
    supplied = payload.get("sources")
    if isinstance(supplied, list):
        return [PublicSourceSummary.model_validate(item) for item in supplied]
    by_id = {source.id: source for panda in pandas for source in panda.sources}
    return [by_id[key] for key in sorted(by_id)]


def _participant(panda: PandaDetail) -> PublicMomentParticipant:
    return PublicMomentParticipant(
        id=panda.id,
        slug=panda.slug,
        name_zh=panda.name_zh,
        name_en=panda.name_en,
        profile_available=bool(panda.identity and panda.public_revision),
    )


def _source_occurrence(
    event: dict[str, Any], by_id: dict[str, PandaDetail]
) -> PublicMomentOccurrence:
    participants = [
        _participant(by_id[participant_id])
        for participant_id in event.get("participants", [])
        if participant_id in by_id
    ]
    return PublicMomentOccurrence(
        id=str(event["id"]),
        occurrence_kind="source_event",
        event_type=str(event["event_type"]),
        event_status=str(event["event_status"]),
        occurrence_date=event["event_date"],
        date_precision=event.get("event_date_precision", "day"),
        source_event_id=str(event["id"]),
        participants=participants,
        from_facility_id=event.get("from_facility_id"),
        from_coarse_location=event.get("from_coarse_location"),
        to_facility_id=event.get("to_facility_id"),
        to_coarse_location=event.get("to_coarse_location"),
        source_ids=event.get("source_ids", []),
        changes_current_residency=bool(event.get("changes_current_residency")),
    )


def _anniversary_occurrences(
    source_events: list[PublicMomentOccurrence],
    *,
    target_year: int,
    date_from: date | None,
    date_to: date | None,
) -> list[PublicMomentOccurrence]:
    anniversaries: list[PublicMomentOccurrence] = []
    for event in source_events:
        if event.event_type != "birth" or event.date_precision != "day":
            continue
        source_date = event.occurrence_date
        if target_year <= source_date.year:
            continue
        try:
            occurrence_date = source_date.replace(year=target_year)
        except ValueError:
            # A February 29 birthday is represented on February 28 in non-leap years.
            occurrence_date = date(target_year, 2, 28)
        if date_from and occurrence_date < date_from:
            continue
        if date_to and occurrence_date > date_to:
            continue
        anniversaries.append(
            PublicMomentOccurrence(
                id=f"anniversary:{event.id}:{target_year}",
                occurrence_kind="derived_anniversary",
                event_type="birth_anniversary",
                event_status="derived",
                occurrence_date=occurrence_date,
                date_precision="day",
                source_event_id=event.id,
                anniversary_year=target_year,
                participants=event.participants,
                source_ids=event.source_ids,
            )
        )
    return anniversaries


def _facets(items: list[PublicMomentOccurrence]) -> PublicMomentFacets:
    return PublicMomentFacets(
        event_types=dict(sorted(Counter(item.event_type for item in items).items())),
        event_statuses=dict(sorted(Counter(item.event_status for item in items).items())),
        pandas=dict(
            sorted(
                Counter(
                    participant.slug for item in items for participant in item.participants
                ).items()
            )
        ),
        years=dict(sorted(Counter(str(item.occurrence_date.year) for item in items).items())),
    )


def list_public_moments(
    *,
    page: int,
    page_size: int,
    date_from: date | None,
    date_to: date | None,
    year: int | None,
    panda_ref: str | None,
    event_type: str | None,
    event_status: str | None,
    include_anniversaries: bool,
    sort: str,
) -> PublicMomentsResponse:
    payload = _payload()
    pandas = _pandas(payload)
    by_id = {str(panda.id): panda for panda in pandas}
    source_events = [_source_occurrence(event, by_id) for event in _events(payload, pandas)]

    if panda_ref:
        panda = next((item for item in pandas if _matches_reference(item, panda_ref)), None)
        if panda is None:
            raise HTTPException(status_code=404, detail="Panda not found in current public release")
        source_events = [
            item
            for item in source_events
            if any(participant.id == panda.id for participant in item.participants)
        ]
    if event_type:
        source_events = [item for item in source_events if item.event_type == event_type]
    if event_status:
        source_events = [item for item in source_events if item.event_status == event_status]
    if year is not None:
        source_events = [item for item in source_events if item.occurrence_date.year == year]
    if date_from:
        source_events = [item for item in source_events if item.occurrence_date >= date_from]
    if date_to:
        source_events = [item for item in source_events if item.occurrence_date <= date_to]

    items = list(source_events)
    if include_anniversaries:
        target_year = year or (date_from.year if date_from else date.today().year)
        anniversaries = _anniversary_occurrences(
            [_source_occurrence(event, by_id) for event in _events(payload, pandas)],
            target_year=target_year,
            date_from=date_from,
            date_to=date_to,
        )
        if panda_ref:
            panda = next(item for item in pandas if _matches_reference(item, panda_ref))
            anniversaries = [
                item
                for item in anniversaries
                if any(participant.id == panda.id for participant in item.participants)
            ]
        items.extend(anniversaries)

    reverse = sort == "date_desc"
    items.sort(key=lambda item: (item.occurrence_date, item.id), reverse=reverse)
    source_event_total = len(
        {item.source_event_id for item in items if item.occurrence_kind == "source_event"}
    )
    derived_total = sum(item.occurrence_kind == "derived_anniversary" for item in items)
    total = len(items)
    start = (page - 1) * page_size
    return PublicMomentsResponse(
        items=items[start : start + page_size],
        meta=PaginationMeta(page=page, page_size=page_size, total=total),
        facets=_facets(items),
        source_event_total=source_event_total,
        derived_occurrence_total=derived_total,
        coverage_state="complete" if payload.get("events") is not None else "partial",
        release=_release(payload),
    )


def _module(
    module_id: PublicProfileModuleId,
    state: str,
    item_count: int,
) -> PublicProfileModuleSummary:
    return PublicProfileModuleSummary(id=module_id, state=state, item_count=item_count)


def get_public_profile_v2(reference: str) -> PublicProfileV2Response:
    payload = _payload()
    panda = get_release_panda(reference)
    pandas = _pandas(payload)
    parentage = _parentage(payload, pandas)
    relationships = [
        assertion
        for assertion in parentage
        if assertion.child_id == panda.id or assertion.parent_id == panda.id
    ]
    non_final = any(assertion.status != "confirmed" for assertion in relationships)
    family_state = "empty" if not relationships else "partial" if non_final else "complete"
    timeline_count = len(panda.events) + len(panda.residencies)
    timeline_state = (
        "empty"
        if timeline_count == 0
        else ("complete" if panda.record_tier == "complete_first_pass" else "partial")
    )
    footprint_state = (
        "empty"
        if not panda.residencies
        else (
            "partial"
            if any(item.status == "provisional" for item in panda.residencies)
            else "complete"
        )
    )
    media_state = "unavailable"
    if panda.media_release:
        if panda.media_release.license_state == "licensed" and panda.media:
            media_state = "complete"
        elif panda.media_release.license_state in {"no_licensed_media", "source_link_only"}:
            media_state = "empty"
    story_state = "complete" if panda.localized_content else "unavailable"
    stories = payload.get("family_stories", [])
    family_story_slugs = sorted(
        str(story["slug"]) for story in stories if str(panda.id) in story.get("member_ids", [])
    )
    cohort = next(
        (
            str(item.get("state"))
            for item in payload.get("profile_cohort", [])
            if item.get("slug") == panda.slug
        ),
        "historic" if panda.status == "deceased" else "standard",
    )
    return PublicProfileV2Response(
        panda=panda,
        modules=[
            _module("overview", "complete", 1),
            _module("story", story_state, len(panda.localized_content)),
            _module("timeline", timeline_state, timeline_count),
            _module("family", family_state, len(relationships)),
            _module("footprint", footprint_state, len(panda.residencies)),
            _module("media", media_state, len(panda.media)),
            _module("sources", "complete" if panda.sources else "empty", len(panda.sources)),
            _module(
                "revisions",
                "complete" if panda.public_revision else "unavailable",
                1 if panda.public_revision else 0,
            ),
        ],
        parentage_assertions=relationships,
        facilities=list(payload.get("facilities", [])),
        places=list(payload.get("places", [])),
        institutions=list(payload.get("institutions", [])),
        family_story_slugs=family_story_slugs,
        moments_href=f"/moments?panda={panda.slug}",
        cohort_state=cohort,
        coverage_state="complete" if panda.record_tier == "complete_first_pass" else "partial",
        release=_release(payload),
    )


def _story_summaries(payload: dict[str, Any]) -> list[PublicFamilyStorySummary]:
    return [
        PublicFamilyStorySummary.model_validate(
            {
                key: story[key]
                for key in (
                    "id",
                    "slug",
                    "story_type",
                    "localized_content",
                    "scope",
                    "member_ids",
                    "source_ids",
                    "revision",
                )
            }
        )
        for story in payload.get("family_stories", [])
    ]


def list_public_family_stories(*, page: int, page_size: int) -> PublicFamilyStoryListResponse:
    payload = _payload()
    stories = sorted(_story_summaries(payload), key=lambda story: story.slug)
    total = len(stories)
    start = (page - 1) * page_size
    return PublicFamilyStoryListResponse(
        items=stories[start : start + page_size],
        meta=PaginationMeta(page=page, page_size=page_size, total=total),
        release=_release(payload),
    )


def get_public_family_story(reference: str) -> PublicFamilyStoryResponse:
    payload = _payload()
    raw = next(
        (
            story
            for story in payload.get("family_stories", [])
            if reference in {str(story.get("id")), str(story.get("slug"))}
        ),
        None,
    )
    if raw is None:
        raise HTTPException(
            status_code=404, detail="Family story not found in current public release"
        )
    pandas = _pandas(payload)
    by_id = {str(panda.id): panda for panda in pandas}
    parentage = {item.id: item for item in _parentage(payload, pandas)}
    events = {str(item["id"]): item for item in _events(payload, pandas)}
    sources = {source.id: source for source in _source_summaries(payload, pandas)}
    member_ids = [str(member_id) for member_id in raw.get("member_ids", [])]
    relationship_ids = [str(item) for item in raw.get("relationship_assertion_ids", [])]
    event_ids = list(
        dict.fromkeys(
            str(event_id)
            for chapter in raw.get("chapters", [])
            for event_id in chapter.get("event_ids", [])
        )
    )
    return PublicFamilyStoryResponse.model_validate(
        {
            **raw,
            "members": [
                by_id[member_id].model_dump(mode="json")
                for member_id in member_ids
                if member_id in by_id
            ],
            "relationships": [
                parentage[item].model_dump(mode="json")
                for item in relationship_ids
                if item in parentage
            ],
            "events": [
                _source_occurrence(events[event_id], by_id).model_dump(mode="json")
                for event_id in event_ids
                if event_id in events
            ],
            "sources": [
                sources[source_id].model_dump(mode="json")
                for source_id in raw.get("source_ids", [])
                if source_id in sources
            ],
        }
    )
