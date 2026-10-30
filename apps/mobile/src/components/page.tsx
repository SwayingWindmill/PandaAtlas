import { useNavigation } from "expo-router";
import { useLayoutEffect, type ReactNode } from "react";
import { Platform, ScrollView, type ScrollViewProps, View } from "react-native";

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
  const inContent = contentOwnsTitle(prominent);
  useLayoutEffect(() => {
    navigation.setOptions({
      title: inContent ? "" : title,
      headerLargeTitleEnabled: Platform.OS === "ios" && !prominent && !back,
      headerBackVisible: back,
      headerShown: !(Platform.OS === "web" && !back),
    });
  }, [navigation, title, back, prominent, inContent]);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 px-4 pb-28"
      {...scroll}
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
