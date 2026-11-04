import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

import { Icon } from "@/components/icon";
import { Cake, MapPin } from "@/components/icons";
import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { Scrim } from "@/components/scrim";
import { Text } from "@/components/ui/text";
import { calendarMonth, shiftMonth } from "@/features/calendar/calendar";
import { loadCalendarSources } from "@/features/calendar/sources";
import { localToday } from "@/features/engagement/seen";
import { openPanda } from "@/features/pandas/panda-row";
import { loadPandaIndex } from "@/features/pandas/pandas";
import { semantic } from "@/design/tokens";
import { usePandaCover } from "@/lib/covers";
import { RADIUS } from "@/lib/surface";

import { type BirthdayWeek, birthdayWeek } from "./birthday-week";

interface Hero extends BirthdayWeek {
  place: string | null;
}

/** The week's nearest birthday, loaded on focus; null while loading or when the week has none. */
export function useBirthdayWeek(): Hero | null | undefined {
  const [hero, setHero] = useState<Hero | null | undefined>(undefined);
  useFocusEffect(
    useCallback(() => {
      const today = localToday();
      const year = Number(today.slice(0, 4));
      const month = Number(today.slice(5, 7));
      Promise.all([loadCalendarSources(), loadPandaIndex()])
        .then(([{ pandas, events }, index]) => {
          const next = shiftMonth(year, month, 1);
          const week = birthdayWeek(
            [...calendarMonth(pandas, events, year, month), ...calendarMonth(pandas, events, next.year, next.month)],
            today,
          );
          setHero(week ? { ...week, place: index.find((panda) => panda.id === week.entry.pandaId)?.place ?? null } : null);
        })
        .catch(() => setHero(null));
    }, []),
  );
  return hero;
}

/**
 * 生日周 at the head of 今天: the panda whose birthday is nearest this week, on its photo, with where it
 * lives and how many days are left.
 */
export function BirthdayHero({ hero, height }: { hero: Hero; height: number }) {
  const cover = usePandaCover(hero.entry.pandaId);
  const { entry, daysLeft, place } = hero;
  const radius = RADIUS.card;
  return (
    <PressScale
      onPress={() => openPanda(entry.slug)}
      role="link"
      accessibilityLabel={`生日周，${entry.name}${place ? `，${place}` : ""}，${daysLeft === 0 ? "今天" : `${daysLeft} 天后`}${entry.what}`}
    >
      <View
        style={{ height, borderRadius: radius, borderCurve: "continuous", overflow: "hidden", backgroundColor: semantic.color.light.mediaPlaceholder }}
      >
        {cover ? (
          <Image source={cover} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" transition={200} accessible={false} />
        ) : null}
        <Scrim id={`birthday-${entry.pandaId}`} height="65%" />
        <View className="absolute top-3.5 left-3.5 h-7 flex-row items-center gap-1 rounded-pill bg-white/90 px-2.5">
          <Icon icon={Cake} size="footnote" color={semantic.color.light.label} strokeWidth={2.3} />
          <Text variant="footnote" className="font-semibold text-black">
            生日周
          </Text>
        </View>
        <View className="absolute right-4 bottom-3.5 left-4 flex-row items-end justify-between gap-3">
          <View className="min-w-0 shrink gap-0.5">
            <Text variant="display" className="text-on-media" numberOfLines={1}>
              {entry.name}
            </Text>
            {place ? (
              <View className="flex-row items-center gap-1">
                <Icon icon={MapPin} size="footnote" tone="onMedia" strokeWidth={2.4} />
                <Text variant="footnote" className="shrink text-on-media/85" numberOfLines={1}>
                  {place}
                </Text>
              </View>
            ) : null}
          </View>
          <Text variant="figure" className="text-on-media">
            {daysLeft === 0 ? "今天" : daysLeft}
            {daysLeft === 0 ? null : <Text className="text-subheadline font-semibold text-on-media"> 天</Text>}
          </Text>
        </View>
        <PhotoOutline radius={radius} />
      </View>
    </PressScale>
  );
}
