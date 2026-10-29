import { DarkTheme, DefaultTheme, type Theme } from "expo-router/react-navigation";
import { useUniwind } from "uniwind";

/**
 * iOS system colors. Grouped backgrounds, labels and separators are the system values.
 * Tint is the panda green, darkened just enough that white button labels and tint text
 * clear WCAG AA. Dark mode uses the brighter green for tint text on black.
 */
export const IOS = {
  light: {
    groupedBackground: "#F2F2F7",
    background: "#FFFFFF",
    card: "#FFFFFF",
    label: "#000000",
    secondaryLabel: "#636366",
    separator: "#C6C6C8",
    tint: "#1B7F64",
    button: "#1B7F64",
    buttonLabel: "#FFFFFF",
    destructive: "#CE2C31",
    warning: "#B25000",
    fill: "#E5E5EA",
    pressed: "#D1D1D6",
    highlightSoft: "#E5F4EE",
  },
  dark: {
    groupedBackground: "#000000",
    background: "#000000",
    card: "#1C1C1E",
    label: "#FFFFFF",
    secondaryLabel: "#AEAEB2",
    separator: "#38383A",
    tint: "#3DDC97",
    button: "#1B7F64",
    buttonLabel: "#FFFFFF",
    destructive: "#FF6961",
    warning: "#FF9F0A",
    fill: "#2C2C2E",
    pressed: "#3A3A3C",
    highlightSoft: "#0D2D23",
  },
} as const;

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
