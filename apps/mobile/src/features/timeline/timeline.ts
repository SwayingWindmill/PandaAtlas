import type { components } from "@zhipanda/api-client";

import type { PandaMilestone } from "../milestones/milestones";

// A panda's life as dated milestones, the way zoos tell it ("his top 12 milestones"): its life events and the
// stays in its residency record, merged into one list, oldest first, each with the sources that state it.
// A stay's start or end that a life event already tells (arrival 2011-02-21 at 上野 and the stay there that
// starts that day) is one milestone, carrying the sources of both. Announced plans are left out: they have not
// happened yet. Pure rules here; the loader is in load.ts.

type Schemas = components["schemas"];
export type LifeEvent = Schemas["PublicLifeEventSummaryDto"];
export type Residency = Schemas["PublicResidencySummaryDto"];
export type Evidence = Schemas["PublicEvidenceSummaryDto"];

export type MilestoneKind =
  | "birth"
  | "cub"
  | "move"
  | "arrive"
  | "home"
  | "debut"
  | "naming"
  | "death"
  | "stay"
  | "leave"
  // 里程碑 worked out from the record: 满月, 满百天, a birthday, becoming a parent.
  | "month"
  | "hundred"
  | "age"
  | "parent";

export interface MilestoneSource {
  id: string;
  publisher: string;
  title: string;
  url: string;
}

export interface Milestone {
  id: string;
  kind: MilestoneKind;
  /** The record's date as precise as it is: "2024-10-15", "2024-10" or "2024". */
  date: string;
  /** "10月15日", "10月", or "" for a year-only date; the year is the group's header. */
  dayLabel: string;
  /** "抵达史密森尼国家动物园". */
  text: string;
  /** A qualifier under the text: "只知道所在国家" for a country-level stay. */
  note?: string;
  sources: MilestoneSource[];
  /** A 里程碑 worked out from the record rather than recorded itself; it goes with the 里程碑 switch. */
  counted?: boolean;
  /** A recorded cub birth retold as becoming a parent keeps its own words for when 里程碑 is off. */
  recordedText?: string;
}

export interface TimelineYear {
  year: string;
  /** "3 岁" for a year after the birth year when the birth year is known. */
  age?: string;
  milestones: Milestone[];
}

export interface Timeline {
  years: TimelineYear[];
  /** Milestones without a date, after the dated ones. */
  undated: Milestone[];
  /** "8 条记录 · 2005–2024 · 住过 2 个地方": what is recorded, not the 里程碑 worked out from it. Null when there is nothing. */
  summary: string | null;
  count: number;
}

const KIND_OF_EVENT: Record<string, MilestoneKind> = {
  birth: "birth",
  arrival: "arrive",
  transfer: "move",
  return: "home",
  public_debut: "debut",
  naming: "naming",
  death: "death",
};

function trimDate(value: string, precision: string | undefined): string {
  if (precision === "year") return value.slice(0, 4);
  if (precision === "month") return value.slice(0, 7);
  return value.slice(0, 10);
}

/** "10月15日", "10月", or "" for a year. */
export function dayLabel(date: string): string {
  const [, month, day] = date.split("-");
  if (!month) return "";
  return day ? `${Number(month)}月${Number(day)}日` : `${Number(month)}月`;
}

/** Whether two dates of possibly different precision name the same day (or the same coarser span). */
function sameDate(a: string, b: string): boolean {
  const length = Math.min(a.length, b.length);
  return a.slice(0, length) === b.slice(0, length);
}

function eventText(event: LifeEvent, place: (id: string | undefined) => string | null): string | null {
  const to = place(event.toPlaceId);
  const from = place(event.fromPlaceId);
  switch (event.eventType) {
    case "birth":
      return to ? `在${to}出生` : "出生";
    case "arrival":
      return to ? `抵达${to}` : "抵达新家";
    case "transfer":
      if (from && to) return `从${from}搬到${to}`;
      return to ? `搬到${to}` : "搬家";
    case "return":
      return to ? `回国，住进${to}` : "回国";
    case "public_debut":
      return to ? `在${to}首次与公众见面` : "首次与公众见面";
    case "naming":
      return "有了名字";
    case "death":
      return to ? `在${to}离世` : "离世";
    default:
      return null;
  }
}

/**
 * What a life event was for this panda, or null for a kind the app does not tell. A birth names the mother
 * too; for her it is the day her cub was born, not her own birthday. The profile's 动态 uses the same words.
 */
export function describeEvent(
  event: LifeEvent,
  place: (placeId: string | undefined) => string | null,
  birthDate: string | null,
): { kind: MilestoneKind; text: string } | null {
  const kind = KIND_OF_EVENT[event.eventType];
  const text = eventText(event, place);
  if (!kind || !text) return null;
  if (kind === "birth" && birthDate && event.occurredOn && birthDate.slice(0, 10) !== event.occurredOn.slice(0, 10)) {
    const at = place(event.toPlaceId);
    return { kind: "cub", text: at ? `在${at}迎来幼崽出生` : "迎来幼崽出生" };
  }
  return { kind, text };
}

function sourcesOf(ids: string[], evidence: Map<string, Evidence>): MilestoneSource[] {
  return ids.flatMap((id) => {
    const found = evidence.get(id);
    return found ? [{ id, publisher: found.publisher, title: found.title, url: found.url }] : [];
  });
}

function addSources(milestone: Milestone, more: MilestoneSource[]) {
  for (const source of more) {
    if (!milestone.sources.some((known) => known.id === source.id)) milestone.sources.push(source);
  }
}

const COUNTRY_LEVEL = "confirmed_country_level";

export function buildTimeline(input: {
  events: LifeEvent[];
  residencies: Residency[];
  evidence: Evidence[];
  /** The panda the timeline is for; events it only appears in as another's parent still count. */
  pandaId: string;
  place: (placeId: string | undefined) => string | null;
  birthDate: string | null;
  /** From the profile's facts: told when no death event is on record. */
  deathDate?: string | null;
  /** 里程碑 worked out from the record (milestones.ts): 满月, 满百天, birthdays, becoming a parent. */
  counted?: PandaMilestone[];
}): Timeline {
  const evidence = new Map(input.evidence.map((item) => [item.sourceId, item]));
  const milestones: Milestone[] = [];
  const toldBy: { milestone: Milestone; event: LifeEvent }[] = [];

  for (const event of input.events) {
    if (event.eventStatus !== "completed" || !event.participantIds.includes(input.pandaId)) continue;
    const told = describeEvent(event, input.place, input.birthDate);
    if (!told) continue;
    const { kind, text } = told;
    const date = event.occurredOn ? trimDate(event.occurredOn, event.occurredPrecision) : "";
    const milestone: Milestone = {
      id: event.eventId,
      kind,
      date,
      dayLabel: date ? dayLabel(date) : "",
      text,
      sources: sourcesOf(event.sourceIds, evidence),
    };
    milestones.push(milestone);
    toldBy.push({ milestone, event });
  }

  // The profile's birth and death dates bracket the life even when no event records them; facts carry no
  // per-entry source, so such a milestone says so instead of borrowing one.
  const fromFacts = (kind: "birth" | "death", value: string | null | undefined) => {
    if (!value || milestones.some((milestone) => milestone.kind === kind)) return;
    const date = value.slice(0, 10);
    milestones.push({
      id: `fact:${kind}`,
      kind,
      date,
      dayLabel: dayLabel(date),
      text: kind === "birth" ? "出生" : "离世",
      note: "来自资料卡，这一条还没有单独的出处",
      sources: [],
    });
  };
  fromFacts("birth", input.birthDate);
  fromFacts("death", input.deathDate);

  const stays = input.residencies.filter((residency) => residency.pandaId === input.pandaId);
  // A stay's end that another stay starts the same day is a move between them, told once.
  const moves = new Map<Residency, Residency>();
  for (const stay of stays) {
    if (!stay.endOn) continue;
    const next = stays.find((other) => other !== stay && other.startOn && sameDate(other.startOn, stay.endOn ?? ""));
    if (next) moves.set(next, stay);
  }
  const movedOut = new Set(moves.values());

  for (const stay of stays) {
    const name = input.place(stay.placeId);
    if (!name) continue;
    const sources = sourcesOf(stay.sourceIds, evidence);
    const note = stay.status === COUNTRY_LEVEL ? "只知道所在国家，具体机构暂无记录" : undefined;

    const start = stay.startOn ? trimDate(stay.startOn, stay.startPrecision) : "";
    const startTold = toldBy.find(
      ({ event, milestone }) =>
        event.toPlaceId === stay.placeId && (!start || !milestone.date || sameDate(milestone.date, start)),
    );
    if (startTold) {
      addSources(startTold.milestone, sources);
    } else {
      const from = moves.get(stay);
      const fromName = from ? input.place(from.placeId) : null;
      milestones.push({
        id: `${stay.residencyId}:start`,
        kind: from ? "move" : "stay",
        date: start,
        dayLabel: start ? dayLabel(start) : "",
        text: fromName ? `从${fromName}搬到${name}` : start ? `住进${name}` : `住在${name}`,
        note,
        sources: from
          ? [...sources, ...sourcesOf(from.sourceIds, evidence).filter((s) => !sources.some((k) => k.id === s.id))]
          : sources,
      });
    }

    if (!stay.endOn) continue;
    const end = trimDate(stay.endOn, stay.endPrecision);
    const endTold = toldBy.find(
      ({ event, milestone }) =>
        milestone.date &&
        sameDate(milestone.date, end) &&
        (event.fromPlaceId === stay.placeId || ["transfer", "return", "death", "arrival"].includes(event.eventType)),
    );
    if (endTold) {
      addSources(endTold.milestone, sources);
      continue;
    }
    // Told as the move into the next stay.
    if (movedOut.has(stay)) continue;
    milestones.push({
      id: `${stay.residencyId}:end`,
      kind: "leave",
      date: end,
      dayLabel: dayLabel(end),
      text: `离开${name}`,
      note,
      sources,
    });
  }

  // Becoming a parent is the day the first cub was born; a birth event may already tell that day as 迎来幼崽出生,
  // and then it is one milestone, said the 里程碑 way, with the sources of both.
  for (const item of input.counted ?? []) {
    const sources = sourcesOf(item.sourceIds, evidence);
    // With no birth date of its own on record, the panda's cub's birth event reads as a birth; the parent link
    // says whose it is.
    const cub =
      item.kind === "parent"
        ? milestones.find(
            (m) => m.date === item.date && (m.kind === "cub" || (m.kind === "birth" && !input.birthDate && !m.id.startsWith("fact:"))),
          )
        : undefined;
    if (cub) {
      cub.kind = "cub";
      cub.recordedText = cub.text;
      cub.text = item.text;
      addSources(cub, sources);
      continue;
    }
    milestones.push({
      id: `counted:${item.id}`,
      kind: item.kind,
      date: item.date,
      dayLabel: dayLabel(item.date),
      text: item.text,
      note: item.note,
      sources,
      counted: true,
    });
  }

  const dated = milestones
    .filter((milestone) => milestone.date)
    .sort((a, b) => a.date.localeCompare(b.date) || ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  const undated = milestones.filter((milestone) => !milestone.date);

  const birthYear = input.birthDate ? Number(input.birthDate.slice(0, 4)) : null;
  const years: TimelineYear[] = [];
  for (const milestone of dated) {
    const year = milestone.date.slice(0, 4);
    let group = years.at(-1);
    if (group?.year !== year) {
      const age = birthYear !== null ? Number(year) - birthYear : null;
      group = { year, age: age !== null && age >= 1 ? `${age} 岁` : undefined, milestones: [] };
      years.push(group);
    }
    group.milestones.push(milestone);
  }

  // The summary counts what is recorded; counted days come and go with the 里程碑 switch.
  const count = dated.filter((milestone) => !milestone.counted).length + undated.length;
  const places = new Set(stays.map((stay) => stay.placeId).filter((id) => input.place(id)));
  const span =
    years.length === 0 ? null : years.length === 1 ? years[0]!.year : `${years[0]!.year}–${years.at(-1)!.year}`;
  const summary =
    count === 0
      ? null
      : [`${count} 条记录`, span, places.size > 0 ? `住过 ${places.size} 个地方` : null].filter(Boolean).join(" · ");
  return { years, undated, summary, count };
}

/** Within one day: born before anything else, gone after everything else. */
const ORDER: MilestoneKind[] = [
  "birth",
  "cub",
  "parent",
  "month",
  "hundred",
  "age",
  "naming",
  "leave",
  "move",
  "arrive",
  "home",
  "stay",
  "debut",
  "death",
];
