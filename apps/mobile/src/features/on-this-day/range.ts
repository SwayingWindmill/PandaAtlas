// 那年今天 over more than one day: the days of 本周 or 本月, and how a memory reads when its day is not
// today. The sentences in on-this-day.ts are written for the day itself ("3 年前的今天回国"); on another
// day of the range the date is shown beside the row, so the sentence drops "N 年前的今天".

import { addDays } from "@/features/milestones/milestones";

import type { Memory } from "./on-this-day";

export type Range = "week" | "month";

export const RANGES = [
  { value: "week", label: "本周" },
  { value: "month", label: "本月" },
] as const;

/** 本周 is today and the next six days; 本月 is today to the month's last day. */
export function rangeDays(today: string, range: Range): string[] {
  if (range === "week") return Array.from({ length: 7 }, (_, index) => addDays(today, index));
  const days: string[] = [];
  for (let day = today; day.slice(0, 7) === today.slice(0, 7); day = addDays(day, 1)) days.push(day);
  return days;
}

/** The sentence for a memory on `day`: as written on today, without "N 年前的今天" on any other day. */
export function sentenceOn(memory: Pick<Memory, "text">, day: string, today: string): string {
  if (day === today) return memory.text;
  return memory.text.replace(/^\d+ 年前的今天，?/, "").replace(/^今天/, "");
}

/** "11月5日 周四 · 27 周年": when it falls in the range and how many years it marks. */
export function whenLine(memory: Pick<Memory, "years" | "kind">, day: string, today: string): string {
  const [, month, date] = day.split("-");
  const weekday = "日一二三四五六"[new Date(`${day}T00:00:00Z`).getUTCDay()];
  const head = day === today ? "今天" : `${Number(month)}月${Number(date)}日 周${weekday}`;
  return memory.years > 0 && memory.kind !== "birthday" ? `${head} · ${memory.years} 周年` : head;
}
