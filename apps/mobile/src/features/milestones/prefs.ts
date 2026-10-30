import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

// 里程碑's one switch, kept on this device like 那年今天's: a viewing preference that needs no account and no
// server change. Off hides every milestone: the 我的 row and its page, the 图鉴 marks, 那年今天's 满月 and
// 满百天 and its "你的第 10 只", and the counted days on a panda's timeline.

export interface MilestonePrefs {
  off: boolean;
}

const KEY = "milestones";
const DEFAULT: MilestonePrefs = { off: false };
let current: MilestonePrefs | undefined;
let reading: Promise<MilestonePrefs> | undefined;
let pendingWrite = Promise.resolve();
const listeners = new Set<(prefs: MilestonePrefs) => void>();

export function parseMilestonePrefs(stored: string | null): MilestonePrefs {
  if (!stored) return DEFAULT;
  try {
    const value = JSON.parse(stored) as Partial<MilestonePrefs>;
    return { off: value.off === true };
  } catch {
    return DEFAULT;
  }
}

function read(): Promise<MilestonePrefs> {
  reading ??= AsyncStorage.getItem(KEY)
    .catch(() => null)
    .then((stored) => {
      current ??= parseMilestonePrefs(stored);
      return current;
    });
  return reading;
}

export function setMilestonePrefs(next: MilestonePrefs): void {
  current = next;
  for (const listener of listeners) listener(next);
  pendingWrite = pendingWrite.then(() => AsyncStorage.setItem(KEY, JSON.stringify(next))).catch(() => undefined);
}

/** The stored switch; null until read, so nothing flashes in and out. */
export function useMilestonePrefs(): MilestonePrefs | null {
  const [prefs, setPrefs] = useState<MilestonePrefs | null>(current ?? null);
  useEffect(() => {
    listeners.add(setPrefs);
    if (current === undefined) void read().then(setPrefs);
    return () => {
      listeners.delete(setPrefs);
    };
  }, []);
  return prefs;
}

/** True once read and switched on. */
export function useMilestonesOn(): boolean {
  const prefs = useMilestonePrefs();
  return prefs !== null && !prefs.off;
}
