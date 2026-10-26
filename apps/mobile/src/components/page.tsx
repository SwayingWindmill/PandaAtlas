import { router } from "expo-router";
import { useNavigationState } from "expo-router/react-navigation";
import type { ReactNode } from "react";
import { ScrollView, type ScrollViewProps, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

export function BackButton({ className }: { className?: string }) {
  const ink = useCSSVariable("--color-foreground");
  return (
    <Button
      variant="secondary"
      size="icon"
      className={cn("self-start", className)}
      onPress={() => router.back()}
      accessibilityLabel="返回"
    >
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path d="M15 5l-7 7 7 7" stroke={String(ink)} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Button>
  );
}

/**
 * Back button, a one-line label and the screen's only h1. Tab roots pass `back={false}`: switching
 * tabs is not a history the button should walk.
 */
export function PageHeader({ label, title, back = true }: { label?: string; title: string; back?: boolean }) {
  // Subscribed, so the button appears once the push settles; a screen opened directly has nothing beneath it.
  const canGoBack = useNavigationState((state) => (state?.index ?? 0) > 0);
  return (
    <View className="gap-4">
      {back && canGoBack ? <BackButton /> : null}
      <View className="gap-1">
        {label ? (
          <Text variant="small" className="text-highlight-foreground">
            {label}
          </Text>
        ) : null}
        <Text variant="h1">{title}</Text>
      </View>
    </View>
  );
}

/** Every scrolling screen's frame: the header, then content. */
export function Page({
  label,
  title,
  back,
  children,
  ...scroll
}: { label?: string; title: string; back?: boolean; children?: ReactNode } & Omit<ScrollViewProps, "children">) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-6 px-5 pb-12"
      contentContainerStyle={{ paddingTop: insets.top + 12 }}
      {...scroll}
    >
      <PageHeader label={label} title={title} back={back} />
      {children}
    </ScrollView>
  );
}
