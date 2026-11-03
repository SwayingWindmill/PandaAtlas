import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { ScrollView, View, type ScrollViewProps } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NO_WEB_BAR_TITLE } from "@/components/page";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { HAIRLINE } from "@/lib/surface";
import { cn } from "@/lib/utils";

import { useReadingTheme } from "./reading-theme";

/** The bar over a reading page: no title, on the paper itself, so no grey band sits above the column. */
function ReadingHeader() {
  const theme = useReadingTheme();
  return (
    <Stack.Screen
      options={{
        title: "",
        headerLargeTitleEnabled: false,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.paper },
        ...NO_WEB_BAR_TITLE,
      }}
    />
  );
}

/**
 * The 科普 reading column (DESIGN.md, "Reading column"): the `paper` ground, the large title kept in
 * the column with a secondary line under it naming the kind of page (DESIGN.md: no kicker above a title),
 * and the reading set below. Terms, face guides
 * and the challenge use it; an article draws its own column because its lead photo comes first.
 * The column arrives with `enter` once, when the page first has its data.
 */
export function ReadingPage({
  meta,
  title,
  lead,
  children,
  contentClassName,
  ...scroll
}: {
  meta: string;
  title: string;
  lead?: string;
  children?: ReactNode;
  contentClassName?: string;
} & Omit<ScrollViewProps, "children">) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      {...scroll}
    >
      <ReadingHeader />
      <Animated.View entering={PAGE_ENTER} className={cn("gap-section px-stack pt-stack-tight", contentClassName)}>
        <View className="gap-stack-tight">
          <Text variant="readingTitle">{title}</Text>
          <Text variant="footnote" className="text-muted-foreground tabular-nums">
            {meta}
          </Text>
          {lead ? <Text variant="readingLead">{lead}</Text> : null}
        </View>
        {children}
      </Animated.View>
    </ScrollView>
  );
}

/** A section inside the column: a reading heading, then its content. */
export function ReadingSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-row">
      <Text variant="readingHeading">{title}</Text>
      {children}
    </View>
  );
}

/** The hairline between rows of a list set straight on the paper, the way News lists its sources. */
export function ReadingRule({ inset = false }: { inset?: boolean }) {
  return <View className={cn("bg-border", inset && "ml-inset")} style={{ height: HAIRLINE }} />;
}

/** The paper ground a reading page stands on while it loads or fails. */
export function ReadingSkeletonGround({ children }: { children?: ReactNode }) {
  return (
    <View className="flex-1 bg-paper px-stack pt-stack">
      <ReadingHeader />
      {children}
    </View>
  );
}
