import { buildLifeList } from "../book/book";
import { CUB_DAY_TEXT, MILESTONE_CONFIG, cubDayOn, visitNumbers } from "../milestones/milestones";
import { type LifeEvent, type Residency, describeEvent } from "../timeline/timeline";

// 那年今天: what happened on this calendar day in an earlier year, told only from records that already exist.
// Public memories come from the published catalog (a living panda's birthday, the day it came to a place, the
// day it came home to China), each with the sources the record carries; personal ones come from the fan's own
// 图鉴 and 到访 records. Nothing is written here that a record does not say. Pure rules; loading is in load.ts.

/**
 * How 那年今天 treats a panda that has died. Kept in one place because it is a judgement call that may change:
 * memories of loss hurt when they are pushed at people (Google Photos resurfacing a dog that died,
 * x.com/parsley72/status/1754600874872320302), so by default they never reach 今天 or a notification and are
 * shown quietly on the panda's own page under 纪念.
 */
export const DECEASED_POLICY = {
  /** Show a deceased panda's anniversaries on 今天 and on the 那年今天 page. */
  onToday: false,
  /** Show them on the panda's own page. */
  onProfile: true,
  /** The heading they are shown under on the panda's page. */
  heading: "纪念",
  /** Whether they may ever be sent as a notification. There is no 那年今天 notification at all yet. */
  push: false,
} as const;

export type MemoryKind =
  "month" | "hundred" | "birthday" | "home" | "arrival" | "death" | "seen" | "recognized" | "visit";

export interface MemorySubject {
  /** `panda:<id>` or `place:<id>`: what 少显示 hides. */
  key: string;
  kind: "panda" | "place";
  id: string;
  slug: string | null;
  name: string;
}

export interface Memory {
  /** Unique and stable: the record it comes from. */
  key: string;
  kind: MemoryKind;
  subject: MemorySubject;
  /** The day it happened, YYYY-MM-DD. */
  date: string;
  /** Whole years since then; at least 1, except 0 for a cub's 满月 or 满百天 (a 里程碑, not a memory). */
  years: number;
  /** One plain sentence: "3 岁生日", "2 年前的今天回国，住进雅安碧峰峡基地". */
  text: string;
  /** Source ids the record carries. Empty only for a birthday told from the profile's birth date. */
  sourceIds: string[];
  /** True for the fan's own records. */
  personal: boolean;
  deceased: boolean;
  /** A 里程碑 the record was, said after the sentence while 里程碑 is on: "是你的第 10 只熊猫". */
  milestone?: string;
}

export interface MemoryPanda {
  id: string;
  slug: string;
  name: string;
  /** YYYY-MM-DD when the day is known. */
  birthDate: string | null;
  deceased: boolean;
}

export interface MemoryPlace {
  id: string;
  slug: string | null;
  name: string | null;
  countryCode: string | null;
  /** Only the country is known ("中国"): it is not somewhere a panda moves into. */
  countryLevel?: boolean;
}

export interface PersonalRecords {
  /** 见过: the day the fan saw the panda in person. */
  seen: { pandaId: string; seenOn?: string | null; placeId?: string | null; firstSeenAt?: string }[];
  /** 认出: the first time the fan picked it out in a game (an ISO date-time). */
  recognized: { pandaId: string; firstGame: "daily_panda" | "guess_panda"; firstMetAt: string }[];
  /** 到访: a day the fan went to a place. */
  visits: { checkinId: string; placeId: string; visitedOn: string; createdAt?: string }[];
}

export interface MemoryInput {
  /** The fan's local date, YYYY-MM-DD. */
  today: string;
  pandas: MemoryPanda[];
  events: LifeEvent[];
  residencies: Residency[];
  places: Map<string, MemoryPlace>;
  personal?: PersonalRecords | null;
  /** Restrict to one panda (its own page). */
  pandaId?: string;
  /** Include deceased pandas (the panda's own page, per DECEASED_POLICY). */
  includeDeceased?: boolean;
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Whole years from `date` to `today` when `today` is its anniversary, else null. A 2月29日 record is
 * remembered on 2月28日 in other years. The day itself (0 years) is news, not a memory.
 */
export function anniversaryYears(date: string | null | undefined, today: string): number | null {
  const then = date ? DAY.exec(date.slice(0, 10)) : null;
  const now = DAY.exec(today);
  if (!then || !now) return null;
  const [year, month, day] = [Number(then[1]), then[2], then[3]];
  const thisYear = Number(now[1]);
  const shifted = month === "02" && day === "29" && !isLeap(thisYear) ? "28" : day;
  if (month !== now[2] || shifted !== now[3]) return null;
  const years = thisYear - year;
  return years >= 1 ? years : null;
}

/** The fan's local date of an ISO date-time ("2025-10-29T23:30:00-07:00" → "2025-10-29" in Los Angeles). */
export function localDay(value: string): string {
  if (DAY.test(value)) return value;
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return value.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

const inChina = (place: MemoryPlace | undefined) => place?.countryCode === "CN";
const abroad = (place: MemoryPlace | undefined) => Boolean(place?.countryCode && place.countryCode !== "CN");

const GAME: Record<PersonalRecords["recognized"][number]["firstGame"], string> = {
  daily_panda: "每日一猫",
  guess_panda: "猜熊猫",
};

/** Order on a day: the fan's own first, then coming home, coming to a place, birthdays; older first within. */
const ORDER: MemoryKind[] = ["seen", "recognized", "visit", "home", "arrival", "month", "hundred", "birthday", "death"];

/** "是你的第 10 只熊猫" when the panda's 图鉴 number is a milestone. */
function pandaMilestone(count: number | undefined): string | undefined {
  if (count === undefined || !(MILESTONE_CONFIG.pandas as readonly number[]).includes(count)) return undefined;
  return count === 1 ? "是你的第一只熊猫" : `是你的第 ${count} 只熊猫`;
}

/** "是你第一次回来" when the visit's count at its place is a milestone. */
function visitMilestone(count: number | undefined): string | undefined {
  if (count === undefined || !(MILESTONE_CONFIG.visits as readonly number[]).includes(count)) return undefined;
  if (count === 1) return "是你第一次来";
  if (count === 2) return "是你第一次回来";
  return `是你第 ${count} 次来`;
}

export function memoriesOn(input: MemoryInput): Memory[] {
  const { today } = input;
  const pandas = new Map(input.pandas.map((panda) => [panda.id, panda]));
  const placeName = (id: string | undefined) => (id ? (input.places.get(id)?.name ?? null) : null);
  const wanted = (panda: MemoryPanda | undefined): panda is MemoryPanda =>
    Boolean(panda) &&
    (!input.pandaId || panda!.id === input.pandaId) &&
    (!panda!.deceased || Boolean(input.includeDeceased));
  const pandaSubject = (panda: MemoryPanda): MemorySubject => ({
    key: `panda:${panda.id}`,
    kind: "panda",
    id: panda.id,
    slug: panda.slug,
    name: panda.name,
  });
  const out: Memory[] = [];
  /** panda id + date already told by a life event, so a residency starting that day is not told twice. */
  const told = new Set<string>();

  for (const event of input.events) {
    if (event.eventStatus !== "completed" || event.occurredPrecision !== "day" || event.sourceIds.length === 0) continue;
    if (event.eventType === "birth") continue;
    const years = anniversaryYears(event.occurredOn, today);
    for (const pandaId of event.participantIds) {
      if (event.occurredOn) told.add(`${pandaId}:${event.occurredOn}`);
      if (years === null) continue;
      const panda = pandas.get(pandaId);
      if (!wanted(panda)) continue;
      const from = event.fromPlaceId ? input.places.get(event.fromPlaceId) : undefined;
      const to = event.toPlaceId ? input.places.get(event.toPlaceId) : undefined;
      const comingHome =
        event.eventType === "return" ||
        (["transfer", "arrival"].includes(event.eventType) && abroad(from) && inChina(to));
      let kind: MemoryKind;
      let sentence: string | null;
      if (comingHome) {
        kind = "home";
        sentence = to?.name && !to.countryLevel ? `回国，住进${to.name}` : "回国";
      } else if (event.eventType === "arrival" || event.eventType === "transfer") {
        kind = "arrival";
        sentence = describeEvent(event, placeName, panda.birthDate)?.text ?? null;
      } else if (event.eventType === "death" && panda.deceased) {
        kind = "death";
        sentence = describeEvent(event, placeName, panda.birthDate)?.text ?? null;
      } else {
        continue;
      }
      if (!sentence) continue;
      out.push({
        key: `event:${event.eventId}:${pandaId}`,
        kind,
        subject: pandaSubject(panda),
        date: event.occurredOn!,
        years,
        text: `${years} 年前的今天${sentence}`,
        sourceIds: event.sourceIds,
        personal: false,
        deceased: panda.deceased,
      });
    }
  }

  // A stay that starts on a known day, with its own source, is a coming to that place, unless a life event
  // already told that day or it is where the panda was born.
  const staysByPanda = new Map<string, Residency[]>();
  for (const stay of input.residencies) staysByPanda.set(stay.pandaId, [...(staysByPanda.get(stay.pandaId) ?? []), stay]);
  for (const stay of input.residencies) {
    if (stay.startPrecision !== "day" || !stay.startOn || stay.sourceIds.length === 0) continue;
    if (stay.status !== "confirmed") continue;
    const years = anniversaryYears(stay.startOn, today);
    if (years === null) continue;
    const panda = pandas.get(stay.pandaId);
    if (!wanted(panda) || told.has(`${panda.id}:${stay.startOn}`) || panda.birthDate === stay.startOn) continue;
    const here = input.places.get(stay.placeId);
    if (!here?.name || here.countryLevel) continue;
    const before = (staysByPanda.get(stay.pandaId) ?? [])
      .filter((other) => other !== stay && other.endOn && other.endOn <= stay.startOn!)
      .sort((a, b) => (b.endOn ?? "").localeCompare(a.endOn ?? ""))[0];
    const previous = before ? input.places.get(before.placeId) : undefined;
    const home = abroad(previous) && inChina(here);
    out.push({
      key: `stay:${stay.residencyId}`,
      kind: home ? "home" : "arrival",
      subject: pandaSubject(panda),
      date: stay.startOn,
      years,
      text: `${years} 年前的今天${home ? `回国，住进${here.name}` : previous?.name ? `从${previous.name}搬到${here.name}` : `住进${here.name}`}`,
      sourceIds: before ? [...new Set([...stay.sourceIds, ...before.sourceIds])] : stay.sourceIds,
      personal: false,
      deceased: panda.deceased,
    });
  }

  // Birthdays: the profile's birth date, with the birth event's sources when one records that day. A cub's
  // 满月 and 满百天 are told the same way, for a living cub only: they are about the days ahead.
  for (const panda of input.pandas) {
    if (!wanted(panda) || !panda.birthDate) continue;
    const birthSources = () =>
      input.events.find(
        (event) =>
          event.eventType === "birth" &&
          event.eventStatus === "completed" &&
          event.occurredOn === panda.birthDate &&
          event.participantIds.includes(panda.id),
      )?.sourceIds ?? [];
    const cubDay = panda.deceased ? null : cubDayOn(panda.birthDate, today);
    if (cubDay) {
      out.push({
        key: `${cubDay}:${panda.id}`,
        kind: cubDay,
        subject: pandaSubject(panda),
        date: panda.birthDate,
        years: 0,
        text: `今天${CUB_DAY_TEXT[cubDay]}`,
        sourceIds: birthSources(),
        personal: false,
        deceased: false,
      });
    }
    const years = anniversaryYears(panda.birthDate, today);
    if (years === null) continue;
    out.push({
      key: `birthday:${panda.id}`,
      kind: "birthday",
      subject: pandaSubject(panda),
      date: panda.birthDate,
      years,
      // A panda that has died is not given a birthday; its page says when it was born.
      text: panda.deceased ? `${years} 年前的今天出生` : `${years} 岁生日`,
      sourceIds: birthSources(),
      personal: false,
      deceased: panda.deceased,
    });
  }

  const personal = input.personal;
  if (personal) {
    // The 图鉴's numbers, the way it counts them, so "你的第 10 只" here is the No.10 there.
    const numbers = new Map(
      buildLifeList(
        personal.recognized.map((item) => ({ ...item, timesMet: 1 })),
        personal.seen.flatMap((item) => {
          const firstSeenAt = item.firstSeenAt ?? item.seenOn;
          return firstSeenAt ? [{ ...item, firstSeenAt }] : [];
        }),
      ).entries.map((entry) => [entry.pandaId, entry]),
    );
    // The milestone belongs to whichever way the fan met the panda first.
    const firstWay = (pandaId: string, date: string) => {
      const entry = numbers.get(pandaId);
      return entry && entry.firstOn.slice(0, 10) === date ? pandaMilestone(entry.number) : undefined;
    };
    const visitCounts = visitNumbers(personal.visits);
    for (const item of personal.seen) {
      if (!item.seenOn) continue;
      const years = anniversaryYears(item.seenOn, today);
      const panda = pandas.get(item.pandaId);
      if (years === null || !wanted(panda)) continue;
      const where = placeName(item.placeId ?? undefined);
      out.push({
        key: `seen:${panda.id}`,
        kind: "seen",
        subject: pandaSubject(panda),
        date: item.seenOn,
        years,
        text: `${years} 年前的今天，你${where ? `在${where}` : ""}见过它`,
        sourceIds: [],
        personal: true,
        deceased: panda.deceased,
        milestone: firstWay(panda.id, item.seenOn),
      });
    }
    for (const item of personal.recognized) {
      const date = localDay(item.firstMetAt);
      const years = anniversaryYears(date, today);
      const panda = pandas.get(item.pandaId);
      if (years === null || !wanted(panda)) continue;
      out.push({
        key: `recognized:${panda.id}`,
        kind: "recognized",
        subject: pandaSubject(panda),
        date,
        years,
        text: `${years} 年前的今天，你在${GAME[item.firstGame]}第一次认出它`,
        sourceIds: [],
        personal: true,
        deceased: panda.deceased,
        milestone: firstWay(panda.id, date),
      });
    }
    if (!input.pandaId) {
      const placesSeen = new Set<string>();
      for (const visit of personal.visits) {
        const years = anniversaryYears(visit.visitedOn, today);
        const place = input.places.get(visit.placeId);
        if (years === null || !place?.name || placesSeen.has(`${visit.placeId}:${visit.visitedOn}`)) continue;
        placesSeen.add(`${visit.placeId}:${visit.visitedOn}`);
        out.push({
          key: `visit:${visit.checkinId}`,
          kind: "visit",
          subject: { key: `place:${place.id}`, kind: "place", id: place.id, slug: place.slug, name: place.name },
          date: visit.visitedOn,
          years,
          text: `${years} 年前的今天，你去过这里`,
          sourceIds: [],
          personal: true,
          deceased: false,
          milestone: visitMilestone(visitCounts.get(visit.checkinId)),
        });
      }
    }
  }

  return out.sort(
    (a, b) =>
      ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) ||
      b.years - a.years ||
      a.subject.name.localeCompare(b.subject.name, "zh-CN"),
  );
}

export interface MemoryPrefs {
  /** 关闭那年今天: no card on 今天. */
  off: boolean;
  /** 少显示: subject keys left out of 今天 and the 那年今天 page. */
  less: string[];
}

export const DEFAULT_PREFS: MemoryPrefs = { off: false, less: [] };

/**
 * What 今天 and the 那年今天 page show: no deceased panda (per DECEASED_POLICY), nothing shown less, and with
 * 里程碑 off, no 满月 or 满百天 and no "你的第 10 只"; with it on, that is said after the sentence.
 */
export function visibleMemories(memories: Memory[], prefs: MemoryPrefs, milestonesOn = true): Memory[] {
  const less = new Set(prefs.less);
  return memories
    .filter((memory) => !less.has(memory.subject.key) && (DECEASED_POLICY.onToday || !memory.deceased))
    .filter((memory) => milestonesOn || !isCubDay(memory))
    .map((memory) => (milestonesOn && memory.milestone ? { ...memory, text: `${memory.text}，${memory.milestone}` } : memory));
}

export function isCubDay(memory: Pick<Memory, "kind">): boolean {
  return memory.kind === "month" || memory.kind === "hundred";
}

/** Where a memory's line under the sentence says it comes from, when it has no published source. */
export function ownRecord(memory: Memory): string | null {
  if (memory.kind === "seen" || memory.kind === "recognized") return "来自你的图鉴";
  if (memory.kind === "visit") return "来自你的到访记录";
  if (isCubDay(memory) && memory.sourceIds.length === 0) return "按资料卡的出生日期推算";
  if (memory.sourceIds.length === 0) return "来自资料卡，这一条还没有单独的出处";
  return null;
}

/** Headings on the 那年今天 page, in page order. */
export const GROUPS: { title: string; kinds: MemoryKind[] }[] = [
  { title: "你的记录", kinds: ["seen", "recognized", "visit"] },
  { title: "回国", kinds: ["home"] },
  { title: "来到新家", kinds: ["arrival"] },
  { title: "满月和百天", kinds: ["month", "hundred"] },
  { title: "生日", kinds: ["birthday"] },
];

/**
 * The few memories the 今天 card has room for: the first of each group in turn, so a day with the fan's own
 * records and a return home shows both, then the rest in order. Kept in the page's order.
 */
export function pickForCard(memories: Memory[], count: number): Memory[] {
  const queues = GROUPS.map((group) => memories.filter((memory) => group.kinds.includes(memory.kind)));
  const picked = new Set<Memory>();
  for (let round = 0; picked.size < count && queues.some((queue) => queue.length > round); round += 1) {
    for (const queue of queues) {
      if (picked.size >= count) break;
      const next = queue[round];
      if (next) picked.add(next);
    }
  }
  return memories.filter((memory) => picked.has(memory));
}
