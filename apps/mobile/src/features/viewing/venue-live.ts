import {
  VENUE_CLOCK_SPECS,
  type VenueClockStatus,
  localClockOf,
  venueActivityStatus,
} from "@/features/explore/venue-clock";
import type { TimeWindow } from "@/features/institutions/institutions";
import { minutesOf, stripRange } from "@/features/viewing/day-window";

export interface VenueLiveSnapshot {
  slug: string;
  timeZone: string;
  localTime: string;
  minutes: number;
  status: VenueClockStatus;
  statusLabel: string;
  hint: string;
  active: readonly TimeWindow[];
  nap: TimeWindow | null;
  range: { from: number; to: number };
  openLabel: string;
  peakLabel: string;
  closeLabel: string;
  liveCamUrl: string | null;
}

const VENUE_STATUS_LABEL: Record<VenueClockStatus, string> = {
  active: "活跃中",
  upcoming: "即将开园",
  open: "开园中",
  nap: "午休中",
  closed: "夜间休整",
};

const VENUE_STATUS_HINT: Record<VenueClockStatus, string> = {
  active: "今日观赏指数高",
  upcoming: "即将进入活跃时段",
  open: "正常开放中",
  nap: "大熊猫午休中",
  closed: "闭园休整中",
};

/** Prefers an API-supplied live-cam URL, falling back to verified static venue specs. */
export function resolveVenueLiveCamUrl(
  slug: string,
  apiLiveCamUrl: string | null | undefined,
): string | null {
  return apiLiveCamUrl || VENUE_CLOCK_SPECS[slug]?.liveCamUrl || null;
}

/** Builds a real-time viewing activity snapshot for a venue with a verified schedule spec. */
export function buildVenueLiveSnapshot(
  slug: string,
  apiLiveCamUrl: string | null | undefined,
  now: Date = new Date(),
): VenueLiveSnapshot | null {
  const spec = VENUE_CLOCK_SPECS[slug];
  if (!spec || spec.active.length === 0) return null;

  const { hhmm, minutes } = localClockOf(now, spec.timeZone);
  const status = venueActivityStatus(minutes, spec);
  const sortedByStart = [...spec.active].sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
  const sortedByEnd = [...spec.active].sort((a, b) => minutesOf(b.end) - minutesOf(a.end));
  const earliestStart = sortedByStart[0]!.start;
  const latestEnd = sortedByEnd[0]!.end;
  const primary = sortedByStart[0]!;
  const range = stripRange([...spec.active, ...(spec.nap ? [spec.nap] : [])]);

  return {
    slug,
    timeZone: spec.timeZone,
    localTime: hhmm,
    minutes,
    status,
    statusLabel: VENUE_STATUS_LABEL[status],
    hint: VENUE_STATUS_HINT[status],
    active: sortedByStart,
    nap: spec.nap,
    range,
    openLabel: `${earliestStart} 开园`,
    peakLabel: `${primary.start}–${primary.end} 活跃高峰`,
    closeLabel: `${latestEnd} 闭园`,
    liveCamUrl: resolveVenueLiveCamUrl(slug, apiLiveCamUrl),
  };
}
