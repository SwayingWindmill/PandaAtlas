import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";

import { PandaTile } from "@/components/panda-tile";
import { SectionHeader } from "@/components/section-header";
import { type CalendarEntry, calendarMonth, shiftMonth } from "@/features/calendar/calendar";
import { loadCalendarSources } from "@/features/calendar/sources";
import { localToday } from "@/features/engagement/seen";
import { openPanda } from "@/features/pandas/panda-row";

/** How many tiles the shelf shows before 看日历 takes over. */
const SHOWN = 10;
const GAP = 12;

interface Shelf {
  /** True when the entries are today's; otherwise they are the next birthdays this month and next. */
  today: boolean;
  entries: CalendarEntry[];
}

const isBirthday = (entry: CalendarEntry) => entry.key.startsWith("birthday:");

/** "11月3日" for an upcoming birthday's date. */
function monthDay(date: string) {
  return `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`;
}

/**
 * The birthdays shelf on 今天, a row of portrait photo tiles as Music shows albums. On a day with
 * birthdays it is 今天生日; otherwise it looks ahead to the next ones this month and next, so the
 * shelf still has something true to say. Both come from the calendar's own rules.
 */
export function TodayBirthdays() {
  const { width, fontScale } = useWindowDimensions();
  const [shelf, setShelf] = useState<Shelf | null>(null);

  useFocusEffect(
    useCallback(() => {
      const today = localToday();
      const year = Number(today.slice(0, 4));
      const month = Number(today.slice(5, 7));
      loadCalendarSources()
        .then(({ pandas, events }) => {
          const next = shiftMonth(year, month, 1);
          const days = [
            ...calendarMonth(pandas, events, year, month),
            ...calendarMonth(pandas, events, next.year, next.month),
          ];
          const todays = days.find((day) => day.date === today)?.entries.filter(isBirthday) ?? [];
          if (todays.length > 0) {
            setShelf({ today: true, entries: todays });
            return;
          }
          const upcoming = days.filter((day) => day.date > today).flatMap((day) => day.entries.filter(isBirthday));
          setShelf({ today: false, entries: upcoming });
        })
        .catch(() => setShelf(null));
    }, []),
  );

  if (!shelf || shelf.entries.length === 0) return null;
  // About two and a half tiles show, so the next one peeks in; they widen at large text sizes.
  const tile = Math.round(Math.min((Math.min(width, 700) - 32) * 0.4, 180) * Math.min(Math.max(fontScale, 1), 1.4));
  const more = shelf.entries.length - SHOWN;

  return (
    <View className="gap-row">
      <SectionHeader
        title={shelf.today ? "今天生日" : "快过生日了"}
        count={shelf.today ? `${shelf.entries.length} 只` : undefined}
        action={{
          label: more > 0 ? `还有 ${more} 只` : "看日历",
          href: "/calendar",
          accessibilityLabel: more > 0 ? `还有 ${more} 只，看日历` : "看日历",
        }}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-inset"
        contentContainerClassName="px-inset"
        contentContainerStyle={{ gap: GAP }}
        snapToInterval={tile + GAP}
        snapToAlignment="start"
        decelerationRate="fast"
      >
        {shelf.entries.slice(0, SHOWN).map((entry) => {
          const caption = shelf.today
            ? entry.what === "出生"
              ? "今天出生"
              : entry.what
            : `${monthDay(entry.date)}　${entry.what}`;
          return (
            <PandaTile
              key={entry.key}
              pandaId={entry.pandaId}
              name={entry.name}
              caption={caption}
              width={tile}
              onPress={() => openPanda(entry.slug)}
              accessibilityLabel={
                shelf.today ? `${entry.name}，${entry.what}` : `${entry.name}，${monthDay(entry.date)}${entry.what}`
              }
            />
          );
        })}
      </ScrollView>
    </View>
  );
}
