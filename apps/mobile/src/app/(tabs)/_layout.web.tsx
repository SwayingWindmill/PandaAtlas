import { Tabs } from "expo-router";
import { Platform } from "react-native";

import { Icon } from "@/components/icon";
import { Compass, MapIcon, Search, UserRound } from "@/components/icons";
import { component } from "@/design/tokens";
import { useIOSColors } from "@/lib/theme";

const TAB_ICON = component.tabBar.icon;

export default function WebTabsLayout() {
  const colors = useIOSColors();
  // Web has no system tab bar. This is a phone bar with a CSS blur, not Liquid Glass.
  // Icons are the same Lucide glyphs the native bar draws from PNGs.
  const bar = Platform.OS === "web"
    ? ({
        position: "absolute" as const,
        left: 0,
        right: 0,
        bottom: 0,
        height: component.tabBar.webHeight,
        borderTopWidth: 0.5,
        borderTopColor: colors.separator,
        backgroundColor: colors.barMaterial,
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
        // An explicit line height so CJK glyphs get their full line.
        tabBarLabelStyle: { fontSize: component.tabBar.label, lineHeight: component.tabBar.labelLine, fontWeight: "500" },
      }}
    >
      <Tabs.Screen name="(today)" options={{ title: "探索", tabBarIcon: ({ color }) => <Icon icon={Compass} size={TAB_ICON} strokeWidth={component.tabBar.iconStroke} color={color} /> }} />
      <Tabs.Screen name="find" options={{ title: "找熊猫", tabBarIcon: ({ color }) => <Icon icon={Search} size={TAB_ICON} strokeWidth={component.tabBar.iconStroke} color={color} /> }} />
      <Tabs.Screen name="map" options={{ title: "地图", tabBarIcon: ({ color }) => <Icon icon={MapIcon} size={TAB_ICON} strokeWidth={component.tabBar.iconStroke} color={color} /> }} />
      <Tabs.Screen name="me" options={{ title: "我的", tabBarIcon: ({ color }) => <Icon icon={UserRound} size={TAB_ICON} strokeWidth={component.tabBar.iconStroke} color={color} /> }} />
    </Tabs>
  );
}
