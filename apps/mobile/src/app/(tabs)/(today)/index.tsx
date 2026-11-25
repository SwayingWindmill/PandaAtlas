import { Stack, router } from "expo-router";
import { Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { Calendar } from "@/components/icons";
import { BARLESS_TOP } from "@/components/page";
import { StatusBarCover } from "@/components/status-bar-cover";
import { Text } from "@/components/ui/text";
import { localToday } from "@/features/engagement/seen";
import { CuratedGallerySection } from "@/features/explore/curated-gallery";
import { DailyPlaySection } from "@/features/explore/daily-play-section";
import { FeaturedPandaCard } from "@/features/explore/featured-panda-card";
import { LearningAndPlaySection } from "@/features/explore/learning-and-play";
import { LiveClockSection } from "@/features/explore/live-clock";
import { StarOrFollowedStrip } from "@/features/explore/star-strip";
import { SoundStripSection } from "@/features/sounds/sound-strip";
import { FollowedChanges } from "@/features/today/followed-changes";
import { TodayVenueNews } from "@/features/today/venue-blocks";
import { WeekHero, useWeekMemory } from "@/features/today/week-hero";
import { useBottomClearance } from "@/lib/bottom-clearance";
import { usePullToRefresh } from "@/lib/pull-to-refresh";
import { PAGE_COLUMN, pageColumn } from "@/lib/surface";

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] as const;

function todayEyebrowLabel(): string {
  const today = localToday();
  const [year, month, day] = today.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, day ?? 1)).getUTCDay()] ?? "";
  return `${month} 月 ${day} 日　${weekday}`;
}

function ExploreHeader() {
  return (
    <View className="flex-row items-end justify-between gap-3">
      <View className="min-w-0 flex-1 gap-0.5">
        <Text variant="footnote" className="font-medium text-muted-foreground tabular-nums" numberOfLines={1}>
          {todayEyebrowLabel()}
        </Text>
        <Text variant="display" role="heading">
          探索
        </Text>
      </View>
      <Pressable
        role="link"
        accessibilityLabel="熊猫日历，查看日历"
        onPress={() => router.push("/calendar")}
        hitSlop={6}
        className="mb-0.5 min-h-11 flex-row items-center gap-1.5 rounded-pill border-hairline border-border bg-card px-3 active:opacity-70"
        style={{ borderCurve: "continuous" }}
      >
        <Icon icon={Calendar} size="footnote" tone="tint" strokeWidth={2} />
        <Text variant="footnote" className="font-semibold" numberOfLines={1}>
          熊猫日历
        </Text>
      </Pressable>
    </View>
  );
}

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const bottom = useBottomClearance();
  const refreshControl = usePullToRefresh();
  const { width } = useWindowDimensions();
  const memory = useWeekMemory();

  const top = Platform.OS === "android" ? insets.top + BARLESS_TOP : insets.top + 6;
  const heroHeight = Math.round(pageColumn(width) * 0.62);

  return (
    <>
      <StatusBarCover />
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-section px-gutter"
        refreshControl={refreshControl}
        contentContainerStyle={[PAGE_COLUMN, { paddingTop: top, paddingBottom: bottom }]}
      >
        <Stack.Screen options={{ title: "探索", headerShown: false }} />

        <View className="gap-stack">
          <ExploreHeader />
          {memory ? (
            <View className="relative">
              <WeekHero hero={memory} height={heroHeight} />
              <Pressable
                role="link"
                accessibilityLabel="查看全部那年今天记忆"
                hitSlop={6}
                onPress={() => router.push("/on-this-day")}
                className="absolute top-3 right-3 min-h-9 justify-center rounded-pill bg-glass-fallback px-3 active:opacity-75"
                style={{ borderCurve: "continuous" }}
              >
                <Text variant="footnote" className="font-semibold text-on-media">
                  全部记忆
                </Text>
              </Pressable>
            </View>
          ) : (
            <FeaturedPandaCard />
          )}
          <StarOrFollowedStrip />
          <LiveClockSection />
        </View>

        <DailyPlaySection />
        <CuratedGallerySection />
        <SoundStripSection />
        <LearningAndPlaySection />
        <TodayVenueNews />
        <FollowedChanges />
      </ScrollView>
    </>
  );
}
