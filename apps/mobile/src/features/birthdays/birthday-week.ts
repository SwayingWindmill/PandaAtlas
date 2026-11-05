// 生日周: the living pandas whose birthday falls in the seven days from today, and the age each turns.
// Pure over the published index, so the screen, the 今天 reminder and the birthday card share one rule.

import { type CalendarPanda, daysInMonth } from "@/features/calendar/calendar";

export const WEEK_DAYS = 7;

export interface WeekBirthday {
  /** YYYY-MM-DD this year (or next, for a week that crosses New Year). */
  date: string;
  /** 0 to 6: today is 0. */
  inDays: number;
  pandaId: string;
  slug: string;
  name: string;
  /** The age it turns; 0 is never listed, since the day it was born is not a birthday yet. */
  age: number;
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (value: number) => String(value).padStart(2, "0");

function addDays(date: string, by: number): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + by);
  return day.toISOString().slice(0, 10);
}

/** The birthday in `year`; 2-29 falls on 2-28 outside leap years, as the calendar tells it. */
function birthdayIn(birthDate: string, year: number): string | null {
  const match = DAY.exec(birthDate);
  if (!match) return null;
  const month = Number(match[2]);
  return `${year}-${pad(month)}-${pad(Math.min(Number(match[3]), daysInMonth(year, month)))}`;
}

/** Birthdays from `today` through six days on, soonest first, then by name. */
export function birthdayWeek(pandas: CalendarPanda[], today: string): WeekBirthday[] {
  const days = Array.from({ length: WEEK_DAYS }, (_, index) => addDays(today, index));
  const found: WeekBirthday[] = [];
  for (const panda of pandas) {
    if (panda.deceased || !panda.birthDate || !DAY.test(panda.birthDate)) continue;
    for (const [inDays, date] of days.entries()) {
      const year = Number(date.slice(0, 4));
      if (birthdayIn(panda.birthDate, year) !== date) continue;
      const age = year - Number(panda.birthDate.slice(0, 4));
      if (age < 1) continue;
      found.push({ date, inDays, pandaId: panda.id, slug: panda.slug, name: panda.name, age });
    }
  }
  return found.sort((a, b) => a.inDays - b.inDays || a.name.localeCompare(b.name, "zh-CN"));
}

/** "今天" "明天" "后天" or "3 天后". */
export function whenLabel(inDays: number): string {
  return ["今天", "明天", "后天"][inDays] ?? `${inDays} 天后`;
}

/** The followed pandas in the week, for the opt-in reminder on 今天. */
export function followedInWeek(week: WeekBirthday[], followed: ReadonlySet<string>): WeekBirthday[] {
  return week.filter((entry) => followed.has(entry.pandaId));
}

/** The next birthday from `today` (today included), how far off it is and the age it turns; null without a full date. */
export function nextBirthday(birthDate: string | null, today: string): { date: string; inDays: number; age: number } | null {
  if (!birthDate || !DAY.test(birthDate) || !DAY.test(today)) return null;
  const year = Number(today.slice(0, 4));
  const date = [year, year + 1].map((y) => birthdayIn(birthDate, y)).find((day): day is string => Boolean(day && day >= today));
  if (!date) return null;
  const inDays = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return { date, inDays, age: Number(date.slice(0, 4)) - Number(birthDate.slice(0, 4)) };
}
