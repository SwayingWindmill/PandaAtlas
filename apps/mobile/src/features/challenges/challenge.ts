// 月度主题挑战: a month's small checklist kept on this device. Joining is opt-in and per month; nothing
// leaves the device. Themes are content, not code: `monthThemes` in data/curation/learning/learning.json,
// served by GET /api/v2/learning (month-themes.ts loads them). Tasks only point at existing pages, so a
// month with no theme still has a working default checklist.

export type TaskKind = "daily" | "guess" | "learn" | "checkin" | "collections" | "compare";

export interface ChallengeTask {
  id: string;
  kind: TaskKind;
}

export interface MonthlyTheme {
  /** Editorial slot: the month's theme name. */
  title: string | null;
  /** Editorial slot: one line under the title. */
  intro: string | null;
  tasks: ChallengeTask[];
}

export const TASK_ROUTES: Record<TaskKind, { label: string; href: string }> = {
  daily: { label: "看一次今日熊猫", href: "/daily" },
  guess: { label: "玩一局猜熊猫", href: "/guess" },
  learn: { label: "完成一次认脸练习", href: "/learn" },
  checkin: { label: "打卡一次", href: "/checkin" },
  collections: { label: "整理一个收藏夹", href: "/collections" },
  compare: { label: "对比两只熊猫", href: "/compare" },
};

export const DEFAULT_TASKS: ChallengeTask[] = (["daily", "guess", "learn", "checkin"] as const).map((kind) => ({
  id: kind,
  kind,
}));

/** A published theme as the learning catalog serves it. */
export interface MonthThemeEntry {
  month: string;
  title: { zh: string };
  intro: { zh: string } | null;
  tasks: TaskKind[];
}

export function monthKey(today: string): string {
  return today.slice(0, 7);
}

/** The month's theme, or the default checklist with no title when none is published. */
export function themeFor(month: string, themes: readonly MonthThemeEntry[] = []): MonthlyTheme {
  const entry = themes.find((theme) => theme.month === month);
  if (!entry) return { title: null, intro: null, tasks: DEFAULT_TASKS };
  const tasks = entry.tasks.filter((kind) => kind in TASK_ROUTES).map((kind) => ({ id: kind, kind }));
  return { title: entry.title.zh, intro: entry.intro?.zh || null, tasks: tasks.length > 0 ? tasks : DEFAULT_TASKS };
}

const MONTH_NAMES = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];

/** "十一月", as the challenge names its month. */
export function monthName(month: string): string {
  return MONTH_NAMES[Number(month.slice(5, 7)) - 1] ?? month;
}

export function fallbackTitle(month: string): string {
  return `${monthName(month)}挑战`;
}

/** Days left in the month after today: 26 on 11月4日. */
export function daysLeft(today: string): number {
  const [year, month, day] = today.split("-").map(Number);
  return new Date(Date.UTC(year!, month!, 0)).getUTCDate() - day!;
}

/** The months joined before this one, oldest first, each with whether every task was done. */
export function pastMonths(
  state: ChallengeState,
  month: string,
  themes: readonly MonthThemeEntry[] = [],
): { month: string; complete: boolean }[] {
  return [...new Set(state.joined)]
    .filter((joined) => joined < month)
    .sort()
    .map((joined) => {
      const { done, total } = progress(state, joined, themeFor(joined, themes));
      return { month: joined, complete: total > 0 && done === total };
    });
}

export interface ChallengeState {
  /** Months the person joined, "YYYY-MM". */
  joined: string[];
  /** "YYYY-MM" → done task ids. */
  done: Record<string, string[]>;
}

export const EMPTY_STATE: ChallengeState = { joined: [], done: {} };

export function parseChallengeState(stored: string | null): ChallengeState {
  if (!stored) return EMPTY_STATE;
  try {
    const value = JSON.parse(stored) as Partial<ChallengeState>;
    const joined = Array.isArray(value.joined) ? value.joined.filter((m) => typeof m === "string") : [];
    const done: Record<string, string[]> = {};
    if (value.done && typeof value.done === "object") {
      for (const [month, ids] of Object.entries(value.done)) {
        if (Array.isArray(ids)) done[month] = ids.filter((id) => typeof id === "string");
      }
    }
    return { joined, done };
  } catch {
    return EMPTY_STATE;
  }
}

export function setJoined(state: ChallengeState, month: string, on: boolean): ChallengeState {
  const joined = state.joined.filter((m) => m !== month);
  return { ...state, joined: on ? [...joined, month] : joined };
}

export function toggleTask(state: ChallengeState, month: string, id: string): ChallengeState {
  const current = state.done[month] ?? [];
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  return { ...state, done: { ...state.done, [month]: next } };
}

export function progress(state: ChallengeState, month: string, theme: MonthlyTheme = themeFor(month)): { done: number; total: number } {
  const tasks = theme.tasks;
  const done = state.done[month] ?? [];
  return { done: tasks.filter((t) => done.includes(t.id)).length, total: tasks.length };
}
