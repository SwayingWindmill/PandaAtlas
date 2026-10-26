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

  // Screens draw their own back button and title (components/page.tsx), so there is no nav bar.
  return (
    <ThemeProvider value={NAV_THEME[scheme]}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }} />
      <PortalHost />
    </ThemeProvider>
  );
}
