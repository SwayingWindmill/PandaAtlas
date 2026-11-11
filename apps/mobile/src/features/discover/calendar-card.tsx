import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, View, useWindowDimensions } from "react-native";

import { Chevron } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { CalendarDays } from "@/components/icons";
import { PandaTile } from "@/components/panda-tile";
import { Text } from "@/components/ui/text";
import { type CalendarEntry, calendarMonth, shiftMonth } from "@/features/calendar/calendar";
import { loadCalendarSources } from "@/features/calendar/sources";
import { openPanda } from "@/features/pandas/panda-row";
import { pageColumn } from "@/lib/surface";

const SHOWN = 3;
/** The card's padding and the gap between its tiles (`inset`, `stack-tight`). */
const INSET = 16;
const TILE_GAP = 8;

/** "11月14日". */
function monthDay(date: string) {
  return `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`;
}

/** The next birthdays from today on, this month and next, in date order. */
async function upcomingBirthdays(today: string): Promise<CalendarEntry[]> {
  const { pandas, events } = await loadCalendarSources();
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const next = shiftMonth(year, month, 1);
  return [...calendarMonth(pandas, events, year, month), ...calendarMonth(pandas, events, next.year, next.month)]
    .filter((day) => day.date >= today)
    .flatMap((day) => day.entries.filter((entry) => entry.key.startsWith("birthday:")))
    .slice(0, SHOWN);
}

/**
 * 熊猫日历 on 发现: the calendar's own card, with the next few birthdays as photo tiles. The card opens the
 * calendar, where 那年今天 and 生日周 live by date too; a tile opens its panda. With no birthday ahead the
 * card still stands, since the calendar always has days to read.
 */
export function CalendarCard({ today }: { today: string }) {
  // A measured width: a tile that only flexes draws its scrim before it knows how wide it is.
  const tile = Math.floor((pageColumn(useWindowDimensions().width) - INSET * 2 - TILE_GAP * (SHOWN - 1)) / SHOWN);
  const { data: entries } = useQuery({ queryKey: ["discover-birthdays", today], queryFn: () => upcomingBirthdays(today) });
  return (
    <View className="gap-row rounded-card bg-card p-inset" style={{ borderCurve: "continuous" }}>
      <Pressable
        role="link"
        accessibilityLabel="熊猫日历"
        onPress={() => router.push("/calendar")}
        className="min-h-11 flex-row items-center gap-row active:opacity-60"
      >
        <Icon icon={CalendarDays} size="title3" tone="tint" />
        <View className="min-w-0 flex-1">
          <Text variant="title" role="none">
            熊猫日历
          </Text>
          <Text variant="subheadline" className="text-muted-foreground">
            {entries && entries.length > 0 ? "接下来过生日的熊猫" : "每天是谁的生日，哪天有纪念日"}
          </Text>
        </View>
        <Chevron />
      </Pressable>
      {entries && entries.length > 0 ? (
        <View className="flex-row gap-stack-tight">
          {entries.map((entry) => (
            <PandaTile
              key={entry.key}
              pandaId={entry.pandaId}
              name={entry.name}
              caption={monthDay(entry.date)}
              width={tile}
              onPress={() => openPanda(entry.slug)}
              accessibilityLabel={`${entry.name}，${monthDay(entry.date)}${entry.what}`}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
