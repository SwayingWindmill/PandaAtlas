import { Redirect } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { DynamicColorIOS, Platform } from "react-native";

import { useWelcomeSeen } from "@/features/onboarding/welcome";
import { IOS, useIOSColors } from "@/lib/theme";

const iosTint = Platform.OS === "ios" ? DynamicColorIOS({ light: IOS.light.tint, dark: IOS.dark.tint }) : null;

export default function TabsLayout() {
  const welcomeSeen = useWelcomeSeen();
  const { tint: schemeTint } = useIOSColors();
  const tint = iosTint ?? schemeTint;
  if (welcomeSeen === null) return null;
  if (!welcomeSeen) return <Redirect href="/welcome" />;
  // iOS 26 draws this bar in Liquid Glass and ignores backgroundColor and blurEffect.
  // Earlier iOS uses the system tab bar. Android uses Material 3. Web uses _layout.web.tsx.
  return (
    <NativeTabs tintColor={tint} minimizeBehavior="onScrollDown" disableTransparentOnScrollEdge>
      <NativeTabs.Trigger name="(today)">
        <NativeTabs.Trigger.Label>今天</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "sun.max", selected: "sun.max.fill" }} md="wb_sunny" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="find">
        <NativeTabs.Trigger.Label>找熊猫</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="book">
        <NativeTabs.Trigger.Label>图鉴</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }} md="grid_view" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Label>我的</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "person", selected: "person.fill" }} md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
