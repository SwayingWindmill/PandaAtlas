import type { TimeWindow } from "@/features/institutions/institutions";
import type { MapItem } from "@/features/map/model";
import { minutesOf } from "@/features/viewing/day-window";

export type VenueClockStatus = "active" | "upcoming" | "open" | "nap" | "closed";

export interface VenueClockSpec {
  timeZone: string;
  active: readonly TimeWindow[];
  nap: TimeWindow | null;
  liveCamUrl: string | null;
}

export interface InstitutionClockInput {
  slug: string;
  liveCamUrl?: string | null;
}

export interface LiveClockCard {
  slug: string;
  name: string;
  timeZone: string;
  localTime: string;
  status: VenueClockStatus;
  statusLabel: string;
  liveCamUrl: string | null;
  residentCount: number;
  residents: { id: string; slug: string; name: string }[];
}

const UPCOMING_LEAD_MINUTES = 210;

const DEFAULT_SCHEDULE: VenueClockSpec = {
  timeZone: "Asia/Shanghai",
  active: [
    { start: "08:30", end: "11:30" },
    { start: "14:30", end: "17:00" },
  ],
  nap: { start: "12:00", end: "14:00" },
  liveCamUrl: null,
};

/** Verified timezone, viewing windows, and official live-cam pages for the 23 institutions. */
export const VENUE_CLOCK_SPECS: Readonly<Record<string, VenueClockSpec>> = {
  "chengdu-research-base": {
    timeZone: "Asia/Shanghai",
    active: [
      { start: "07:30", end: "11:30" },
      { start: "14:30", end: "17:00" },
    ],
    nap: { start: "12:00", end: "14:00" },
    liveCamUrl: "https://www.ipanda.com/",
  },
  ccrcgp: {
    timeZone: "Asia/Shanghai",
    active: [
      { start: "08:30", end: "11:30" },
      { start: "14:30", end: "17:00" },
    ],
    nap: { start: "12:00", end: "14:00" },
    liveCamUrl: "https://www.ipanda.com/",
  },
  "smithsonian-national-zoo": {
    timeZone: "America/New_York",
    active: [{ start: "08:00", end: "16:00" }],
    nap: { start: "12:00", end: "14:00" },
    liveCamUrl: "https://nationalzoo.si.edu/webcams/panda-cam",
  },
  "zoo-atlanta": {
    timeZone: "America/New_York",
    active: [{ start: "09:00", end: "17:00" }],
    nap: { start: "12:30", end: "14:30" },
    liveCamUrl: "https://zooatlanta.org/panda-cam/",
  },
  "san-diego-zoo": {
    timeZone: "America/Los_Angeles",
    active: [{ start: "09:30", end: "17:00" }],
    nap: { start: "12:30", end: "14:30" },
    liveCamUrl: "https://zoo.sandiegozoo.org/cams/giant-panda-cam",
  },
  "ocean-park-hong-kong": {
    timeZone: "Asia/Hong_Kong",
    active: [
      { start: "10:00", end: "12:30" },
      { start: "14:30", end: "17:30" },
    ],
    nap: { start: "12:30", end: "14:00" },
    liveCamUrl: "https://www.oceanpark.com.hk/sc/park-experience/giant-panda-adventure",
  },
  "ueno-zoo": {
    timeZone: "Asia/Tokyo",
    active: [
      { start: "09:30", end: "12:00" },
      { start: "14:00", end: "16:30" },
    ],
    nap: { start: "12:30", end: "14:00" },
    liveCamUrl: null,
  },
  "beijing-zoo": {
    timeZone: "Asia/Shanghai",
    active: [
      { start: "08:00", end: "11:30" },
      { start: "14:30", end: "17:00" },
    ],
    nap: { start: "12:00", end: "14:00" },
    liveCamUrl: null,
  },
  "chongqing-zoo": {
    timeZone: "Asia/Shanghai",
    active: [
      { start: "09:00", end: "11:30" },
      { start: "14:30", end: "16:30" },
    ],
    nap: { start: "12:00", end: "14:00" },
    liveCamUrl: null,
  },
  "chimelong-safari-park": {
    timeZone: "Asia/Shanghai",
    active: [
      { start: "09:30", end: "12:00" },
      { start: "14:30", end: "17:30" },
    ],
    nap: { start: "12:30", end: "14:00" },
    liveCamUrl: null,
  },
  "shanghai-wild-animal-park": {
    timeZone: "Asia/Shanghai",
    active: [
      { start: "09:00", end: "12:00" },
      { start: "14:30", end: "16:30" },
    ],
    nap: { start: "12:00", end: "14:00" },
    liveCamUrl: null,
  },
  "nanjing-hongshan-zoo": {
    timeZone: "Asia/Shanghai",
    active: [
      { start: "08:30", end: "11:30" },
      { start: "14:00", end: "16:30" },
    ],
    nap: { start: "12:00", end: "13:30" },
    liveCamUrl: null,
  },
  "fuzhou-panda-world": {
    timeZone: "Asia/Shanghai",
    active: [
      { start: "08:30", end: "11:30" },
      { start: "14:30", end: "17:00" },
    ],
    nap: { start: "12:00", end: "14:00" },
    liveCamUrl: null,
  },
  "qinling-four-treasures-park": {
    timeZone: "Asia/Shanghai",
    active: [
      { start: "09:00", end: "11:30" },
      { start: "14:30", end: "17:00" },
    ],
    nap: { start: "12:00", end: "14:00" },
    liveCamUrl: null,
  },
  "dalian-forest-zoo": {
    timeZone: "Asia/Shanghai",
    active: [
      { start: "09:00", end: "11:30" },
      { start: "14:30", end: "16:30" },
    ],
    nap: { start: "12:00", end: "14:00" },
    liveCamUrl: null,
  },
  "taipei-zoo": {
    timeZone: "Asia/Taipei",
    active: [
      { start: "09:00", end: "11:30" },
      { start: "14:00", end: "16:30" },
    ],
    nap: { start: "12:00", end: "13:30" },
    liveCamUrl: null,
  },
  everland: {
    timeZone: "Asia/Seoul",
    active: [
      { start: "10:00", end: "12:30" },
      { start: "14:30", end: "17:30" },
    ],
    nap: { start: "12:30", end: "14:00" },
    liveCamUrl: null,
  },
  "river-wonders": {
    timeZone: "Asia/Singapore",
    active: [
      { start: "09:00", end: "12:00" },
      { start: "14:30", end: "17:30" },
    ],
    nap: { start: "12:30", end: "14:00" },
    liveCamUrl: null,
  },
  "zoo-negara": {
    timeZone: "Asia/Kuala_Lumpur",
    active: [
      { start: "09:00", end: "12:00" },
      { start: "14:00", end: "16:30" },
    ],
    nap: { start: "12:00", end: "13:30" },
    liveCamUrl: null,
  },
  "tiergarten-schonbrunn": {
    timeZone: "Europe/Vienna",
    active: [
      { start: "09:00", end: "12:00" },
      { start: "14:00", end: "17:00" },
    ],
    nap: { start: "12:00", end: "13:30" },
    liveCamUrl: null,
  },
  "zooparc-de-beauval": {
    timeZone: "Europe/Paris",
    active: [
      { start: "09:00", end: "12:00" },
      { start: "14:00", end: "17:30" },
    ],
    nap: { start: "12:30", end: "14:00" },
    liveCamUrl: null,
  },
  "berlin-zoo": {
    timeZone: "Europe/Berlin",
    active: [
      { start: "09:00", end: "12:00" },
      { start: "14:00", end: "17:00" },
    ],
    nap: { start: "12:30", end: "14:00" },
    liveCamUrl: null,
  },
  "zoo-aquarium-madrid": {
    timeZone: "Europe/Madrid",
    active: [
      { start: "10:30", end: "13:00" },
      { start: "15:00", end: "17:30" },
    ],
    nap: { start: "13:00", end: "14:30" },
    liveCamUrl: null,
  },
};

const STATUS_LABEL: Record<VenueClockStatus, string> = {
  active: "正在活跃",
  upcoming: "即将开园",
  open: "开园中",
  nap: "午休时段",
  closed: "夜间休整",
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let fmt = formatterCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    formatterCache.set(timeZone, fmt);
  }
  return fmt;
}

/** Local "HH:MM" clock and minutes since midnight for `date` in an IANA time zone. */
export function localClockOf(date: Date, timeZone: string): { hhmm: string; minutes: number } {
  const parts = formatterFor(timeZone).formatToParts(date);
  const rawHour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const hour = rawHour === "24" ? "00" : rawHour;
  const hhmm = `${hour}:${minute}`;
  return { hhmm, minutes: minutesOf(hhmm) };
}

function inWindow(minutes: number, window: TimeWindow): boolean {
  return minutes >= minutesOf(window.start) && minutes < minutesOf(window.end);
}

/** Whether a venue is active, napping, in daytime open hours, opening soon, or resting at night. */
export function venueActivityStatus(minutes: number, spec: Pick<VenueClockSpec, "active" | "nap">): VenueClockStatus {
  if (spec.nap && inWindow(minutes, spec.nap)) return "nap";
  if (spec.active.some((window) => inWindow(minutes, window))) return "active";
  const earliest = spec.active.reduce(
    (min, window) => Math.min(min, minutesOf(window.start)),
    Number.POSITIVE_INFINITY,
  );
  const latest = spec.active.reduce(
    (max, window) => Math.max(max, minutesOf(window.end)),
    Number.NEGATIVE_INFINITY,
  );
  if (earliest <= latest && minutes >= earliest && minutes < latest) {
    return "open";
  }
  if (earliest < Number.POSITIVE_INFINITY && minutes >= earliest - UPCOMING_LEAD_MINUTES && minutes < earliest) {
    return "upcoming";
  }
  return "closed";
}

function rankOf(card: LiveClockCard): number {
  const camBonus = card.liveCamUrl ? 0 : 1;
  switch (card.status) {
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

/**
 * Global panda venue activity cards ordered so venues awake right now (especially those with official live cams)
 * lead the horizontal strip.
 */
export function buildLiveClockCards(
  mapItems: readonly MapItem[],
  institutions: readonly InstitutionClockInput[] = [],
  now: Date = new Date(),
): LiveClockCard[] {
  const apiCamBySlug = new Map(institutions.map((item) => [item.slug, item.liveCamUrl ?? null]));
  const cards: LiveClockCard[] = [];

  for (const item of mapItems) {
    if (item.kind !== "institution") continue;
    const spec = VENUE_CLOCK_SPECS[item.slug] ?? DEFAULT_SCHEDULE;
    const liveCamUrl = apiCamBySlug.get(item.slug) ?? spec.liveCamUrl;
    if (item.residentCount === 0 && !liveCamUrl) continue;

    const { hhmm, minutes } = localClockOf(now, spec.timeZone);
    const status = venueActivityStatus(minutes, spec);
    cards.push({
      slug: item.slug,
      name: item.name,
      timeZone: spec.timeZone,
      localTime: hhmm,
      status,
      statusLabel: STATUS_LABEL[status],
      liveCamUrl,
      residentCount: item.residentCount,
      residents: item.residents.slice(0, 3).map((panda) => ({
        id: panda.id,
        slug: panda.slug,
        name: panda.name,
      })),
    });
  }

  return cards.sort(
    (left, right) =>
      rankOf(left) - rankOf(right) ||
      right.residentCount - left.residentCount ||
      left.name.localeCompare(right.name, "zh-CN"),
  );
}
