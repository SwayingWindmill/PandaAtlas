import {
  type InstitutionClockInput,
  VENUE_CLOCK_SPECS,
  type VenueClockStatus,
  localClockOf,
  venueActivityStatus,
} from "@/features/explore/venue-clock";
import type { MapItem } from "@/features/map/model";
import { WILD_AREAS } from "@/features/map/wild";

export type MapFilter = "all" | "china" | "overseas" | "live" | "wild";

export interface MapFilterCounts {
  all: number;
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

export function filterMapItems(
  items: readonly MapItem[],
  filter: MapFilter,
  liveCamBySlug: ReadonlyMap<string, string | null>,
): MapItem[] {
  switch (filter) {
    case "all":
      return [...items];
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
): MapFilterCounts {
  return {
    all: items.length,
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
