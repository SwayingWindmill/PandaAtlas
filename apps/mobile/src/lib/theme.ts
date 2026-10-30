import { DarkTheme, DefaultTheme, type Theme } from "expo-router/react-navigation";
import { useUniwind } from "uniwind";

/**
 * iOS system colors. Grouped backgrounds, labels and separators are the system values.
 * Tint is a deep bamboo green (#165C3C, 8:1 on white) in light mode and a pale jade
 * (#7DCAA4, 11:1 on black) in dark mode, where filled buttons take black labels.
 * highlightSoft is the tint at about 12% (light) and 18% (dark): the iOS "tinted" button fill.
 */
export const IOS = {
  light: {
    groupedBackground: "#F2F2F7",
    background: "#FFFFFF",
    card: "#FFFFFF",
    label: "#000000",
    secondaryLabel: "#636366",
    separator: "#C6C6C8",
    tertiaryLabel: "#C4C4C7",
    tint: "#165C3C",
    button: "#165C3C",
    buttonLabel: "#FFFFFF",
    destructive: "#CE2C31",
    warning: "#B25000",
    fill: "#E5E5EA",
    pressed: "#D1D1D6",
    highlightSoft: "#E3EBE8",
  },
  dark: {
    groupedBackground: "#000000",
    background: "#000000",
    card: "#1C1C1E",
    label: "#FFFFFF",
    secondaryLabel: "#AEAEB2",
    separator: "#38383A",
    tertiaryLabel: "#5B5B60",
    tint: "#7DCAA4",
    button: "#7DCAA4",
    buttonLabel: "#000000",
    destructive: "#FF6961",
    warning: "#FF9F0A",
    fill: "#2C2C2E",
    pressed: "#3A3A3C",
    highlightSoft: "#16241E",
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
