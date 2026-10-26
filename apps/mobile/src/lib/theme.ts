import { DarkTheme, DefaultTheme, type Theme } from "expo-router/react-navigation";

// The navigator's colors, matching the tokens in src/global.css. Screens use className tokens
// instead; this is only for what React Navigation and native props paint themselves.
export const THEME = {
  light: {
    background: "#fcfdfc",
    foreground: "#1d211c",
    card: "#fcfdfc",
    primary: "#1d211c",
    mutedForeground: "#60655f",
    border: "#d7dad7",
    input: "#b9bcb8",
    destructive: "#ce2c31",
  },
  dark: {
    background: "#111210",
    foreground: "#eceeec",
    card: "#181917",
    primary: "#eceeec",
    mutedForeground: "#afb5ad",
    border: "#383a36",
    input: "#5c625b",
    destructive: "#ff9592",
  },
};

export const NAV_THEME: Record<"light" | "dark", Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background: THEME.light.background,
      border: THEME.light.border,
      card: THEME.light.card,
      notification: THEME.light.destructive,
      primary: THEME.light.primary,
      text: THEME.light.foreground,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      background: THEME.dark.background,
      border: THEME.dark.border,
      card: THEME.dark.card,
      notification: THEME.dark.destructive,
      primary: THEME.dark.primary,
      text: THEME.dark.foreground,
    },
  },
};
