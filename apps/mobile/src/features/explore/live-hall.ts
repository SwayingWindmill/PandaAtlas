import {
  type InstitutionClockInput,
  type LiveClockCard,
  VENUE_CLOCK_SPECS,
  localClockOf,
} from "@/features/explore/venue-clock";
import type { MapItem } from "@/features/map/model";
import { minutesOf } from "@/features/viewing/day-window";
import { type VenueLiveSnapshot, buildVenueLiveSnapshot, resolveVenueLiveCamUrl } from "@/features/viewing/venue-live";

export type LiveHallFilter = "all" | "live" | "active" | "overseas";
export type LiveHallRegion = "eastAsia" | "europe" | "northAmerica";

export interface RegionalPulse {
  key: LiveHallRegion;
  label: string;
  localTime: string;
  isDaytime: boolean;
  activeCount: number;
}

export interface LiveHallVenue extends LiveClockCard {
  snapshot: VenueLiveSnapshot;
  overseas: boolean;
  region: LiveHallRegion;
  where: string | null;
  nextOpenLabel: string;
}

export interface LiveHallSummary {
  totalCount: number;
  activeCount: number;
  liveCount: number;
  restingCount: number;
  overseasCount: number;
}

export interface LiveHallModel {
  pulses: RegionalPulse[];
  summary: LiveHallSummary;
  awake: LiveHallVenue[];
  resting: LiveHallVenue[];
}

const REGION_TIMEZONES: readonly { key: LiveHallRegion; label: string; timeZone: string }[] = [
  { key: "eastAsia", label: "东亚", timeZone: "Asia/Shanghai" },
  { key: "europe", label: "欧洲", timeZone: "Europe/Vienna" },
  { key: "northAmerica", label: "北美", timeZone: "America/New_York" },
];

function regionForTimeZone(timeZone: string): LiveHallRegion {
  if (timeZone.startsWith("Europe/")) return "europe";
  if (timeZone.startsWith("America/")) return "northAmerica";
  return "eastAsia";
}

function awakeRankOf(venue: LiveHallVenue): number {
  const camBonus = venue.liveCamUrl ? 0 : 1;
  switch (venue.status) {
    case "active":
      return camBonus;
    case "upcoming":
      return 2 + camBonus;
    case "open":
      return 4 + camBonus;
    case "nap":
      return 6 + camBonus;
    case "closed":
      return 8 + camBonus;
  }
}

function minutesUntilOpen(minutes: number, earliestOpenMinutes: number): number {
  if (minutes < earliestOpenMinutes) return earliestOpenMinutes - minutes;
  return 24 * 60 - minutes + earliestOpenMinutes;
}

/** Daytime/nighttime overview across the three global panda regions. */
export function buildRegionalPulses(venues: readonly LiveHallVenue[], now: Date = new Date()): RegionalPulse[] {
  return REGION_TIMEZONES.map(({ key, label, timeZone }) => {
    const { hhmm, minutes } = localClockOf(now, timeZone);
    const hour = Math.floor(minutes / 60);
    const isDaytime = hour >= 6 && hour < 19;
    const activeCount = venues.filter(
      (venue) => venue.region === key && (venue.status === "active" || venue.status === "open"),
    ).length;
    return { key, label, localTime: hhmm, isDaytime, activeCount };
  });
}

function matchesFilter(venue: LiveHallVenue, filter: LiveHallFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "live":
      return Boolean(venue.liveCamUrl);
    case "active":
      return venue.status === "active" || venue.status === "open" || venue.status === "upcoming";
    case "overseas":
      return venue.overseas;
  }
}

/** Builds regional pulses, summary counts, and active/closed splits for `/live`. */
export function buildLiveHallModel(
  mapItems: readonly MapItem[],
  institutions: readonly InstitutionClockInput[],
  filter: LiveHallFilter,
  now: Date = new Date(),
): LiveHallModel {
  const apiCamBySlug = new Map(institutions.map((inst) => [inst.slug, inst.liveCamUrl ?? null]));
  const eligible: LiveHallVenue[] = [];

  for (const item of mapItems) {
    if (item.kind !== "institution") continue;
    if (!Object.hasOwn(VENUE_CLOCK_SPECS, item.slug)) continue;

    const apiCam = apiCamBySlug.get(item.slug);
    const liveCamUrl = resolveVenueLiveCamUrl(item.slug, apiCam);
    if (item.residentCount === 0 && !liveCamUrl) continue;

    const snapshot = buildVenueLiveSnapshot(item.slug, apiCam, now);
    if (!snapshot) continue;

    const earliestOpen = snapshot.active[0]!.start;
    eligible.push({
      slug: item.slug,
      name: item.name,
      timeZone: snapshot.timeZone,
      localTime: snapshot.localTime,
      status: snapshot.status,
      statusLabel: snapshot.statusLabel,
      liveCamUrl: snapshot.liveCamUrl,
      residentCount: item.residentCount,
      residents: item.residents.slice(0, 4).map((panda) => ({
        id: panda.id,
        slug: panda.slug,
        name: panda.name,
      })),
      snapshot,
      overseas: item.overseas,
      region: regionForTimeZone(snapshot.timeZone),
      where: item.where,
      nextOpenLabel: `${earliestOpen} 开园`,
    });
  }

  const pulses = buildRegionalPulses(eligible, now);
  const summary: LiveHallSummary = {
    totalCount: eligible.length,
    activeCount: eligible.filter((v) => v.status === "active" || v.status === "open").length,
    liveCount: eligible.filter((v) => Boolean(v.liveCamUrl)).length,
    restingCount: eligible.filter((v) => v.status === "nap" || v.status === "closed").length,
    overseasCount: eligible.filter((v) => v.overseas).length,
  };

  const filtered = eligible.filter((venue) => matchesFilter(venue, filter));

  const awake = filtered
    .filter((venue) => venue.status !== "closed")
    .sort(
      (left, right) =>
        awakeRankOf(left) - awakeRankOf(right) ||
        right.residentCount - left.residentCount ||
        left.name.localeCompare(right.name, "zh-CN"),
    );

  const resting = filtered
    .filter((venue) => venue.status === "closed")
    .sort((left, right) => {
      const leftWait = minutesUntilOpen(left.snapshot.minutes, minutesOf(left.snapshot.active[0]!.start));
      const rightWait = minutesUntilOpen(right.snapshot.minutes, minutesOf(right.snapshot.active[0]!.start));
      return (
        leftWait - rightWait ||
        (right.liveCamUrl ? 1 : 0) - (left.liveCamUrl ? 1 : 0) ||
        right.residentCount - left.residentCount ||
        left.name.localeCompare(right.name, "zh-CN")
      );
    });

  return { pulses, summary, awake, resting };
}
