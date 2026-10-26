import "@/global.css";

import { PortalHost } from "@rn-primitives/portal";
import { Stack } from "expo-router";
import { ThemeProvider } from "expo-router/react-navigation";
import { StatusBar } from "expo-status-bar";
import { useUniwind } from "uniwind";

import { NAV_THEME } from "@/lib/theme";

export default function RootLayout() {
  const { theme } = useUniwind();
  const scheme = theme === "dark" ? "dark" : "light";

  return (
    <ThemeProvider value={NAV_THEME[scheme]}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack>
        <Stack.Screen name="index" options={{ title: "吱熊猫" }} />
        <Stack.Screen name="daily" options={{ title: "每日一猫" }} />
        <Stack.Screen name="pandas/[slug]/family" options={{ title: "家谱" }} />
      </Stack>
      <PortalHost />
    </ThemeProvider>
  );
}
