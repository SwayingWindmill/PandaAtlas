import { useQuery } from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Chevron } from "@/components/grouped-list";
import { PandaThumb } from "@/components/panda-thumb";
import { PressScale } from "@/components/press-scale";
import { SectionHeader } from "@/components/section-header";
import { Text } from "@/components/ui/text";
import { followedInWeek } from "@/features/birthdays/birthday-week";
import { useBirthdayReminder } from "@/features/birthdays/prefs";
import { useBirthdayWeek } from "@/features/birthdays/use-week";
import { calendarMonth } from "@/features/calendar/calendar";
import { loadCalendarSources } from "@/features/calendar/sources";
import { useFollowed } from "@/features/engagement/favorites";
import { localToday } from "@/features/engagement/seen";
import { openPanda } from "@/features/pandas/panda-row";
import { pandaIndexQueryOptions } from "@/features/pandas/pandas";
import { usePopularPandas } from "@/features/pandas/popular";

import { pickStarStrip } from "./gallery-filter";

const AVATAR_SIZE = 56;

function StripAvatar({ id, slug, name }: { id: string; slug: string; name: string }) {
  return (
    <PressScale
      onPress={() => openPanda(slug)}
      role="button"
      accessibilityLabel={name}
      className="items-center gap-1"
      style={{ width: AVATAR_SIZE + 6 }}
    >
      <PandaThumb pandaId={id} name={name} size={AVATAR_SIZE} />
      <Text variant="footnote" className="text-center font-medium" numberOfLines={1}>
        {name}
      </Text>
    </PressScale>
  );
}

/**
 * Top circular quick-jump strip consolidated with monthly/followed birthday context:
 * - Signed out or zero follows: 明星熊猫 ("关注后切为你的关注" + birthday pill when present).
 * - With followed pandas: 你关注的 N 只 + birthday action.
 */
export function StarOrFollowedStrip() {
  const followed = useFollowed();
  const { data: pandas } = useQuery(pandaIndexQueryOptions());
  const { rows: popular } = usePopularPandas(pandas);
  const reminderOn = useBirthdayReminder();
  const { data: week } = useBirthdayWeek();

  const today = localToday();
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));

  const { data: calendarSources } = useQuery({
    queryKey: ["public", "calendar-sources"],
    queryFn: loadCalendarSources,
    staleTime: 300_000,
    networkMode: "always",
  });

  const monthBirthdayCount = useMemo(() => {
    if (!calendarSources) return 0;
    const ids = new Set<string>();
    for (const day of calendarMonth(calendarSources.pandas, calendarSources.events, year, month)) {
      for (const entry of day.entries) {
        if (entry.key.startsWith("birthday:")) ids.add(entry.pandaId);
      }
    }
    return ids.size;
  }, [calendarSources, month, year]);

  const followedBirthdays = useMemo(() => {
    if (!reminderOn || !followed || !week) return [];
    return followedInWeek(week, followed);
  }, [followed, reminderOn, week]);

  const birthdayAction: { label: string; href: Href; accessibilityLabel: string } | undefined =
    followedBirthdays.length > 0
      ? {
          label: `近期 ${followedBirthdays.length} 只过生日`,
          href: "/birthdays",
          accessibilityLabel: `关注的 ${followedBirthdays.length} 只熊猫近期过生日，打开生日周`,
        }
      : monthBirthdayCount > 0
        ? {
            label: `本月 ${monthBirthdayCount} 只过生日`,
            href: "/calendar",
            accessibilityLabel: `本月 ${monthBirthdayCount} 只大熊猫过生日，打开熊猫日历`,
          }
        : undefined;

  const hasFollows = Boolean(followed && followed.size > 0);
  const items = useMemo(() => {
    if (!pandas) return [];
    if (hasFollows && followed) {
      return pandas.filter((panda) => followed.has(panda.id));
    }
    return pickStarStrip(pandas, popular, 10);
  }, [followed, hasFollows, pandas, popular]);

  if (items.length === 0) return null;

  return (
    <View className="gap-stack-tight">
      {hasFollows ? (
        <SectionHeader title={`你关注的 ${items.length} 只`} action={birthdayAction} />
      ) : (
        <View className="gap-0.5">
          <View className="flex-row items-baseline justify-between gap-row">
            <Text variant="title" className="min-w-0 flex-1" numberOfLines={1}>
              明星熊猫
            </Text>
            {birthdayAction ? (
              <Pressable
                role="link"
                accessibilityLabel={birthdayAction.accessibilityLabel}
                hitSlop={8}
                onPress={() => router.push(birthdayAction.href)}
                className="min-h-9 flex-row items-center gap-0.5 active:opacity-60"
              >
                <Text variant="footnote" className="font-semibold text-primary tabular-nums">
                  {birthdayAction.label}
                </Text>
                <Chevron />
              </Pressable>
            ) : (
              <Text variant="footnote" className="font-medium text-muted-foreground" numberOfLines={1}>
                关注后切为你的关注
              </Text>
            )}
          </View>
          {birthdayAction ? (
            <Text variant="footnote" className="text-muted-foreground" numberOfLines={1}>
              关注后切为你的关注
            </Text>
          ) : null}
        </View>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-gutter"
        contentContainerClassName="gap-row px-gutter"
      >
        {items.map((panda) => (
          <StripAvatar key={panda.id} id={panda.id} slug={panda.slug} name={panda.name} />
        ))}
      </ScrollView>
    </View>
  );
}
