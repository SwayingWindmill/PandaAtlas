import { router } from "expo-router";
import { Linking, View } from "react-native";
import Animated from "react-native-reanimated";

import { ListCell, ListSection } from "@/components/grouped-list";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { PandaThumb } from "@/components/panda-thumb";
import { ScreenState } from "@/components/screen-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { WEEK_DAYS, type WeekBirthday, whenLabel } from "@/features/birthdays/birthday-week";
import { eventsFor } from "@/features/birthdays/events";
import { BirthdayReminderSettings } from "@/features/birthdays/settings-section";
import { useBirthdayWeek } from "@/features/birthdays/use-week";
import { dayHeading } from "@/features/calendar/calendar";
import { localToday } from "@/features/engagement/seen";
import { cn } from "@/lib/utils";

/** The week's birthdays grouped by day, each heading saying how soon. */
function byDay(week: WeekBirthday[]): { date: string; inDays: number; entries: WeekBirthday[] }[] {
  const days = new Map<string, { date: string; inDays: number; entries: WeekBirthday[] }>();
  for (const entry of week) {
    const day = days.get(entry.date) ?? {
      date: entry.date,
      inDays: entry.inDays,
      entries: [],
    };
    days.set(entry.date, { ...day, entries: [...day.entries, entry] });
  }
  return [...days.values()];
}

const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];

function addDays(date: string, by: number): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + by);
  return day.toISOString().slice(0, 10);
}

/**
 * The seven days as a strip (v4 `08-birthday-week`): weekday over date, today on an ink tile, a dot under
 * each day with a birthday. VoiceOver hears it as one line; the groups below carry the names.
 */
function WeekStrip({ today, week }: { today: string; week: WeekBirthday[] }) {
  const busy = new Set(week.map((entry) => entry.date));
  const days = Array.from({ length: WEEK_DAYS }, (_, index) => addDays(today, index));
  return (
    <View className="flex-row" accessible accessibilityLabel={`接下来 7 天，${busy.size} 天有生日`}>
      {days.map((date, index) => {
        const isToday = index === 0;
        return (
          <View
            key={date}
            className={cn("flex-1 items-center gap-hair-gap rounded-control py-stack-tight", isToday && "bg-foreground")}
            style={{ borderCurve: "continuous" }}
          >
            <Text variant="footnote" className={cn("font-semibold", isToday ? "text-background" : "text-muted-foreground")}>
              {WEEKDAY[new Date(`${date}T00:00:00Z`).getUTCDay()]}
            </Text>
            <Text variant="headline" className={cn("font-rounded tabular-nums", isToday && "text-background")}>
              {Number(date.slice(8, 10))}
            </Text>
            <View
              className={cn("rounded-pill", busy.has(date) ? (isToday ? "bg-background" : "bg-graphic") : "bg-transparent")}
              style={{ width: 6, height: 6 }}
            />
          </View>
        );
      })}
    </View>
  );
}

/**
 * 生日周: every living panda with a birthday in the next seven days, from the published birth dates. Each
 * row opens its 生日卡, which links back to the profile. The opt-in reminder sits at the foot.
 */
export default function BirthdayWeekScreen() {
  const { data: week, isError, refetch } = useBirthdayWeek();
  const today = localToday();

  return (
    <Page title="生日周" dateline="接下来 7 天">
      {isError ? (
        <LoadFailed message="生日周暂时打不开。" onRetry={() => void refetch()} />
      ) : !week ? (
        <View className="gap-1.5" accessibilityLabel="正在加载生日周">
          <Skeleton className="mx-inset h-4 w-28 rounded-control" />
          <Skeleton className="h-36 w-full rounded-group" />
        </View>
      ) : (
        <Animated.View entering={PAGE_ENTER} className="gap-section">
          <WeekStrip today={today} week={week} />
          {week.length === 0 ? (
            <ScreenState message="接下来 7 天没有记下的生日。有确切出生日期的熊猫，会在生日前一周出现在这里。" />
          ) : (
            byDay(week).map(({ date, inDays, entries }) => (
              <ListSection key={date} title={`${whenLabel(inDays)} · ${dayHeading(date)}`}>
                {entries.map((entry, index) => (
                  <ListCell
                    key={entry.pandaId}
                    label={entry.name}
                    meta={`${entry.age} 岁`}
                    leading={<PandaThumb pandaId={entry.pandaId} name={entry.name} size={44} shape="round" />}
                    onPress={() =>
                      router.push({
                        pathname: "/pandas/[slug]/share",
                        params: {
                          slug: entry.slug,
                          birthday: String(entry.age),
                        },
                      })
                    }
                    accessibilityLabel={`${entry.name}，${whenLabel(entry.inDays)}${entry.age} 岁生日`}
                    accessibilityHint="打开它的生日卡"
                    last={index === entries.length - 1}
                  />
                ))}
              </ListSection>
            ))
          )}
          {(() => {
            const events = week.flatMap((entry) => eventsFor(entry.slug));
            return events.length ? (
              <ListSection title="官方生日活动" footer="仅收录园方官方公告，点开查看原文。">
                {events.map((ev, i) => (
                  <ListCell
                    key={ev.url}
                    label={ev.title}
                    detail={`${ev.source} · ${ev.date}`}
                    onPress={() => void Linking.openURL(ev.url)}
                    accessibilityHint="在浏览器打开官方公告"
                    last={i === events.length - 1}
                  />
                ))}
              </ListSection>
            ) : null;
          })()}
          <BirthdayReminderSettings />
        </Animated.View>
      )}
    </Page>
  );
}
