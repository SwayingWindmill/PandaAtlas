import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

import { DEFAULT_PREFS, type MemoryPrefs } from "./on-this-day";

// 那年今天's two switches, 少显示 (per panda or place) and 关闭, kept on this device. They are a viewing
// preference with no value elsewhere, so they need no account, work signed out, and cost no server change.

const KEY = "onThisDay";
let current: MemoryPrefs | undefined;
let reading: Promise<MemoryPrefs> | undefined;
let pendingWrite = Promise.resolve();
const listeners = new Set<(prefs: MemoryPrefs) => void>();

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

function read(): Promise<MemoryPrefs> {
  reading ??= AsyncStorage.getItem(KEY)
    .catch(() => null)
    .then((stored) => {
      current ??= parse(stored);
      return current;
    });
  return reading;
}

export function setMemoryPrefs(next: MemoryPrefs): void {
  current = next;
  for (const listener of listeners) listener(next);
  pendingWrite = pendingWrite.then(() => AsyncStorage.setItem(KEY, JSON.stringify(next))).catch(() => undefined);
}

/** The stored switches; null until read, so nothing flashes in and out. */
export function useMemoryPrefs(): MemoryPrefs | null {
  const [prefs, setPrefs] = useState<MemoryPrefs | null>(current ?? null);
  useEffect(() => {
    listeners.add(setPrefs);
    if (current === undefined) void read().then(setPrefs);
    return () => {
      listeners.delete(setPrefs);
    };
  }, []);
  return prefs;
}

export function showLess(prefs: MemoryPrefs, subjectKey: string): MemoryPrefs {
  return prefs.less.includes(subjectKey) ? prefs : { ...prefs, less: [...prefs.less, subjectKey] };
}

export function showAgain(prefs: MemoryPrefs, subjectKey: string): MemoryPrefs {
  return { ...prefs, less: prefs.less.filter((key) => key !== subjectKey) };
}
