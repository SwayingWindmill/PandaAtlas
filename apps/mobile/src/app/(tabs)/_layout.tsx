import { Redirect, Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { Text } from "@/components/ui/text";
import { useWelcomeSeen } from "@/features/onboarding/welcome";
import { cn } from "@/lib/utils";

// The canvas's bottom navigation.
function TodayIcon({ color }: { color: ColorValue }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Circle cx={12} cy={12} r={4} />
      <Path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Svg>
  );
}

function FindIcon({ color }: { color: ColorValue }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Circle cx={11} cy={11} r={7} />
      <Path d="m20 20-3.5-3.5" />
    </Svg>
  );
}

function BookIcon({ color }: { color: ColorValue }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round">
      <Rect x={4} y={4} width={7} height={7} rx={1.5} />
      <Rect x={13} y={4} width={7} height={7} rx={1.5} />
      <Rect x={4} y={13} width={7} height={7} rx={1.5} />
      <Rect x={13} y={13} width={7} height={7} rx={1.5} />
    </Svg>
  );
}

function MeIcon({ color }: { color: ColorValue }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </Svg>
  );
}

function Label({ focused, children }: { focused: boolean; children: string }) {
  return <Text className={cn("text-xs", focused ? "font-bold text-foreground" : "text-muted-foreground")}>{children}</Text>;
}

export default function TabsLayout() {
  const [background, border, ink, muted] = useCSSVariable([
    "--color-background",
    "--color-border",
    "--color-foreground",
    "--color-muted-foreground",
  ]);
  // First launch opens the welcome; nothing shows while the device says whether it already did.
  const welcomeSeen = useWelcomeSeen();
  if (welcomeSeen === null) return null;
  if (!welcomeSeen) return <Redirect href="/welcome" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: String(ink),
        tabBarInactiveTintColor: String(muted),
        tabBarStyle: { backgroundColor: String(background), borderTopColor: String(border), borderTopWidth: 0.5, elevation: 0 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "今天",
          tabBarLabel: ({ focused }) => <Label focused={focused}>今天</Label>,
          tabBarIcon: ({ color }) => <TodayIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="find"
        options={{
          title: "找熊猫",
          tabBarLabel: ({ focused }) => <Label focused={focused}>找熊猫</Label>,
          tabBarIcon: ({ color }) => <FindIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="book"
        options={{
          title: "图鉴",
          tabBarLabel: ({ focused }) => <Label focused={focused}>图鉴</Label>,
          tabBarIcon: ({ color }) => <BookIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: "我的",
          tabBarLabel: ({ focused }) => <Label focused={focused}>我的</Label>,
          tabBarIcon: ({ color }) => <MeIcon color={color} />,
        }}
      />
    </Tabs>
  );
}
