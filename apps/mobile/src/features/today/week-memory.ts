import type { Memory, MemoryKind, MemorySubject } from "@/features/on-this-day/on-this-day";

/** How far ahead the head of 今天 looks for an anniversary, today included. */
export const WEEK_DAYS = 7;

/** The kinds that can take the head of 今天, the first winning a tie on the same day. */
const KINDS: MemoryKind[] = ["home", "arrival", "birthday"];

export interface WeekMemory {
  kind: "home" | "arrival" | "birthday";
  /** The anniversary this year, YYYY-MM-DD. */
  date: string;
  /** 0 on the day itself. */
  daysLeft: number;
  years: number;
  /** "回国 3 周年", "到新家 2 周年", "6 岁生日". */
  title: string;
  /** 那年今天, or 生日周 for a birthday. */
  label: string;
  /** Every panda the day is about, in the order the records give them. */
  pandas: MemorySubject[];
}

function title(kind: WeekMemory["kind"], years: number): string {
  if (kind === "home") return `回国 ${years} 周年`;
  if (kind === "arrival") return `到新家 ${years} 周年`;
  return `${years} 岁生日`;
}

/**
 * The nearest public anniversary of the week: each entry is one day's memories, today first. On a day the
 * pandas with the same kind and years are told together; coming home beats coming to a place beats a
 * birthday. A deceased panda and the fan's own records never take the head. Null when the first `within`
 * days have none.
 */
export function weekMemory(days: { date: string; memories: Memory[] }[], within = WEEK_DAYS): WeekMemory | null {
  for (const [daysLeft, day] of days.slice(0, within).entries()) {
    const wanted = day.memories.filter((memory) => KINDS.includes(memory.kind) && !memory.personal && !memory.deceased);
    for (const kind of KINDS) {
      const ofKind = wanted.filter((memory) => memory.kind === kind);
      if (ofKind.length === 0) continue;
      const years = ofKind[0]!.years;
      const pandas: MemorySubject[] = [];
      for (const memory of ofKind) {
        if (memory.years === years && !pandas.some((panda) => panda.key === memory.subject.key)) pandas.push(memory.subject);
      }
      const known = kind as WeekMemory["kind"];
      return {
        kind: known,
        date: day.date,
        daysLeft,
        years,
        title: title(known, years),
        label: known === "birthday" ? "生日周" : "那年今天",
        pandas,
      };
    }
  }
  return null;
}
