import { router, useNavigation } from "expo-router";
import type { ReactNode } from "react";
import { ScrollView, type ScrollViewProps, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

function BackButton() {
  const ink = useCSSVariable("--color-foreground");
  return (
    <Button variant="secondary" size="icon" className="self-start" onPress={() => router.back()} accessibilityLabel="返回">
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path d="M15 5l-7 7 7 7" stroke={String(ink)} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Button>
  );
}

/** Every screen's frame: back button, a one-line label, the screen's only h1, then content. */
export function Page({
  label,
  title,
  children,
  ...scroll
}: { label?: string; title: string; children?: ReactNode } & Omit<ScrollViewProps, "children">) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-6 px-5 pb-12"
      contentContainerStyle={{ paddingTop: insets.top + 12 }}
      {...scroll}
    >
      <View className="gap-4">
        {navigation.canGoBack() ? <BackButton /> : null}
        <View className="gap-1">
          {label ? (
            <Text variant="small" className="text-highlight-foreground">
              {label}
            </Text>
          ) : null}
          <Text variant="h1">{title}</Text>
        </View>
      </View>
      {children}
    </ScrollView>
  );
}
