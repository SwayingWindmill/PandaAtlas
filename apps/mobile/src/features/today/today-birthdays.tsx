import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { type CalendarEntry, calendarMonth } from "@/features/calendar/calendar";
import { loadCalendarSources } from "@/features/calendar/sources";
import { localToday } from "@/features/engagement/seen";
import { openPanda } from "@/features/pandas/panda-row";
import { cn } from "@/lib/utils";

const SHOWN = 5;

/** 今天生日 on 今天: pandas whose birthday (or birth) falls on the fan's today, from the same rules as the calendar. */
export function TodayBirthdays() {
  const [entries, setEntries] = useState<CalendarEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      const today = localToday();
      loadCalendarSources()
        .then(({ pandas, events }) => {
          const month = calendarMonth(pandas, events, Number(today.slice(0, 4)), Number(today.slice(5, 7)));
          const day = month.find((item) => item.date === today);
          setEntries(day?.entries.filter((entry) => entry.key.startsWith("birthday:")) ?? []);
        })
        .catch(() => setEntries([]));
    }, []),
  );

  if (entries.length === 0) return null;
  const more = entries.length - SHOWN;
  return (
    <View className="gap-3 rounded-lg border-hairline border-border p-5">
      <Text variant="small" className="text-highlight-foreground">
        今天生日
      </Text>
      <View>
        {entries.slice(0, SHOWN).map((entry, index, shown) => (
          <Pressable
            key={entry.key}
            onPress={() => openPanda(entry.slug)}
            role="button"
            accessibilityLabel={`${entry.name}，${entry.what}`}
            className={cn(
              "flex-row items-center justify-between gap-3 py-2.5 active:bg-accent",
              index < shown.length - 1 && "border-b-hairline border-border",
            )}
          >
            <Text className="min-w-0 flex-1 font-bold" numberOfLines={1}>
              {entry.name}
            </Text>
            <Text variant="muted">{entry.what === "出生" ? "今天出生" : entry.what.replace("生日", "了")}</Text>
          </Pressable>
        ))}
      </View>
      {more > 0 ? (
        <Button variant="secondary" className="self-start" onPress={() => router.push("/calendar")}>
          <Text>{`还有 ${more} 只，看日历`}</Text>
        </Button>
      ) : null}
    </View>
  );
}
