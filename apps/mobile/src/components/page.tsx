import { useNavigation } from "expo-router";
import { useLayoutEffect, type ReactNode } from "react";
import { Platform, ScrollView, type ScrollViewProps, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StatusBarCover } from "@/components/status-bar-cover";
import { Text } from "@/components/ui/text";
import { useBottomClearance } from "@/lib/bottom-clearance";
import { usePullToRefresh } from "@/lib/pull-to-refresh";

/**
 * Where the screen title is drawn.
 * iOS tab roots use the system large title, which collapses on scroll.
 * iOS pushed screens use the inline system title, except reading screens (`prominent`),
 * which keep the large title in the column the way 科普 does.
 * Web has no large-title bar, so the title is always in the column.
 * Android has no collapsing large title either, so a tab root draws its title in the column, as the
 * mockups do, and so does a `prominent` screen. Other pushed screens keep the title in the toolbar.
 */
function contentOwnsTitle(prominent: boolean, back: boolean) {
  if (Platform.OS === "web") return true;
  if (Platform.OS === "android") return prominent || !back;
  return prominent;
}

/** Off iOS a tab root has no navigation bar: its column starts under the status area and draws the title. */
export const ROOT_TITLE_IN_COLUMN = Platform.OS !== "ios";

/**
 * On the web an empty bar title is still an empty h1 that a screen reader stops on.
 * Spread into the options of any screen whose column draws the title.
 */
export const NO_WEB_BAR_TITLE = Platform.OS === "web" ? { headerTitle: () => null } : {};

/**
 * Air above the title on a barless root: about the height of the bar it stands in for. It is also the
 * height of the date line over the 今天 title with its top gap, so the four tab titles sit on one line.
 */
export const BARLESS_TOP = 24;

export function Page({
  label,
  dateline,
  title,
  back = true,
  prominent = false,
  children,
  ...scroll
}: {
  label?: string;
  /** A date over the large title (11月4日), as 今天 draws its own; it puts the title in the column. */
  dateline?: string;
  title: string;
  back?: boolean;
  /** Draw the large title in the column, and leave the bar as a back button. */
  prominent?: boolean;
  children?: ReactNode;
} & Omit<ScrollViewProps, "children">) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const bottom = useBottomClearance();
  const refreshControl = usePullToRefresh();
  const inContent = contentOwnsTitle(prominent || dateline !== undefined, back);
  // Off iOS a root screen (no back) has no bar at all, so the column clears the status area itself
  // and keeps a bar's worth of air above the large title instead of starting at the window's edge.
  const barless = ROOT_TITLE_IN_COLUMN && !back;
  useLayoutEffect(() => {
    navigation.setOptions({
      title: inContent ? "" : title,
      headerLargeTitleEnabled: Platform.OS === "ios" && !inContent && !back,
      headerBackVisible: back,
      headerShown: !barless,
      ...(inContent ? NO_WEB_BAR_TITLE : {}),
    });
  }, [navigation, title, back, prominent, inContent, barless]);

  return (
    <>
      {barless ? <StatusBarCover /> : null}
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-6 px-gutter"
        refreshControl={refreshControl}
        {...scroll}
        contentContainerStyle={[{ paddingBottom: bottom }, barless && { paddingTop: insets.top + BARLESS_TOP }, scroll.contentContainerStyle]}
      >
        {inContent ? (
          <View className="gap-1">
            {dateline ? (
              <Text variant="footnote" className="font-semibold text-muted-foreground">
                {dateline}
              </Text>
            ) : null}
            <Text variant="display" role="heading">
              {title}
            </Text>
            {label ? <Text variant="subheadline" className="text-muted-foreground">{label}</Text> : null}
          </View>
        ) : label || dateline ? (
          // A pushed Android screen keeps the title in its bar, so the date stands first in the column.
          <Text variant="subheadline" className="text-muted-foreground">
            {label ?? dateline}
          </Text>
        ) : null}
        {children}
      </ScrollView>
    </>
  );
}
