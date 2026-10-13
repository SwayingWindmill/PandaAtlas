// Family-story detail pages still resolve members, events, assertions and sources from the
// reviewed V1 snapshot and evidence modules.
import {
  TRUSTED_PUBLIC_EVENTS,
  TRUSTED_PUBLIC_SOURCES,
} from "@/lib/generated/public-experience-evidence";
import {
  TRUSTED_PANDA_DETAILS,
  TRUSTED_PARENTAGE_ASSERTIONS,
} from "@/lib/generated/trusted-identity-aliases";
import type {
  PandaDetail,
  PandaDomainEventSummary,
  PublicFamilyStoryRecord,
  PublicParentageAssertionSummary,
  PublicSourceSummary,
} from "@/lib/types";

export interface PublicMomentOccurrence {
  id: string;
  occurrenceKind: "source_event" | "derived_anniversary";
  eventType: string;
  eventStatus: string;
  occurrenceDate: string;
  sourceEventId: string;
  anniversaryYear: number | null;
  participants: PandaDetail[];
  sourceIds: string[];
  fromFacilityId: string | null;
  fromCoarseLocation: string | null;
  toFacilityId: string | null;
  toCoarseLocation: string | null;
}

const pandaById = new Map(TRUSTED_PANDA_DETAILS.map((panda) => [panda.id, panda]));
const eventById = new Map(TRUSTED_PUBLIC_EVENTS.map((event) => [event.id, event]));
const sourceById = new Map(TRUSTED_PUBLIC_SOURCES.map((source) => [source.id, source]));
const assertionById = new Map(
  TRUSTED_PARENTAGE_ASSERTIONS.map((assertion) => [assertion.id, assertion]),
);

function sourceOccurrence(event: PandaDomainEventSummary): PublicMomentOccurrence {
  return {
    id: event.id,
    occurrenceKind: "source_event",
    eventType: event.event_type,
    eventStatus: event.event_status,
    occurrenceDate: event.event_date,
    sourceEventId: event.id,
    anniversaryYear: null,
    participants: event.participants
      .map((participantId) => pandaById.get(participantId))
      .filter((panda): panda is PandaDetail => Boolean(panda)),
    sourceIds: event.source_ids,
    fromFacilityId: event.from_facility_id,
    fromCoarseLocation: event.from_coarse_location,
    toFacilityId: event.to_facility_id,
    toCoarseLocation: event.to_coarse_location,
  };
}

export interface MomentQuery {
  year?: number;
  month?: number;
  panda?: string;
  eventType?: string;
  includeAnniversaries?: boolean;
  sort?: "date_asc" | "date_desc";
}

export function familyStoryMembers(story: PublicFamilyStoryRecord): PandaDetail[] {
  return story.member_ids
    .map((memberId) => pandaById.get(memberId))
    .filter((panda): panda is PandaDetail => Boolean(panda));
}

export function familyStoryEvents(story: PublicFamilyStoryRecord): PublicMomentOccurrence[] {
  return [...new Set(story.chapters.flatMap((chapter) => chapter.event_ids))]
    .map((eventId) => eventById.get(eventId))
    .filter((event): event is PandaDomainEventSummary => Boolean(event))
    .map(sourceOccurrence)
    .sort((left, right) => left.occurrenceDate.localeCompare(right.occurrenceDate));
}

export function familyStoryAssertions(
  story: PublicFamilyStoryRecord,
): PublicParentageAssertionSummary[] {
  return story.relationship_assertion_ids
    .map((assertionId) => assertionById.get(assertionId))
    .filter((assertion): assertion is PublicParentageAssertionSummary => Boolean(assertion));
}

export function familyStorySources(story: PublicFamilyStoryRecord): PublicSourceSummary[] {
  return story.source_ids
    .map((sourceId) => sourceById.get(sourceId))
    .filter((source): source is PublicSourceSummary => Boolean(source));
}
