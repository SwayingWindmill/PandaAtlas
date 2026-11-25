import {
  type InstitutionClockInput,
  VENUE_CLOCK_SPECS,
  type VenueClockStatus,
  localClockOf,
  venueActivityStatus,
} from "@/features/explore/venue-clock";
import type { MapItem } from "@/features/map/model";
import { WILD_AREAS } from "@/features/map/wild";

export type MapFilter = "all" | "visited" | "china" | "overseas" | "live" | "wild";

export interface MapFilterCounts {
  all: number;
  visited: number;
  china: number;
  overseas: number;
  live: number;
  wild: number;
}

export interface VenueLiveMeta {
  liveCamUrl: string | null;
  localTime: string | null;
  status: VenueClockStatus | null;
  statusLabel: string | null;
}

export interface VisitLike {
  placeId: string;
  visitedOn: string;
}

export interface PlaceInstitutionLike {
  placeId: string;
  institutionId?: string | null;
}

export interface VisitedInstitutionsSummary {
  visitedInstitutionIds: ReadonlySet<string>;
  lastVisitedByInstitution: ReadonlyMap<string, string>;
  visitedPlaceIds: ReadonlySet<string>;
  lastVisitedByPlace: ReadonlyMap<string, string>;
  firstVisitedByInstitution: ReadonlyMap<string, string>;
  firstVisitedByPlace: ReadonlyMap<string, string>;
}

const STATUS_SHORT_LABEL: Record<VenueClockStatus, string> = {
  active: "活跃中",
  upcoming: "即将开园",
  open: "开园中",
  nap: "午休中",
  closed: "休整中",
};

/** Combines verified schedule specs with any API-provided live cam URL by institution slug. */
export function resolveLiveCamMap(
  institutions: readonly InstitutionClockInput[] = [],
): ReadonlyMap<string, string | null> {
  const cams = new Map<string, string | null>();
  for (const [slug, spec] of Object.entries(VENUE_CLOCK_SPECS)) {
    cams.set(slug, spec.liveCamUrl);
  }
  for (const inst of institutions) {
    if (inst.liveCamUrl) cams.set(inst.slug, inst.liveCamUrl);
    else if (!cams.has(inst.slug)) cams.set(inst.slug, null);
  }
  return cams;
}

export function hasLiveCam(
  item: Pick<MapItem, "kind" | "slug">,
  liveCamBySlug: ReadonlyMap<string, string | null>,
): boolean {
  if (item.kind !== "institution") return false;
  return Boolean(liveCamBySlug.get(item.slug) ?? VENUE_CLOCK_SPECS[item.slug]?.liveCamUrl);
}

/** Extracts raw institution ID from a MapItem whose `id` follows `"institution:<id>"`. */
export function itemInstitutionId(item: Pick<MapItem, "id" | "kind">): string | null {
  if (item.kind !== "institution") return null;
  return item.id.startsWith("institution:") ? item.id.slice("institution:".length) : item.id;
}

/** Derives visited institutions and places (latest and earliest visit dates) from check-in records. */
export function resolveVisitedInstitutions(
  visits: readonly VisitLike[],
  places?: ReadonlyMap<string, PlaceInstitutionLike>,
): VisitedInstitutionsSummary {
  const visitedInstitutionIds = new Set<string>();
  const lastVisitedByInstitution = new Map<string, string>();
  const firstVisitedByInstitution = new Map<string, string>();
  const visitedPlaceIds = new Set<string>();
  const lastVisitedByPlace = new Map<string, string>();
  const firstVisitedByPlace = new Map<string, string>();

  for (const visit of visits) {
    visitedPlaceIds.add(visit.placeId);
    const prevLastPlace = lastVisitedByPlace.get(visit.placeId);
    if (!prevLastPlace || visit.visitedOn > prevLastPlace) {
      lastVisitedByPlace.set(visit.placeId, visit.visitedOn);
    }
    const prevFirstPlace = firstVisitedByPlace.get(visit.placeId);
    if (!prevFirstPlace || visit.visitedOn < prevFirstPlace) {
      firstVisitedByPlace.set(visit.placeId, visit.visitedOn);
    }

    const instId = places?.get(visit.placeId)?.institutionId;
    if (!instId) continue;
    visitedInstitutionIds.add(instId);
    const prevLastInst = lastVisitedByInstitution.get(instId);
    if (!prevLastInst || visit.visitedOn > prevLastInst) {
      lastVisitedByInstitution.set(instId, visit.visitedOn);
    }
    const prevFirstInst = firstVisitedByInstitution.get(instId);
    if (!prevFirstInst || visit.visitedOn < prevFirstInst) {
      firstVisitedByInstitution.set(instId, visit.visitedOn);
    }
  }

  return {
    visitedInstitutionIds,
    lastVisitedByInstitution,
    visitedPlaceIds,
    lastVisitedByPlace,
    firstVisitedByInstitution,
    firstVisitedByPlace,
  };
}

/** Whether a MapItem matches either a visited ID set (`item.id` or raw `institutionId`) or any visited `placeId`. */
export function isMapItemVisited(
  item: Pick<MapItem, "id" | "kind" | "placeIds">,
  visitedIds?: ReadonlySet<string>,
  visitedPlaceIds?: ReadonlySet<string>,
): boolean {
  if (visitedIds) {
    if (visitedIds.has(item.id)) return true;
    const instId = itemInstitutionId(item);
    if (instId && visitedIds.has(instId)) return true;
  }
  if (visitedPlaceIds && item.placeIds.some((placeId) => visitedPlaceIds.has(placeId))) {
    return true;
  }
  return false;
}

/** Picks the latest or earliest visit date across an item's institution and place IDs. */
function visitDateOfItem(
  item: Pick<MapItem, "id" | "kind" | "placeIds">,
  pick: "latest" | "earliest",
  byInstitution?: ReadonlyMap<string, string>,
  byPlace?: ReadonlyMap<string, string>,
): string | null {
  let result: string | null = null;
  const consider = (candidate: string | undefined) => {
    if (!candidate) return;
    if (!result || (pick === "latest" ? candidate > result : candidate < result)) {
      result = candidate;
    }
  };
  const instId = itemInstitutionId(item);
  if (instId) consider(byInstitution?.get(instId));
  consider(byInstitution?.get(item.id));
  if (byPlace) {
    for (const placeId of item.placeIds) {
      consider(byPlace.get(placeId));
    }
  }
  return result;
}

export function lastVisitedOfItem(
  item: Pick<MapItem, "id" | "kind" | "placeIds">,
  lastVisitedByInstitution?: ReadonlyMap<string, string>,
  lastVisitedByPlace?: ReadonlyMap<string, string>,
): string | null {
  return visitDateOfItem(item, "latest", lastVisitedByInstitution, lastVisitedByPlace);
}

export function firstVisitedOfItem(
  item: Pick<MapItem, "id" | "kind" | "placeIds">,
  firstVisitedByInstitution?: ReadonlyMap<string, string>,
  firstVisitedByPlace?: ReadonlyMap<string, string>,
): string | null {
  return visitDateOfItem(item, "earliest", firstVisitedByInstitution, firstVisitedByPlace);
}

export function countVisitedThisYear(
  items: readonly Pick<MapItem, "id" | "kind" | "placeIds">[],
  firstVisitedByInstitution: ReadonlyMap<string, string>,
  firstVisitedByPlace: ReadonlyMap<string, string>,
  year: number,
): number {
  const targetYear = String(year);
  let count = 0;
  for (const item of items) {
    const first = firstVisitedOfItem(item, firstVisitedByInstitution, firstVisitedByPlace);
    if (first && first.slice(0, 4) === targetYear) count += 1;
  }
  return count;
}

export function filterMapItems(
  items: readonly MapItem[],
  filter: MapFilter,
  liveCamBySlug: ReadonlyMap<string, string | null>,
  visitedIds?: ReadonlySet<string>,
  visitedPlaceIds?: ReadonlySet<string>,
): MapItem[] {
  switch (filter) {
    case "all":
      return [...items];
    case "visited":
      return items.filter((item) => isMapItemVisited(item, visitedIds, visitedPlaceIds));
    case "china":
      return items.filter((item) => !item.overseas);
    case "overseas":
      return items.filter((item) => item.overseas);
    case "live":
      return items.filter((item) => hasLiveCam(item, liveCamBySlug));
    case "wild":
      return [];
  }
}

export function mapFilterCounts(
  items: readonly MapItem[],
  liveCamBySlug: ReadonlyMap<string, string | null>,
  visitedIds?: ReadonlySet<string>,
  visitedPlaceIds?: ReadonlySet<string>,
): MapFilterCounts {
  return {
    all: items.length,
    visited: items.filter((item) => isMapItemVisited(item, visitedIds, visitedPlaceIds)).length,
    china: items.filter((item) => !item.overseas).length,
    overseas: items.filter((item) => item.overseas).length,
    live: items.filter((item) => hasLiveCam(item, liveCamBySlug)).length,
    wild: WILD_AREAS.length,
  };
}

export function venueLiveMeta(
  item: Pick<MapItem, "kind" | "slug">,
  liveCamBySlug: ReadonlyMap<string, string | null>,
  now: Date = new Date(),
): VenueLiveMeta | null {
  if (item.kind !== "institution") return null;
  const spec = VENUE_CLOCK_SPECS[item.slug];
  const liveCamUrl = liveCamBySlug.get(item.slug) ?? spec?.liveCamUrl ?? null;
  if (!spec) {
    return liveCamUrl ? { liveCamUrl, localTime: null, status: null, statusLabel: null } : null;
  }
  const { hhmm, minutes } = localClockOf(now, spec.timeZone);
  const status = venueActivityStatus(minutes, spec);
  return {
    liveCamUrl,
    localTime: hhmm,
    status,
    statusLabel: STATUS_SHORT_LABEL[status],
  };
}
