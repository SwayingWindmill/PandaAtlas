import { useState } from "react";
import { type LayoutChangeEvent, View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import type { CheckinDayMark } from "./checkin";

/** The circle a day sits in, as Fitness marks a day: filled for a visit, soft for leave, dashed for 补请. */
export function DayCircle({
  mark,
  size,
  label,
  today,
}: {
  mark: CheckinDayMark;
  size: number;
  label?: string;
  today?: boolean;
}) {
  // Without a number (the week strip) an unmarked day is a quiet track, missed or not yet come alike.
  const track = !label && (mark === "none" || mark === "plannable");
  return (
    <View
      className={cn(
        "items-center justify-center rounded-full",
        mark === "visit" && "bg-primary",
        mark === "leave" && "bg-highlight-soft",
        mark === "retro" && "border border-dashed border-primary",
        track && "bg-secondary",
        mark !== "visit" && mark !== "leave" && mark !== "retro" && today && "border border-warm",
      )}
      style={{ width: size, height: size }}
      accessible={false}
    >
      {label ? (
        <Text
          variant={size < 32 ? "footnote" : "body"}
          className={cn(
            "tabular-nums",
            mark === "visit"
              ? "font-semibold text-primary-foreground"
              : mark === "leave" || mark === "retro"
                ? "font-semibold text-primary"
                : today
                  ? "font-semibold text-warm"
                  : mark === "none" && "text-muted-foreground",
          )}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}

/** A circle as wide as a seventh of the row allows, up to `max`: 7 circles always fit side by side. */
export function useDayCircle(max: number) {
  const [width, setWidth] = useState(0);
  const size = width > 0 ? Math.max(16, Math.min(max, Math.floor(width / 7) - 4)) : max;
  return { size, onLayout: (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width) };
}

/** One legend entry: the small circle, then its word. */
export function LegendItem({ mark, label }: { mark: CheckinDayMark; label: string }) {
  return (
    <View className="flex-row items-center gap-hair-gap">
      <DayCircle mark={mark} size={12} />
      <Text variant="footnote" className="text-muted-foreground">
        {label}
      </Text>
    </View>
  );
}
