import { createStoredPref } from "@/lib/stored-pref";

// 里程碑's one switch, kept on this device like 那年今天's: a viewing preference that needs no account and no
// server change. Off hides every milestone: the 我的 row and its page, the 图鉴 marks, 那年今天's 满月 and
// 满百天 and its "你的第 10 只", and the counted days on a panda's timeline.

export interface MilestonePrefs {
  off: boolean;
}

const DEFAULT: MilestonePrefs = { off: false };

export function parseMilestonePrefs(stored: string | null): MilestonePrefs {
  if (!stored) return DEFAULT;
  try {
    const value = JSON.parse(stored) as Partial<MilestonePrefs>;
    return { off: value.off === true };
  } catch {
    return DEFAULT;
  }
}

const pref = createStoredPref<MilestonePrefs>({
  key: "milestones",
  parse: parseMilestonePrefs,
  serialize: (next) => JSON.stringify(next),
});

export const setMilestonePrefs = pref.set;

/** The stored switch; null until read, so nothing flashes in and out. */
export const useMilestonePrefs = pref.useValue;

/** True once read and switched on. */
export function useMilestonesOn(): boolean {
  const prefs = useMilestonePrefs();
  return prefs !== null && !prefs.off;
}
