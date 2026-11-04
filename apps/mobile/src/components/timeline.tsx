import { View } from "react-native";

import { Icon } from "@/components/icon";
import type { LucideIcon } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { component } from "@/design/tokens";
import { cn } from "@/lib/utils";

export interface TimelineItem {
  key: string;
  /** "2024 年 10 月 15 日", or a year. */
  date: string;
  title: string;
  /** A word after the date: what kind of event it was (迁居, 出生). */
  meta?: string;
  detail?: string;
  /** A trailing mark on the title line: a SourceBadge, a ConfirmedMark. */
  trailing?: React.ReactNode;
  icon?: LucideIcon;
}

/**
 * A vertical timeline, as Wallet and Find My list history: a 2pt rail with a dot per event, the
 * date (and its kind) above the title. Only the newest takes the vivid dot in a soft ring and a tint
 * date; the rest are small tertiary dots. The rail is `border`, so the dots carry the color. Each item reads as one sentence.
 * RN registries have no timeline (ReUI/Kibo are web only), so it is a composition.
 */
/** The newest dot, and the soft ring around it; the others are smaller and quiet. */
const NOW_DOT = 12;
const NOW_RING = 4;
const DOT = 9;

export function Timeline({ items, newestFirst = true }: { items: TimelineItem[]; newestFirst?: boolean }) {
  const { rail, column } = component.timeline;
  const newest = newestFirst ? 0 : items.length - 1;
  return (
    <View>
      {items.map((item, index) => {
        const isNewest = index === newest;
        const first = index === 0;
        const last = index === items.length - 1;
        return (
          <View
            key={item.key}
            className="flex-row gap-row"
            accessible
            accessibilityLabel={`${item.date}${item.meta ? `，${item.meta}` : ""}，${item.title}${item.detail ? `，${item.detail}` : ""}${isNewest ? "，最新" : ""}`}
          >
            <View style={{ width: column }} className="items-center">
              <View className={cn("bg-border", first && "opacity-0")} style={{ width: rail, height: 6 }} />
              {item.icon ? (
                <Icon icon={item.icon} size="footnote" tone={isNewest ? "tint" : "graphic"} />
              ) : (
                <View
                  className={cn("rounded-pill", isNewest ? "border-highlight-soft bg-graphic" : "bg-tertiary-foreground")}
                  style={
                    isNewest
                      ? { width: NOW_DOT + NOW_RING * 2, height: NOW_DOT + NOW_RING * 2, borderWidth: NOW_RING }
                      : { width: DOT, height: DOT, marginVertical: (NOW_DOT - DOT) / 2 }
                  }
                />
              )}
              <View className={cn("flex-1 bg-border", last && "opacity-0")} style={{ width: rail }} />
            </View>
            <View className={cn("min-w-0 flex-1 gap-hair-gap", !last && "pb-stack")}>
              <View className="flex-row items-center gap-1.5">
                <Text variant="footnote" className={cn("font-semibold tabular-nums", isNewest ? "text-primary" : "text-muted-foreground")}>
                  {item.date}
                </Text>
                {item.meta ? (
                  <Text variant="footnote" className="text-muted-foreground">
                    {item.meta}
                  </Text>
                ) : null}
              </View>
              <View className="flex-row items-center gap-hair-gap">
                <Text variant="subheadline" className="shrink font-semibold">
                  {item.title}
                </Text>
                {item.trailing}
              </View>
              {item.detail ? (
                <Text variant="footnote" className="text-muted-foreground">
                  {item.detail}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
