import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable } from "react-native";

import { Chevron } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Calendar } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { calendarMonth } from "@/features/calendar/calendar";
import { loadCalendarSources } from "@/features/calendar/sources";
import { localToday } from "@/features/engagement/seen";

/** Compact single-line birthday summary bar linking straight to 熊猫日历. */
export function TimelyBanner() {
  const today = localToday();
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));

  const { data } = useQuery({
    queryKey: ["public", "calendar-sources"],
    queryFn: loadCalendarSources,
    staleTime: 300_000,
    networkMode: "always",
  });

  const count = useMemo(() => {
    if (!data) return 0;
    const ids = new Set<string>();
    for (const day of calendarMonth(data.pandas, data.events, year, month)) {
      for (const entry of day.entries) {
        if (entry.key.startsWith("birthday:")) ids.add(entry.pandaId);
      }
    }
    return ids.size;
  }, [data, month, year]);

  if (count === 0) return null;

  return (
    <Pressable
      role="link"
      accessibilityLabel={`本月有 ${count} 只大熊猫过生日，查看日历`}
      onPress={() => router.push("/calendar")}
      className="min-h-11 flex-row items-center gap-stack-tight rounded-control bg-card px-3 py-2.5 active:opacity-75"
      style={{ borderCurve: "continuous" }}
    >
      <Icon icon={Calendar} size="footnote" tone="tint" strokeWidth={2} />
      <Text variant="subheadline" className="min-w-0 flex-1 font-medium" numberOfLines={1}>
        {`本月有 ${count} 只大熊猫过生日`}
        <Text variant="subheadline" className="text-muted-foreground">
          {"　查看日历"}
        </Text>
      </Text>
      <Chevron />
    </Pressable>
  );
}
