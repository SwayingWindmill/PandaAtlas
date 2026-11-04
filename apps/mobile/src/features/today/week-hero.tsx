import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

import { useStacked } from "@/components/grouped-list";
import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { Scrim } from "@/components/scrim";
import { Text } from "@/components/ui/text";
import { localToday } from "@/features/engagement/seen";
import { addDays } from "@/features/milestones/milestones";
import { useMilestonesOn } from "@/features/milestones/prefs";
import { memoryPlaces } from "@/features/on-this-day/load";
import { memoriesOn, visibleMemories } from "@/features/on-this-day/on-this-day";
import { useMemoryPrefs } from "@/features/on-this-day/prefs";
import { openPanda } from "@/features/pandas/panda-row";
import { loadPandaIndex, loadPlaces } from "@/features/pandas/pandas";
import { semantic } from "@/design/tokens";
import { usePandaCover } from "@/lib/covers";
import { loadLifeEvents, loadResidencies } from "@/lib/public-data";
import { RADIUS } from "@/lib/surface";

import { WEEK_DAYS, type WeekMemory, weekMemory } from "./week-memory";

const WEEKDAY = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/**
 * The week's nearest public anniversary, loaded on focus: undefined while loading, null when the week has none.
 * With 那年今天 off only birthdays are left; 少显示 and 里程碑 apply as on the 那年今天 page.
 */
export function useWeekMemory(): WeekMemory | null | undefined {
  const prefs = useMemoryPrefs();
  const milestonesOn = useMilestonesOn();
  const [hero, setHero] = useState<WeekMemory | null | undefined>(undefined);
  useFocusEffect(
    useCallback(() => {
      if (!prefs) return;
      const today = localToday();
      Promise.all([
        loadPandaIndex(),
        loadPlaces().catch(() => new Map()),
        loadLifeEvents().catch(() => []),
        loadResidencies().catch(() => []),
      ])
        .then(([pandas, places, events, residencies]) => {
          const where = memoryPlaces(places);
          const days = Array.from({ length: WEEK_DAYS }, (_, index) => {
            const date = addDays(today, index);
            const memories = visibleMemories(memoriesOn({ today: date, pandas, events, residencies, places: where }), prefs, milestonesOn);
            return { date, memories: prefs.off ? memories.filter((memory) => memory.kind === "birthday") : memories };
          });
          setHero(weekMemory(days));
        })
        .catch(() => setHero(null));
    }, [prefs, milestonesOn]),
  );
  return hero;
}

/** "11.8", the anniversary's day. */
function shortDate(date: string) {
  return `${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))}`;
}

function weekday(date: string) {
  return WEEKDAY[new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)))).getUTCDay()];
}

/** The pandas, three at most, then how many more. */
function names(hero: WeekMemory) {
  const shown = hero.pandas.slice(0, 3).map((panda) => panda.name).join(" · ");
  return hero.pandas.length > 3 ? `${shown} 等 ${hero.pandas.length} 只` : shown;
}

/**
 * The head of 今天 in a week with an anniversary: the first panda's photo, 那年今天 or 生日周, what it is
 * and who, and the day at the right. It opens the first panda.
 */
export function WeekHero({ hero, height }: { hero: WeekMemory; height: number }) {
  const first = hero.pandas[0]!;
  const cover = usePandaCover(first.id);
  const radius = RADIUS.card;
  // At accessibility sizes the day joins the names line so the title keeps the width and the card its height.
  const stacked = useStacked();
  const when = hero.daysLeft === 0 ? "今天" : `${shortDate(hero.date)}，${weekday(hero.date)}`;
  return (
    <PressScale
      onPress={() => openPanda(first.slug ?? first.id)}
      role="link"
      accessibilityLabel={`${hero.label}，${hero.title}，${names(hero)}，${when}`}
    >
      <View
        style={{ height, borderRadius: radius, borderCurve: "continuous", overflow: "hidden", backgroundColor: semantic.color.light.mediaPlaceholder }}
      >
        {cover ? (
          <Image source={cover} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" transition={200} accessible={false} />
        ) : null}
        <Scrim id={`week-${first.id}`} height="65%" />
        <View className="absolute top-3.5 left-3.5 h-7 justify-center rounded-pill bg-white/90 px-3">
          <Text variant="footnote" className="font-semibold text-black">
            {hero.label}
          </Text>
        </View>
        <View className="absolute right-4 bottom-3.5 left-4 flex-row items-end justify-between gap-3">
          <View className="min-w-0 shrink gap-0.5">
            <Text variant="display" className="text-on-media" numberOfLines={2}>
              {hero.title}
            </Text>
            <Text variant="subheadline" className="text-on-media/85" numberOfLines={stacked ? 2 : 1}>
              {stacked ? `${names(hero)} · ${when.replace("，", " ")}` : names(hero)}
            </Text>
          </View>
          {stacked ? null : hero.daysLeft === 0 ? (
            <Text variant="figure" className="text-on-media">
              今天
            </Text>
          ) : (
            <View className="items-end">
              <Text variant="figure" className="text-on-media">
                {shortDate(hero.date)}
              </Text>
              <Text variant="footnote" className="text-on-media/85">
                {weekday(hero.date)}
              </Text>
            </View>
          )}
        </View>
        <PhotoOutline radius={radius} />
      </View>
    </PressScale>
  );
}
