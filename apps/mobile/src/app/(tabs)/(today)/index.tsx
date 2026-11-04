import { Stack } from "expo-router";
import { Platform, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";
import { localToday } from "@/features/engagement/seen";
import { FollowedChanges } from "@/features/today/followed-changes";
import { FollowedStrip } from "@/features/today/followed-strip";
import { OnThisDayCard } from "@/features/today/on-this-day-card";
import { StoryCard } from "@/features/today/story-card";
import { useStoryPhotos } from "@/features/today/story-photos";
import { TodayBirthdays } from "@/features/today/today-birthdays";
import { WeekCard } from "@/features/today/week-card";
import { useBottomClearance } from "@/lib/bottom-clearance";

const STORIES = [
  { id: "daily", title: "今天是哪只熊猫？", feature: "每日一猫", href: "/daily" },
  { id: "guess", title: "看照片认熊猫", feature: "猜熊猫", href: "/guess" },
  { id: "learn", title: "认识大熊猫", feature: "科普", href: "/learn" },
  { id: "calendar", title: "这个月谁过生日", feature: "熊猫日历", href: "/calendar" },
] as const;

const WEEKDAY = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

/** "10月29日 星期四", as the date line under News' title. */
function dateLine(now = new Date()) {
  return `${now.getMonth() + 1}月${now.getDate()}日 ${WEEKDAY[now.getDay()]}`;
}

/**
 * iOS and Android draw 今天 in the system bar: on iOS the large title, which collapses into the bar
 * as the page scrolls. The web has no bar on a tab root, so the column draws the title there.
 */
const TITLE_IN_COLUMN = Platform.OS === "web";

/** Gap between the small cards in the scroller, and what each snap moves past. */
const GAP = 12;

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const bottom = useBottomClearance();
  const { width, fontScale } = useWindowDimensions();
  const photos = useStoryPhotos(localToday(), STORIES.length);
  const column = Math.min(width, 700) - 32;
  // The featured story is close to a 4:5 portrait. The smaller cards show about one and a half
  // at a time, so the next one peeks in and says the row scrolls; they grow at big text sizes.
  const lead = Math.round(column * 1.2);
  const small = Math.round(Math.min(column * 0.72, 300));
  const smallHeight = Math.round(Math.max(small * 1.22, 220 * Math.min(fontScale, 1.6)));
  const [featured, ...rest] = STORIES;

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-section px-4"
      contentContainerStyle={{ paddingTop: TITLE_IN_COLUMN ? insets.top + 12 : 0, paddingBottom: bottom }}
    >
      <Stack.Screen options={{ title: "今天" }} />
      <View className="gap-stack">
        {/* The date says when, under the title as News dates its issue: a quiet secondary line. */}
        <View>
          {TITLE_IN_COLUMN ? <Text variant="display">今天</Text> : null}
          <Text variant="body" className="text-muted-foreground">
            {dateLine()}
          </Text>
        </View>
        <StoryCard
          featured
          id={featured.id}
          title={featured.title}
          feature={featured.feature}
          href={featured.href}
          photo={photos[0]}
          height={lead}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-4"
          contentContainerClassName="px-4"
          contentContainerStyle={{ gap: GAP }}
          snapToInterval={small + GAP}
          snapToAlignment="start"
          decelerationRate="fast"
        >
          {rest.map((story, index) => (
            <StoryCard
              key={story.id}
              id={story.id}
              title={story.title}
              feature={story.feature}
              href={story.href}
              photo={photos[index + 1]}
              width={small}
              height={smallHeight}
            />
          ))}
        </ScrollView>
      </View>
      <OnThisDayCard />
      <WeekCard />
      <FollowedStrip />
      <TodayBirthdays />
      <FollowedChanges />
    </ScrollView>
  );
}
