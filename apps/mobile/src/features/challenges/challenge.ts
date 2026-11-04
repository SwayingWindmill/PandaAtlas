// 月度主题挑战: a month's small checklist kept on this device. Joining is opt-in and per month; nothing
// leaves the device. Theme title and intro are editorial slots (null until written); tasks only point at
// existing pages, so a month with no theme still has a working default checklist.

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

/** Keyed "YYYY-MM". Slots stay null until 编辑 writes them. */
export const MONTHLY_THEMES: Record<string, MonthlyTheme> = {
  "2026-11": { title: null, intro: null, tasks: DEFAULT_TASKS },
  "2026-12": { title: null, intro: null, tasks: DEFAULT_TASKS },
};

export function monthKey(today: string): string {
  return today.slice(0, 7);
}

export function themeFor(month: string): MonthlyTheme {
  return MONTHLY_THEMES[month] ?? { title: null, intro: null, tasks: DEFAULT_TASKS };
}

export function fallbackTitle(month: string): string {
  return `${Number(month.slice(5, 7))}月挑战`;
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

export function progress(state: ChallengeState, month: string): { done: number; total: number } {
  const tasks = themeFor(month).tasks;
  const done = state.done[month] ?? [];
  return { done: tasks.filter((t) => done.includes(t.id)).length, total: tasks.length };
}
