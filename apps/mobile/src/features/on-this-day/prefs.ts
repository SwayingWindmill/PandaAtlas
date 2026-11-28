import { createStoredPref } from "@/lib/stored-pref";

import { DEFAULT_PREFS, type MemoryPrefs } from "./on-this-day";

// 那年今天's two switches, 少显示 (per panda or place) and 关闭, kept on this device. They are a viewing
// preference with no value elsewhere, so they need no account, work signed out, and cost no server change.

function parse(stored: string | null): MemoryPrefs {
  if (!stored) return DEFAULT_PREFS;
  try {
    const value = JSON.parse(stored) as Partial<MemoryPrefs>;
    return {
      off: value.off === true,
      less: Array.isArray(value.less) ? value.less.filter((key): key is string => typeof key === "string") : [],
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

const pref = createStoredPref<MemoryPrefs>({
  key: "onThisDay",
  parse,
  serialize: (next) => JSON.stringify(next),
});

export const setMemoryPrefs = pref.set;

/** The stored switches; null until read, so nothing flashes in and out. */
export const useMemoryPrefs = pref.useValue;

export function showLess(prefs: MemoryPrefs, subjectKey: string): MemoryPrefs {
  return prefs.less.includes(subjectKey) ? prefs : { ...prefs, less: [...prefs.less, subjectKey] };
}

export function showAgain(prefs: MemoryPrefs, subjectKey: string): MemoryPrefs {
  return { ...prefs, less: prefs.less.filter((key) => key !== subjectKey) };
}
