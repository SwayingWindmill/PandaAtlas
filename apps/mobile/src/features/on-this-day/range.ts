// 那年今天 over more than one day: the days of 本周 or 本月, and how a memory reads when its day is not
// today. The sentences in on-this-day.ts are written for the day itself ("3 年前的今天回国"); on another
// day of the range the date is shown beside the row, so the sentence drops "N 年前的今天".

import { addDays } from "@/features/milestones/milestones";

import type { Memory, MemoryKind } from "./on-this-day";

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

/**
 * The row's line, with who it is about: "美香回国，住进雅安碧峰峡基地", "宝力 6 岁生日", and for the fan's own
 * records the name where the sentence says 它 ("你在史密森国家动物园见过宝力").
 */
export function titleOn(memory: Pick<Memory, "text" | "subject">, day: string, today: string): string {
  const sentence = sentenceOn(memory, day, today);
  const name = memory.subject.name;
  if (sentence.includes("它")) return sentence.replace("它", name);
  if (sentence.includes("这里")) return sentence.replace("这里", name);
  return /^[\d]/.test(sentence) ? `${name} ${sentence}` : `${name}${sentence}`;
}

/** "11.05 · 1999": the day in the range and the year it happened. */
export function datePart(memory: Pick<Memory, "date">, day: string): string {
  return `${day.slice(5, 7)}.${day.slice(8, 10)} · ${memory.date.slice(0, 4)}`;
}

/** "27 周年" for an anniversary; nothing for a birthday, which already counts its years, or a cub's day. */
export function yearsPart(memory: Pick<Memory, "years" | "kind">): string | null {
  const counted: MemoryKind[] = ["home", "arrival", "seen", "recognized", "visit"];
  return counted.includes(memory.kind) && memory.years > 0 ? `${memory.years} 周年` : null;
}
