import type { CalendarDay, CalendarEntry } from "@/features/calendar/calendar";

/** A birthday this close (today included) puts its panda at the head of 今天. */
export const BIRTHDAY_WEEK_DAYS = 7;

export interface BirthdayWeek {
  entry: CalendarEntry;
  /** 0 on the day itself. */
  daysLeft: number;
}

function dayNumber(date: string) {
  return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / 86_400_000;
}

/** The nearest birthday from today through the next six days, or null when the week has none. */
export function birthdayWeek(days: CalendarDay[], today: string): BirthdayWeek | null {
  const start = dayNumber(today);
  for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const daysLeft = dayNumber(day.date) - start;
    if (daysLeft < 0) continue;
    if (daysLeft >= BIRTHDAY_WEEK_DAYS) return null;
    const entry = day.entries.find((item) => item.key.startsWith("birthday:") && item.what !== "出生");
    if (entry) return { entry, daysLeft };
  }
  return null;
}
