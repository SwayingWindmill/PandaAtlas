import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import type { ColorValue } from "react-native";

import { CapsuleTabBar } from "@/components/capsule-tab-bar";
import { Icon } from "@/components/icon";
import { Book, Calendar, type LucideIcon, Search, UserRound } from "@/components/icons";
import { component } from "@/design/tokens";
import { useWelcomeSeen } from "@/features/onboarding/welcome";

/** A tab's Lucide glyph at the bar's size and stroke, in the color the bar hands it. */
function tabIcon(glyph: LucideIcon) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return <Icon icon={glyph} size={component.tabBar.icon} strokeWidth={component.tabBar.iconStroke} color={color} />;
  };
}

/**
 * Android's tabs: the same four as iOS, drawn by `CapsuleTabBar` over the page instead of the
 * Material bar. iOS keeps the system bar (`_layout.tsx`) and web its own (`_layout.web.tsx`).
 */
export default function AndroidTabsLayout() {
  const welcomeSeen = useWelcomeSeen();
  if (welcomeSeen === null) return null;
  if (!welcomeSeen) return <Redirect href="/welcome" />;
  return (
    <Tabs tabBar={(props) => <CapsuleTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="(today)" options={{ title: "今天", tabBarIcon: tabIcon(Calendar) }} />
      <Tabs.Screen name="find" options={{ title: "找熊猫", tabBarIcon: tabIcon(Search) }} />
      <Tabs.Screen name="book" options={{ title: "图鉴", tabBarIcon: tabIcon(Book) }} />
      <Tabs.Screen name="me" options={{ title: "我的", tabBarIcon: tabIcon(UserRound) }} />
    </Tabs>
  );
}
