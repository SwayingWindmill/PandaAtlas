import { DarkTheme, DefaultTheme, type Theme } from "expo-router/react-navigation";
import { useUniwind } from "uniwind";

import { semantic } from "@/design/tokens";

/**
 * The color roles for both appearances, straight from the design tokens (src/design/tokens.ts),
 * so code, global.css and DESIGN.md can't drift. Grouped backgrounds, labels and separators are the
 * iOS system values. v2.15 (direction C 熊猫): panda black and white,
 * neutral grey cards, one sky-blue tint (#0A6CDB light, #5AB4FF dark). The filled button is ink
 * with a white label in light mode and white with a black label in dark. No warm accent.
 */
export const IOS = semantic.color;

export type AppearanceScheme = keyof typeof IOS;

export function useIOSColors() {
  const { theme } = useUniwind();
  const scheme: AppearanceScheme = theme === "dark" ? "dark" : "light";
  return { scheme, ...IOS[scheme] };
}

// The navigator's colors. Screens use class names; this is what the native stack and tabs paint.
export const NAV_THEME: Record<AppearanceScheme, Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background: IOS.light.groupedBackground,
      border: IOS.light.separator,
      card: IOS.light.card,
      notification: IOS.light.destructive,
      primary: IOS.light.tint,
      text: IOS.light.label,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      background: IOS.dark.groupedBackground,
      border: IOS.dark.separator,
      card: IOS.dark.card,
      notification: IOS.dark.destructive,
      primary: IOS.dark.tint,
      text: IOS.dark.label,
    },
  },
};
