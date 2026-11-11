import type { MapItem } from "./model";

/** What the timeline reads: the release's residencies and life events, and the map's places. */
export interface TimelineResidency {
  pandaId: string;
  placeId: string;
  startOn?: string;
  endOn?: string;
}

export interface TimelineEvent {
  eventId: string;
  eventType: string;
  occurredOn?: string;
  fromPlaceId?: string;
  toPlaceId?: string;
  participantIds: string[];
}

export interface TimelinePanda {
  id: string;
  slug: string;
  name: string;
}

/** How a year's event is drawn in the list: its glyph and its color. Death is a grey dot, nothing more. */
export type YearEventKind = "birth" | "abroad" | "home" | "move" | "debut" | "naming" | "death" | "other";

export interface YearEvent {
  id: string;
  kind: YearEventKind;
  /** 力力、真真 */
  who: string;
  /** 碧峰峡 → 上野动物园, or 在卧龙出生 */
  what: string;
  /** 2 月 21 日, or 8 月 when the day is unknown */
  when: string;
  /** The panda a tap on the row opens: the first one named. */
  pandaSlug: string | null;
  /** For a move, the two map items, so the map can draw the flow. */
  from: string | null;
  to: string | null;
}

export interface MapTimeline {
  /** From the first year with a record to this year. */
  years: number[];
  /** Records per year (life events and residency starts), for the histogram. 0 is a year with none. */
  counts: number[];
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function yearOf(date: string | undefined): number | null {
  const match = date ? DATE.exec(date) : null;
  return match ? Number(match[1]) : null;
}

export function buildTimeline(
  residencies: readonly TimelineResidency[],
  events: readonly TimelineEvent[],
  thisYear: number,
): MapTimeline {
  const recorded = [
    ...events.map((event) => yearOf(event.occurredOn)),
    ...residencies.map((residency) => yearOf(residency.startOn)),
  ].filter((year): year is number => year !== null && year <= thisYear);
  if (recorded.length === 0) return { years: [thisYear], counts: [0] };
  const first = Math.min(...recorded);
  const years = Array.from({ length: thisYear - first + 1 }, (_, index) => first + index);
  const counts = years.map((year) => recorded.filter((value) => value === year).length);
  return { years, counts };
}

/** How many pandas each map item held at the end of `year`, by its residencies. */
export function residentsInYear(
  items: readonly MapItem[],
  residencies: readonly TimelineResidency[],
  year: number,
): Map<string, number> {
  const end = `${year}-12-31`;
  const itemOfPlace = new Map(items.flatMap((item) => item.placeIds.map((placeId) => [placeId, item.id] as const)));
  const pandasAt = new Map<string, Set<string>>();
  for (const residency of residencies) {
    const item = itemOfPlace.get(residency.placeId);
    if (!item || !residency.startOn || residency.startOn > end) continue;
    if (residency.endOn && residency.endOn < end) continue;
    const pandas = pandasAt.get(item) ?? new Set<string>();
    pandas.add(residency.pandaId);
    pandasAt.set(item, pandas);
  }
  return new Map([...pandasAt].map(([item, pandas]) => [item, pandas.size]));
}

function dayLabel(date: string): string {
  const [, , month, day] = DATE.exec(date) ?? [];
  if (!month) return "";
  return day && day !== "01" ? `${Number(month)} 月 ${Number(day)} 日` : `${Number(month)} 月`;
}

/** The year's life events, oldest first, named in words a fan reads. */
export function eventsInYear(
  items: readonly MapItem[],
  events: readonly TimelineEvent[],
  pandas: readonly TimelinePanda[],
  year: number,
): YearEvent[] {
  const itemOfPlace = new Map(items.flatMap((item) => item.placeIds.map((placeId) => [placeId, item] as const)));
  const pandaById = new Map(pandas.map((panda) => [panda.id, panda]));
  return events
    .filter((event) => yearOf(event.occurredOn) === year)
    .sort((a, b) => (a.occurredOn ?? "").localeCompare(b.occurredOn ?? "") || a.eventId.localeCompare(b.eventId))
    .flatMap((event): YearEvent[] => {
      const named = event.participantIds.flatMap((id) => {
        const panda = pandaById.get(id);
        return panda ? [panda] : [];
      });
      if (named.length === 0) return [];
      const from = event.fromPlaceId ? itemOfPlace.get(event.fromPlaceId) : undefined;
      const to = event.toPlaceId ? itemOfPlace.get(event.toPlaceId) : undefined;
      const who = named.map((panda) => panda.name).join("、");
      const base = { id: event.eventId, who, when: dayLabel(event.occurredOn ?? ""), pandaSlug: named[0]?.slug ?? null };
      switch (event.eventType) {
        case "birth":
          return [{ ...base, kind: "birth", what: to ? `在${to.name}出生` : "出生", from: null, to: to?.id ?? null }];
        case "transfer":
        case "arrival":
        case "return": {
          // Leaving for a place abroad is 出国; coming from one is 回国.
          const abroad = Boolean(to?.overseas);
          const home = !abroad && Boolean(from?.overseas);
          const route = from && to ? `${from.name} → ${to.name}` : to ? `到${to.name}` : from ? `离开${from.name}` : "";
          return [
            {
              ...base,
              kind: abroad ? "abroad" : home ? "home" : "move",
              what: route || (event.eventType === "arrival" ? "抵达" : "迁移"),
              from: from?.id ?? null,
              to: to?.id ?? null,
            },
          ];
        }
        case "public_debut":
          return [{ ...base, kind: "debut", what: to ? `在${to.name}公开亮相` : "公开亮相", from: null, to: null }];
        case "naming":
          return [{ ...base, kind: "naming", what: "取了名字", from: null, to: null }];
        case "death":
          return [{ ...base, kind: "death", what: "已离世", from: null, to: null }];
        default:
          return [];
      }
    });
}
