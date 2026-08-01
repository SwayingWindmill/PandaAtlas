import {
  PUBLIC_EXPERIENCE_RELEASE,
  TRUSTED_FAMILY_STORIES,
  TRUSTED_PROFILE_COHORT,
  TRUSTED_PUBLIC_EVENTS,
  TRUSTED_PUBLIC_SOURCES,
} from "@/lib/generated/public-experiences";
import {
  TRUSTED_PANDA_DETAILS,
  TRUSTED_PARENTAGE_ASSERTIONS,
} from "@/lib/generated/trusted-identity-aliases";
import type {
  LocalizedEditorialContent,
  PandaDetail,
  PandaDomainEventSummary,
  PublicFamilyStoryRecord,
  PublicParentageAssertionSummary,
  PublicProfileCohortRecord,
  PublicSourceSummary,
} from "@/lib/types";

export type PublicExperienceLocale = "zh" | "en";

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

export const publicExperienceRelease = PUBLIC_EXPERIENCE_RELEASE;

const pandaById = new Map(TRUSTED_PANDA_DETAILS.map((panda) => [panda.id, panda]));
const pandaBySlug = new Map(TRUSTED_PANDA_DETAILS.map((panda) => [panda.slug, panda]));
const eventById = new Map(TRUSTED_PUBLIC_EVENTS.map((event) => [event.id, event]));
const sourceById = new Map(TRUSTED_PUBLIC_SOURCES.map((source) => [source.id, source]));
const assertionById = new Map(
  TRUSTED_PARENTAGE_ASSERTIONS.map((assertion) => [assertion.id, assertion]),
);

export function localizedEditorial(
  content: LocalizedEditorialContent[],
  locale: PublicExperienceLocale,
): LocalizedEditorialContent {
  const preferred = locale === "zh" ? "zh-CN" : "en";
  return content.find((item) => item.locale === preferred)
    ?? content.find((item) => item.locale === "en")
    ?? content[0]
    ?? { locale: preferred, title: "", summary: "" };
}

export function getPublicPanda(reference: string): PandaDetail | null {
  return pandaBySlug.get(reference)
    ?? TRUSTED_PANDA_DETAILS.find(
      (panda) => panda.id === reference
        || panda.identity?.legacy_slugs.some((item) => item.value === reference),
    )
    ?? null;
}

export function getProfileCohortState(slug: string): PublicProfileCohortRecord["state"] {
  return TRUSTED_PROFILE_COHORT.find((item) => item.slug === slug)?.state ?? "standard";
}

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

function anniversaryOccurrence(
  event: PandaDomainEventSummary,
  targetYear: number,
): PublicMomentOccurrence | null {
  if (event.event_type !== "birth" || event.event_date_precision !== "day") return null;
  const sourceDate = new Date(`${event.event_date}T00:00:00Z`);
  if (targetYear <= sourceDate.getUTCFullYear()) return null;
  const month = sourceDate.getUTCMonth();
  const day = sourceDate.getUTCDate();
  const candidate = new Date(Date.UTC(targetYear, month, day));
  const occurrenceDate = candidate.getUTCMonth() === month
    ? candidate.toISOString().slice(0, 10)
    : `${targetYear}-02-28`;
  return {
    ...sourceOccurrence(event),
    id: `anniversary:${event.id}:${targetYear}`,
    occurrenceKind: "derived_anniversary",
    eventType: "birth_anniversary",
    eventStatus: "derived",
    occurrenceDate,
    sourceEventId: event.id,
    anniversaryYear: targetYear,
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

export function listPublicMoments(query: MomentQuery = {}): PublicMomentOccurrence[] {
  const sourceEvents = TRUSTED_PUBLIC_EVENTS.map(sourceOccurrence);
  const targetYear = query.year ?? 2026;
  let items = [...sourceEvents];
  if (query.includeAnniversaries) {
    items.push(
      ...TRUSTED_PUBLIC_EVENTS
        .map((event) => anniversaryOccurrence(event, targetYear))
        .filter((item): item is PublicMomentOccurrence => Boolean(item)),
    );
  }
  if (query.year) {
    items = items.filter((item) => Number(item.occurrenceDate.slice(0, 4)) === query.year);
  }
  if (query.month) {
    items = items.filter((item) => Number(item.occurrenceDate.slice(5, 7)) === query.month);
  }
  if (query.panda) {
    const panda = getPublicPanda(query.panda);
    items = panda
      ? items.filter((item) => item.participants.some((participant) => participant.id === panda.id))
      : [];
  }
  if (query.eventType) {
    items = items.filter((item) => item.eventType === query.eventType);
  }
  items.sort((left, right) => {
    const compared = left.occurrenceDate.localeCompare(right.occurrenceDate)
      || left.id.localeCompare(right.id);
    return query.sort === "date_desc" ? -compared : compared;
  });
  return items;
}

export function listFamilyStories(): PublicFamilyStoryRecord[] {
  return [...TRUSTED_FAMILY_STORIES].sort((left, right) => left.slug.localeCompare(right.slug));
}

export function getFamilyStory(reference: string): PublicFamilyStoryRecord | null {
  return TRUSTED_FAMILY_STORIES.find(
    (story) => story.slug === reference || story.id === reference,
  ) ?? null;
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

export function familyStoriesForPanda(pandaId: string): PublicFamilyStoryRecord[] {
  return listFamilyStories().filter((story) => story.member_ids.includes(pandaId));
}
