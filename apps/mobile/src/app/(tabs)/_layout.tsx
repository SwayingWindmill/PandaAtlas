import { Redirect } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { DynamicColorIOS, Platform } from "react-native";

import { useWelcomeSeen } from "@/features/onboarding/welcome";
import { NATIVE_SYMBOLS, nanoSymbol } from "@/lib/native-symbols";
import { IOS, useIOSColors } from "@/lib/theme";

/**
 * Lucide glyphs (sun, search, layout-grid, user-round), because the system tab bar takes images,
 * not components. The bar tints them: secondary label at rest, tint when selected. A native build
 * uses them as custom SF Symbols and VectorDrawables (see `lib/native-symbols.ts`), which scale with
 * the bar and follow the symbol weight; Expo Go uses the same glyphs as template PNGs at 25pt.
 * Regenerate both from Lucide with `node scripts/tab-icons.mjs`.
 */
const TAB_ICON = {
  today: require("../../../assets/tab-icons/today.png"),
  find: require("../../../assets/tab-icons/search.png"),
  book: require("../../../assets/tab-icons/atlas.png"),
  me: require("../../../assets/tab-icons/me.png"),
};

function TabIcon({ symbol, png }: { symbol: Parameters<typeof nanoSymbol>[0]; png: number }) {
  return NATIVE_SYMBOLS ? (
    <NativeTabs.Trigger.Icon {...nanoSymbol(symbol)} renderingMode="template" />
  ) : (
    <NativeTabs.Trigger.Icon src={png} renderingMode="template" />
  );
}

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
        <TabIcon symbol="today" png={TAB_ICON.today} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="find">
        <NativeTabs.Trigger.Label>找熊猫</NativeTabs.Trigger.Label>
        <TabIcon symbol="search" png={TAB_ICON.find} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="book">
        <NativeTabs.Trigger.Label>图鉴</NativeTabs.Trigger.Label>
        <TabIcon symbol="atlas" png={TAB_ICON.book} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Label>我的</NativeTabs.Trigger.Label>
        <TabIcon symbol="me" png={TAB_ICON.me} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
