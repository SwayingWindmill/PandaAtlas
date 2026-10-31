import { useNavigation } from "expo-router";
import { useLayoutEffect, type ReactNode } from "react";
import { Platform, ScrollView, type ScrollViewProps, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";

/**
 * Where the screen title is drawn.
 * iOS tab roots use the system large title, which collapses on scroll.
 * iOS pushed screens use the inline system title, except reading screens (`prominent`),
 * which keep the large title in the column the way 科普 does.
 * Web has no large-title bar, so the title is always in the column. Android uses the toolbar.
 */
function contentOwnsTitle(prominent: boolean) {
  if (Platform.OS === "web") return true;
  return prominent && Platform.OS === "ios";
}

/**
 * On the web an empty bar title is still an empty h1 that a screen reader stops on.
 * Spread into the options of any screen whose column draws the title.
 */
export const NO_WEB_BAR_TITLE = Platform.OS === "web" ? { headerTitle: () => null } : {};

/** Air above the title on a barless web root: about the height of the bar it stands in for. */
const BARLESS_TOP = 24;

export function Page({
  label,
  title,
  back = true,
  prominent = false,
  children,
  ...scroll
}: {
  label?: string;
  title: string;
  back?: boolean;
  /** Draw the large title in the column, and leave the bar as a back button. */
  prominent?: boolean;
  children?: ReactNode;
} & Omit<ScrollViewProps, "children">) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const inContent = contentOwnsTitle(prominent);
  // On web a root screen (no back) has no bar at all, so the column clears the status area itself
  // and keeps a bar's worth of air above the large title instead of starting at the window's edge.
  const barless = Platform.OS === "web" && !back;
  useLayoutEffect(() => {
    navigation.setOptions({
      title: inContent ? "" : title,
      headerLargeTitleEnabled: Platform.OS === "ios" && !prominent && !back,
      headerBackVisible: back,
      headerShown: !barless,
      ...(inContent ? NO_WEB_BAR_TITLE : {}),
    });
  }, [navigation, title, back, prominent, inContent, barless]);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 px-4 pb-28"
      {...scroll}
      contentContainerStyle={[barless && { paddingTop: insets.top + BARLESS_TOP }, scroll.contentContainerStyle]}
    >
      {inContent ? (
        <View className="gap-1">
          <Text variant="display">{title}</Text>
          {label ? <Text variant="subheadline" className="text-muted-foreground">{label}</Text> : null}
        </View>
      ) : label ? (
        <Text variant="subheadline" className="text-muted-foreground">
          {label}
        </Text>
      ) : null}
      {children}
    </ScrollView>
  );
}
