// The 熊猫日历: birthdays derived from published birth dates, and published life events, by month.
// Pure functions over API data, so the screen stays a view and the rules are unit tested.

export interface CalendarPanda {
  id: string;
  slug: string;
  name: string;
  birthDate: string | null;
  deceased: boolean;
}

export interface CalendarEvent {
  eventId: string;
  eventType: string;
  occurredOn?: string;
  occurredPrecision: string;
  participantIds: string[];
}

export interface CalendarEntry {
  /** Unique within a month. */
  key: string;
  /** YYYY-MM-DD. */
  date: string;
  slug: string;
  name: string;
  /** "4 岁生日", "出生", "抵达". */
  what: string;
}

export interface CalendarDay {
  day: number;
  date: string;
  entries: CalendarEntry[];
}

const EVENT_LABEL: Record<string, string> = {
  arrival: "抵达",
  transfer: "迁移",
  return: "返回",
  naming: "命名",
  public_debut: "公开亮相",
  selection: "入选",
  announcement: "公告",
  observation: "观察",
  death: "离世",
};

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The birthday in `year` of a panda born on `birthDate`; 2-29 falls on 2-28 outside leap years. */
function birthdayIn(birthDate: string, year: number, month: number): CalendarEntry["date"] | null {
  const match = DAY.exec(birthDate);
  if (!match || Number(match[2]) !== month) return null;
  const day = Math.min(Number(match[3]), daysInMonth(year, month));
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Everything that happens in a month, by day. Birthdays are for living pandas with a known birth day; the
 * birth year shows 出生, so birth events are not listed twice. Events need a day-precise date and a published
 * participant, and list once per panda so each entry opens its profile.
 */
export function calendarMonth(
  pandas: CalendarPanda[],
  events: CalendarEvent[],
  year: number,
  month: number,
): CalendarDay[] {
  const entries: CalendarEntry[] = [];
  for (const panda of pandas) {
    if (panda.deceased || !panda.birthDate) continue;
    const date = birthdayIn(panda.birthDate, year, month);
    if (!date) continue;
    const age = year - Number(panda.birthDate.slice(0, 4));
    if (age < 0) continue;
    entries.push({
      key: `birthday:${panda.id}`,
      date,
      slug: panda.slug,
      name: panda.name,
      what: age === 0 ? "出生" : `${age} 岁生日`,
    });
  }

  const byId = new Map(pandas.map((panda) => [panda.id, panda]));
  const prefix = `${year}-${pad(month)}-`;
  for (const event of events) {
    if (event.eventType === "birth" || event.occurredPrecision !== "day" || !event.occurredOn?.startsWith(prefix))
      continue;
    for (const pandaId of event.participantIds) {
      const panda = byId.get(pandaId);
      if (!panda) continue;
      entries.push({
        key: `${event.eventId}:${pandaId}`,
        date: event.occurredOn,
        slug: panda.slug,
        name: panda.name,
        what: EVENT_LABEL[event.eventType] ?? "大事",
      });
    }
  }

  const days = new Map<string, CalendarEntry[]>();
  for (const entry of entries.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "zh-CN"))) {
    days.set(entry.date, [...(days.get(entry.date) ?? []), entry]);
  }
  return [...days].map(([date, dayEntries]) => ({
    day: Number(date.slice(8, 10)),
    date,
    entries: dayEntries,
  }));
}

/** Weeks of the month starting on Monday; `null` pads the first and last week. */
export function monthGrid(year: number, month: number): (number | null)[][] {
  const lead = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const cells: (number | null)[] = [...Array<null>(lead).fill(null)];
  for (let day = 1; day <= daysInMonth(year, month); day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let start = 0; start < cells.length; start += 7) weeks.push(cells.slice(start, start + 7));
  return weeks;
}

export function shiftMonth(year: number, month: number, by: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + by;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];

/** "10月26日 周一". */
export function dayHeading(date: string): string {
  const weekday = WEEKDAY[new Date(`${date}T00:00:00Z`).getUTCDay()];
  return `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日 周${weekday}`;
}
