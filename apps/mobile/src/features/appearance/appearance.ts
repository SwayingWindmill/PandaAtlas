import { Uniwind } from "uniwind";

import { createStoredPref } from "@/lib/stored-pref";

// 外观 in 我的: follow the system (the default), or keep light or dark. The choice stays on the device.

export type Appearance = "system" | "light" | "dark";

const CHOICES: readonly Appearance[] = ["system", "light", "dark"];

export const APPEARANCES: readonly { value: Appearance; label: string }[] = [
  { value: "system", label: "跟随系统" },
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
];

function isAppearance(value: unknown): value is Appearance {
  return typeof value === "string" && (CHOICES as readonly string[]).includes(value);
}

const pref = createStoredPref<Appearance>({
  key: "appearance",
  parse: (stored) => (isAppearance(stored) ? stored : "system"),
  serialize: (value) => value,
  onChange: (value) => Uniwind.setTheme(value),
});

/** Applies the stored choice at startup; nothing stored means following the system. */
export async function applyStoredAppearance(): Promise<void> {
  await pref.read();
}

export function useAppearance(): [Appearance, (next: Appearance) => void] {
  return [pref.useValue() ?? "system", pref.set];
}
