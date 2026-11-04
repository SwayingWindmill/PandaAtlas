import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Uniwind } from "uniwind";

// 外观 in 我的: follow the system (the default), or keep light or dark. The choice stays on the device.

export type Appearance = "system" | "light" | "dark";

const KEY = "appearance";
const CHOICES: readonly Appearance[] = ["system", "light", "dark"];
let revision = 0;
let pendingWrite = Promise.resolve();
let selected: Appearance | undefined;
/** Every mounted useAppearance, so 设置's 外观 row follows a choice made on the 外观 page. */
const listeners = new Set<(next: Appearance) => void>();

export const APPEARANCES: readonly { value: Appearance; label: string }[] = [
  { value: "system", label: "跟随系统" },
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
];

function isAppearance(value: unknown): value is Appearance {
  return typeof value === "string" && (CHOICES as readonly string[]).includes(value);
}

/** Applies the stored choice at startup; nothing stored means following the system. */
export async function applyStoredAppearance(): Promise<void> {
  const readRevision = revision;
  const stored = await AsyncStorage.getItem(KEY).catch(() => null);
  if (revision === readRevision) {
    selected = isAppearance(stored) ? stored : "system";
    Uniwind.setTheme(selected);
  }
}

export function useAppearance(): [Appearance, (next: Appearance) => void] {
  const [appearance, setAppearanceState] = useState<Appearance>(selected ?? "system");
  useEffect(() => {
    listeners.add(setAppearanceState);
    return () => {
      listeners.delete(setAppearanceState);
    };
  }, []);
  useEffect(() => {
    if (selected !== undefined) return;
    const readRevision = revision;
    AsyncStorage.getItem(KEY)
      .then((stored) => {
        if (revision === readRevision && isAppearance(stored)) setAppearanceState(stored);
      })
      .catch(() => undefined);
  }, []);
  function set(next: Appearance) {
    revision += 1;
    selected = next;
    for (const listener of listeners) listener(next);
    Uniwind.setTheme(next);
    pendingWrite = pendingWrite.then(() => AsyncStorage.setItem(KEY, next)).catch(() => undefined);
  }
  return [appearance, set];
}
