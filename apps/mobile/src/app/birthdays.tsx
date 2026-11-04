import { router } from "expo-router";
import { Linking, View } from "react-native";
import Animated from "react-native-reanimated";

import { ListCell, ListSection } from "@/components/grouped-list";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { PandaThumb } from "@/components/panda-thumb";
import { ScreenState } from "@/components/screen-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_ENTER } from "@/design/motion";
import { type WeekBirthday, whenLabel } from "@/features/birthdays/birthday-week";
import { eventsFor } from "@/features/birthdays/events";
import { BirthdayReminderSettings } from "@/features/birthdays/settings-section";
import { useBirthdayWeek } from "@/features/birthdays/use-week";
import { dayHeading } from "@/features/calendar/calendar";

/** The week's birthdays grouped by day, each heading saying how soon. */
function byDay(week: WeekBirthday[]): { date: string; inDays: number; entries: WeekBirthday[] }[] {
  const days = new Map<string, { date: string; inDays: number; entries: WeekBirthday[] }>();
  for (const entry of week) {
    const day = days.get(entry.date) ?? { date: entry.date, inDays: entry.inDays, entries: [] };
    days.set(entry.date, { ...day, entries: [...day.entries, entry] });
  }
  return [...days.values()];
}

/**
 * 生日周: every living panda with a birthday in the next seven days, from the published birth dates. Each
 * row opens its 生日卡, which links back to the profile. The opt-in reminder sits at the foot.
 */
export default function BirthdayWeekScreen() {
  const { data: week, isError, refetch } = useBirthdayWeek();

  return (
    <Page title="生日周" label="接下来 7 天">
      {isError ? (
        <LoadFailed message="生日周暂时打不开。" onRetry={() => void refetch()} />
      ) : !week ? (
        <View className="gap-1.5" accessibilityLabel="正在加载生日周">
          <Skeleton className="mx-inset h-4 w-28 rounded-control" />
          <Skeleton className="h-36 w-full rounded-group" />
        </View>
      ) : (
        <Animated.View entering={PAGE_ENTER} className="gap-section">
          {week.length === 0 ? (
            <ScreenState message="接下来 7 天没有记下的生日。有确切出生日期的熊猫，会在生日前一周出现在这里。" />
          ) : (
            byDay(week).map(({ date, inDays, entries }) => (
              <ListSection key={date} title={`${whenLabel(inDays)} · ${dayHeading(date)}`}>
                {entries.map((entry, index) => (
                  <ListCell
                    key={entry.pandaId}
                    label={entry.name}
                    detail={`${entry.age} 岁生日`}
                    leading={<PandaThumb pandaId={entry.pandaId} name={entry.name} size={44} shape="round" />}
                    onPress={() =>
                      router.push({ pathname: "/pandas/[slug]/share", params: { slug: entry.slug, birthday: String(entry.age) } })
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
          const events = (week ?? []).flatMap((e: WeekBirthday) => eventsFor(e.slug));
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
