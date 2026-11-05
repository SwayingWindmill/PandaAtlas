import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { Chevron, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Sun, Trophy } from "@/components/icons";
import { ProgressRing } from "@/components/progress-ring";
import { Timeline, type TimelineItem } from "@/components/timeline";
import { Text } from "@/components/ui/text";
import { monthKey, monthName, progress } from "@/features/challenges/challenge";
import { useChallengeState } from "@/features/challenges/prefs";
import { localToday } from "@/features/engagement/seen";
import { type Facility, loadInstitution } from "@/features/institutions/institutions";
import { useVenueNewsOn } from "@/features/venue-news/prefs";
import { useNewsContext } from "@/features/venue-news/use-news-context";
import { daysUntil, loadVenueNews } from "@/features/venue-news/venue-news";
import { hoursLabel } from "@/features/viewing/day-window";
import { DayBand } from "@/features/viewing/viewing-timing";

// 今天's venue blocks (v4 `01-today`, steps 4 and 5): 观猫时机 and 挑战 side by side, then 场馆动态. Each one
// reads the fan's own follows or progress and is hidden when there is nothing real to show.

export interface ViewingSpot {
  slug: string;
  name: string;
  viewing: NonNullable<Facility["viewing"]>;
}

/** The first venue where a followed panda lives that publishes when its pandas are up; null when none. */
export function useFollowedViewing(): ViewingSpot | null {
  const { followedVenues } = useNewsContext();
  const slugs = followedVenues ? [...followedVenues].sort() : [];
  const { data } = useQuery({
    queryKey: ["today", "viewing", slugs],
    enabled: slugs.length > 0,
    staleTime: 300_000,
    queryFn: async (): Promise<ViewingSpot | null> => {
      for (const slug of slugs) {
        const institution = await loadInstitution(slug).catch(() => null);
        const facility = institution?.facilities.find((item) => item.viewing && item.viewing.active.length > 0);
        if (institution && facility?.viewing) return { slug, name: institution.name, viewing: facility.viewing };
      }
      return null;
    },
  });
  return data ?? null;
}

function HalfCard({ children, onPress, label }: { children: React.ReactNode; onPress: () => void; label: string }) {
  return (
    <Pressable
      role="link"
      accessibilityLabel={label}
      onPress={onPress}
      className="min-w-0 flex-1 gap-stack-tight rounded-group bg-card p-inset active:opacity-80"
      style={{ borderCurve: "continuous" }}
    >
      {children}
    </Pressable>
  );
}

function ViewingCard({ spot }: { spot: ViewingSpot }) {
  const best = spot.viewing.active[0]!;
  return (
    <HalfCard label={`观猫时机，${spot.name}，${hoursLabel(best)}`} onPress={() => router.push({ pathname: "/institutions/[slug]", params: { slug: spot.slug } })}>
      <View className="flex-row items-center gap-1.5">
        <Icon icon={Sun} size="footnote" tone="tint" />
        <Text variant="footnote" className="font-semibold text-muted-foreground">
          观猫时机
        </Text>
      </View>
      <View className="gap-hair-gap">
        <Text variant="stat" numberOfLines={1}>
          {hoursLabel(best)}
        </Text>
        <Text variant="footnote" className="text-muted-foreground" numberOfLines={1}>
          {spot.name}
        </Text>
      </View>
      <DayBand viewing={spot.viewing} />
    </HalfCard>
  );
}

function ChallengeCard({ done, total, month }: { done: number; total: number; month: string }) {
  return (
    <HalfCard label={`${monthName(month)}挑战，完成 ${done} / ${total}`} onPress={() => router.push("/challenge")}>
      <View className="flex-row items-center gap-1.5">
        <Icon icon={Trophy} size="footnote" tone="tint" />
        <Text variant="footnote" className="font-semibold text-muted-foreground">
          {monthName(month)}
        </Text>
      </View>
      <View className="flex-1 items-center justify-center">
        <ProgressRing value={total > 0 ? done / total : 0} accessibilityLabel={`完成 ${done} / ${total}`}>
          <Text role="none">
            <Text variant="headline" className="font-rounded tabular-nums">
              {done}
            </Text>
            <Text variant="footnote" className="font-rounded text-muted-foreground tabular-nums">
              {`/${total}`}
            </Text>
          </Text>
        </ProgressRing>
      </View>
    </HalfCard>
  );
}

/** 观猫时机 and 挑战 side by side; one takes the row alone, and neither shows when there is nothing real. */
export function TodayCards({ viewing }: { viewing: ViewingSpot | null }) {
  const stacked = useStacked();
  const state = useChallengeState();
  const month = monthKey(localToday());
  const joined = state?.joined.includes(month) ?? false;
  const { done, total } = state ? progress(state, month) : { done: 0, total: 0 };
  if (!viewing && !joined) return null;
  return (
    <View className={stacked ? "gap-row" : "flex-row gap-row"}>
      {viewing ? <ViewingCard spot={viewing} /> : null}
      {joined ? <ChallengeCard done={done} total={total} month={month} /> : null}
    </View>
  );
}

/** "11.06", as the card dates a notice. */
const shortDate = (day: string) => `${day.slice(5, 7)}.${day.slice(8, 10)}`;

/**
 * 场馆动态 for the venues where the followed pandas live: the next notice still to come, with its countdown,
 * and the latest one, on a timeline. The header opens the full list. Hidden when off in 设置 or when there is
 * no such notice.
 */
export function TodayVenueNews() {
  const on = useVenueNewsOn();
  const { venues, followedVenues } = useNewsContext();
  const { data } = useQuery({ queryKey: ["venue-news", "all"], queryFn: () => loadVenueNews(), enabled: Boolean(on && followedVenues?.size) });
  if (!on || !followedVenues || !data) return null;
  const mine = data.filter((item) => followedVenues.has(item.institutionSlug));
  const upcoming = mine.filter((item) => daysUntil(item.publishedOn) > 0).sort((a, b) => a.publishedOn.localeCompare(b.publishedOn))[0];
  const latest = mine.filter((item) => daysUntil(item.publishedOn) <= 0).sort((a, b) => b.publishedOn.localeCompare(a.publishedOn))[0];
  const shown = [upcoming, latest].filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (shown.length === 0) return null;
  const items: TimelineItem[] = shown.map((item) => {
    const ahead = daysUntil(item.publishedOn);
    return {
      key: item.id,
      date: shortDate(item.publishedOn),
      meta: venues.get(item.institutionSlug) ?? item.institutionSlug,
      title: item.headline,
      trailing:
        ahead > 0 ? (
          <Text variant="subheadline" className="ml-auto pl-row font-semibold text-primary tabular-nums">
            {ahead} 天后
          </Text>
        ) : undefined,
    };
  });
  return (
    <View className="gap-row rounded-group bg-card p-inset" style={{ borderCurve: "continuous" }}>
      <Pressable role="link" accessibilityLabel="场馆动态，全部" onPress={() => router.push("/venue-news")} className="flex-row items-center justify-between active:opacity-60">
        <Text variant="headline">场馆动态</Text>
        <Chevron />
      </Pressable>
      <Timeline items={items} />
    </View>
  );
}
