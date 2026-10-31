import type { LifeEntry } from "../book/book";

// 里程碑: the days worth marking, kept the way birders keep "every 100th species"
// (x.com/guttenbirder22/status/2087681112722313724), and never the way Goodreads tells a reader they are
// "behind" (x.com/AdvancedLena/status/1477034223810846721). So there is no goal, no deadline, no streak and no
// ranking against anyone: only what already happened, counted from the fan's own records, and for a panda
// only what its published record says (a birth date, a parent link) with the sources that record carries.
// Pure rules; the screens and loaders are elsewhere.

/**
 * Where the counts that make a milestone live, in one place because they are a judgement call that may
 * change. The 图鉴 numbers each panda the fan has 认出 or 见过 (No.1 is the first); a visit counts the times
 * the fan has been to the same place.
 */
export const MILESTONE_CONFIG = {
  /** The Nth panda in the 图鉴 that is a milestone. */
  pandas: [1, 10, 50, 100, 200],
  /** The Nth visit to one place that is a milestone: the first time, the first time back, then a few more. */
  visits: [2, 5, 10, 20],
  /** A panda's birthdays told as milestones on its timeline (each birthday is still on 那年今天). */
  birthdays: [1, 10, 20, 30],
  /** Days after birth for 满百天. */
  hundredDays: 100,
} as const;

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function isDay(value: string | null | undefined): value is string {
  return Boolean(value && DAY.test(value));
}

/** The same day `months` later; a day the month does not have falls on its last day (1月31日 → 2月28日). */
export function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return target.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** A panda's first days, as zoos announce them: 满月 a month after the birth, 满百天 100 days after. */
export type CubDay = "month" | "hundred";

export const CUB_DAY_TEXT: Record<CubDay, string> = { month: "满月", hundred: "满百天" };

/** Which first day `today` is for a panda born on `birthDate`, or null. Needs the day of birth. */
export function cubDayOn(birthDate: string | null | undefined, today: string): CubDay | null {
  if (!isDay(birthDate)) return null;
  if (addMonths(birthDate, 1) === today) return "month";
  if (addDays(birthDate, MILESTONE_CONFIG.hundredDays) === today) return "hundred";
  return null;
}

// ——— The fan's own ———

export interface PersonalMilestone {
  /** Stable: what it counts and which one. */
  key: string;
  kind: "panda" | "visit";
  /** The count it marks: the 10th panda, the 2nd visit. */
  count: number;
  /** The day it was reached, YYYY-MM-DD. */
  date: string;
  /** "第 10 只熊猫", "第一次回到成都大熊猫繁育研究基地". */
  title: string;
  subject: { kind: "panda" | "place"; id: string; slug: string | null; name: string };
}

export interface MilestoneVisit {
  checkinId: string;
  placeId: string;
  visitedOn: string;
  createdAt?: string;
}

/** "第一只熊猫", "第 10 只熊猫". */
export function pandaTitle(count: number): string {
  return count === 1 ? "第一只熊猫" : `第 ${count} 只熊猫`;
}

/** "第一次来到上野动物园", "第一次回到上野动物园", "第 5 次来到上野动物园". */
export function visitTitle(count: number, place: string): string {
  if (count === 1) return `第一次来到${place}`;
  if (count === 2) return `第一次回到${place}`;
  return `第 ${count} 次来到${place}`;
}

/**
 * The numbers each visit has at its place, by check-in id: oldest first, the same day's visits in the order
 * they were recorded, so the numbers never shuffle between loads.
 */
export function visitNumbers(visits: MilestoneVisit[]): Map<string, number> {
  const byPlace = new Map<string, MilestoneVisit[]>();
  for (const visit of visits) byPlace.set(visit.placeId, [...(byPlace.get(visit.placeId) ?? []), visit]);
  const numbers = new Map<string, number>();
  for (const list of byPlace.values()) {
    list
      .slice()
      .sort(
        (a, b) =>
          a.visitedOn.localeCompare(b.visitedOn) ||
          (a.createdAt ?? "").localeCompare(b.createdAt ?? "") ||
          a.checkinId.localeCompare(b.checkinId),
      )
      .forEach((visit, index) => numbers.set(visit.checkinId, index + 1));
  }
  return numbers;
}

/**
 * Every milestone the fan has reached, newest first: the 图鉴 entries whose number is in
 * MILESTONE_CONFIG.pandas, and the visits whose count at their place is in MILESTONE_CONFIG.visits.
 */
export function personalMilestones(input: {
  entries: Pick<LifeEntry, "pandaId" | "number" | "firstOn">[];
  visits: MilestoneVisit[];
  panda: (id: string) => { name: string; slug: string } | undefined;
  place: (id: string) => { name: string | null; slug: string | null } | undefined;
}): PersonalMilestone[] {
  const out: PersonalMilestone[] = [];
  const pandaNodes = new Set<number>(MILESTONE_CONFIG.pandas);
  for (const entry of input.entries) {
    if (!pandaNodes.has(entry.number)) continue;
    const panda = input.panda(entry.pandaId);
    if (!panda) continue;
    out.push({
      key: `panda:${entry.number}`,
      kind: "panda",
      count: entry.number,
      date: entry.firstOn.slice(0, 10),
      title: pandaTitle(entry.number),
      subject: { kind: "panda", id: entry.pandaId, slug: panda.slug, name: panda.name },
    });
  }
  const visitNodes = new Set<number>(MILESTONE_CONFIG.visits);
  const numbers = visitNumbers(input.visits);
  for (const visit of input.visits) {
    const count = numbers.get(visit.checkinId)!;
    const place = input.place(visit.placeId);
    if (!visitNodes.has(count) || !place?.name) continue;
    out.push({
      key: `visit:${visit.placeId}:${count}`,
      kind: "visit",
      count,
      date: visit.visitedOn,
      title: visitTitle(count, place.name),
      subject: { kind: "place", id: visit.placeId, slug: place.slug, name: place.name },
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.count - a.count || a.key.localeCompare(b.key));
}

/** The 图鉴 number of each panda that is a milestone, for the list's mark and 那年今天's "你的第 10 只". */
export function milestoneNumbers(entries: Pick<LifeEntry, "pandaId" | "number">[]): Map<string, number> {
  const nodes = new Set<number>(MILESTONE_CONFIG.pandas);
  return new Map(entries.filter((entry) => nodes.has(entry.number)).map((entry) => [entry.pandaId, entry.number]));
}

// ——— A panda's ———

export type PandaMilestoneKind = "month" | "hundred" | "age" | "parent";

export interface PandaMilestone {
  id: string;
  kind: PandaMilestoneKind;
  date: string;
  text: string;
  /** Source ids: the birth's for days counted from it, the parent link's (and the cub's birth's) for a parent. */
  sourceIds: string[];
  /** Said under the text when the day is worked out rather than recorded. */
  note?: string;
}

/** Said under a day worked out from the birth date. */
export const COUNTED_NOTE = "按出生日期推算";

/**
 * The milestones in a panda's own life that have happened by `today` (and, for a panda that has died, while
 * it lived): 满月 and 满百天 when the day of birth is known, the birthdays in MILESTONE_CONFIG.birthdays, and
 * becoming a mother or father, the day its first cub with a known birthday was born.
 */
export function pandaMilestones(input: {
  birthDate: string | null;
  deathDate?: string | null;
  today: string;
  /** Sources of the birth (the birth event's); empty when only the profile states it. */
  birthSourceIds: string[];
  /** "mother" or "father" for this panda in each parent link to a child, with that child's birth. */
  children: { id: string; name: string; birthDate: string | null; role: "mother" | "father"; sourceIds: string[] }[];
}): PandaMilestone[] {
  const out: PandaMilestone[] = [];
  const until = [input.today, isDay(input.deathDate) ? input.deathDate : null]
    .filter((value): value is string => Boolean(value))
    .sort()[0]!;
  const happened = (date: string) => date <= until;
  const born = isDay(input.birthDate) ? input.birthDate : null;
  if (born) {
    const days: [PandaMilestoneKind, string, string][] = [
      ["month", addMonths(born, 1), CUB_DAY_TEXT.month],
      ["hundred", addDays(born, MILESTONE_CONFIG.hundredDays), CUB_DAY_TEXT.hundred],
      ...MILESTONE_CONFIG.birthdays.map((age): [PandaMilestoneKind, string, string] => [
        "age",
        addMonths(born, age * 12),
        `${age} 岁生日`,
      ]),
    ];
    for (const [kind, date, text] of days) {
      if (!happened(date)) continue;
      out.push({ id: `${kind}:${date}`, kind, date, text, sourceIds: input.birthSourceIds, note: COUNTED_NOTE });
    }
  }
  const cubs = input.children
    .filter((child) => isDay(child.birthDate) && child.sourceIds.length > 0 && happened(child.birthDate!))
    .sort((a, b) => a.birthDate!.localeCompare(b.birthDate!) || a.name.localeCompare(b.name, "zh-CN"));
  const first = cubs[0];
  if (first) {
    const twins = cubs.filter((child) => child.birthDate === first.birthDate);
    const names = twins.map((child) => child.name).join("和");
    out.push({
      id: `parent:${first.birthDate}`,
      kind: "parent",
      date: first.birthDate!,
      text: `当${first.role === "mother" ? "妈妈" : "爸爸"}了，${names}出生`,
      sourceIds: [...new Set(twins.flatMap((child) => child.sourceIds))],
    });
  }
  return out;
}
