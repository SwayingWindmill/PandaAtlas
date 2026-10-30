import { Redirect, Tabs } from "expo-router";
import { Platform } from "react-native";

import { Icon } from "@/components/icon";
import { LayoutGrid, Search, Sun, UserRound } from "@/components/icons";
import { useWelcomeSeen } from "@/features/onboarding/welcome";
import { useIOSColors } from "@/lib/theme";

export default function WebTabsLayout() {
  const welcomeSeen = useWelcomeSeen();
  const colors = useIOSColors();
  if (welcomeSeen === null) return null;
  if (!welcomeSeen) return <Redirect href="/welcome" />;
  // Web has no system tab bar. This is a phone bar with a CSS blur, not Liquid Glass.
  // Icons are the same Lucide glyphs the native bar draws from PNGs.
  const bar = Platform.OS === "web"
    ? ({
        position: "absolute" as const,
        left: 0,
        right: 0,
        bottom: 0,
        borderTopWidth: 0.5,
        borderTopColor: colors.separator,
        backgroundColor: colors.scheme === "dark" ? "rgba(28,28,30,0.86)" : "rgba(255,255,255,0.86)",
        backdropFilter: "blur(24px)",
      } as const)
    : undefined;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.secondaryLabel,
        tabBarStyle: bar,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "500" },
      }}
    >
      <Tabs.Screen name="(today)" options={{ title: "今天", tabBarIcon: ({ color }) => <Icon icon={Sun} size={25} strokeWidth={1.9} color={color} /> }} />
      <Tabs.Screen name="find" options={{ title: "找熊猫", tabBarIcon: ({ color }) => <Icon icon={Search} size={25} strokeWidth={1.9} color={color} /> }} />
      <Tabs.Screen name="book" options={{ title: "图鉴", tabBarIcon: ({ color }) => <Icon icon={LayoutGrid} size={25} strokeWidth={1.9} color={color} /> }} />
      <Tabs.Screen name="me" options={{ title: "我的", tabBarIcon: ({ color }) => <Icon icon={UserRound} size={25} strokeWidth={1.9} color={color} /> }} />
    </Tabs>
  );
}
