import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

// The 生日周 reminder is off until the fan turns it on. It is a viewing preference kept on this device: no
// account, no push, no server change. When on, 今天 says which followed pandas have a birthday this week.

const KEY = "birthdayReminder";
let current: boolean | undefined;
let reading: Promise<boolean> | undefined;
let pendingWrite = Promise.resolve();
const listeners = new Set<(on: boolean) => void>();

function read(): Promise<boolean> {
  reading ??= AsyncStorage.getItem(KEY)
    .catch(() => null)
    .then((stored) => {
      current ??= stored === "on";
      return current;
    });
  return reading;
}

export function setBirthdayReminder(on: boolean): void {
  current = on;
  for (const listener of listeners) listener(on);
  pendingWrite = pendingWrite.then(() => AsyncStorage.setItem(KEY, on ? "on" : "off")).catch(() => undefined);
}

/** Null until read, so the switch and the 今天 card do not flash. */
export function useBirthdayReminder(): boolean | null {
  const [on, setOn] = useState<boolean | null>(current ?? null);
  useEffect(() => {
    listeners.add(setOn);
    if (current === undefined) void read().then(setOn);
    return () => {
      listeners.delete(setOn);
    };
  }, []);
  return on;
}
