import { Tabs } from "expo-router/js-tabs";
import type { ColorValue } from "react-native";

import { CapsuleTabBar } from "@/components/capsule-tab-bar";
import { Icon } from "@/components/icon";
import { Compass, type LucideIcon, MapIcon, Search, UserRound } from "@/components/icons";
import { component } from "@/design/tokens";

/** A tab's Lucide glyph at the bar's size and stroke, in the color the bar hands it. */
function tabIcon(glyph: LucideIcon) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return <Icon icon={glyph} size={component.tabBar.icon} strokeWidth={component.tabBar.iconStroke} color={color} />;
  };
}

/**
 * Android's tabs: drawn by `CapsuleTabBar` over the page instead of the Material bar.
 * iOS keeps the system bar (`_layout.tsx`) and web its own (`_layout.web.tsx`).
 */
export default function AndroidTabsLayout() {
  return (
    <Tabs tabBar={(props) => <CapsuleTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="(today)" options={{ title: "探索", tabBarIcon: tabIcon(Compass) }} />
      <Tabs.Screen name="find" options={{ title: "找熊猫", tabBarIcon: tabIcon(Search) }} />
      <Tabs.Screen name="map" options={{ title: "地图", tabBarIcon: tabIcon(MapIcon) }} />
      <Tabs.Screen name="me" options={{ title: "我的", tabBarIcon: tabIcon(UserRound) }} />
    </Tabs>
  );
}
