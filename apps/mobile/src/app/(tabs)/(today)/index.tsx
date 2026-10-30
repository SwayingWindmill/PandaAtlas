import { Stack } from "expo-router";
import { ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";
import { localToday } from "@/features/engagement/seen";
import { FollowedChanges } from "@/features/today/followed-changes";
import { FollowedStrip } from "@/features/today/followed-strip";
import { StoryCard } from "@/features/today/story-card";
import { useStoryPhotos } from "@/features/today/story-photos";
import { TodayBirthdays } from "@/features/today/today-birthdays";

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

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const photos = useStoryPhotos(localToday(), STORIES.length);
  const column = Math.min(width, 700) - 32;
  // The top story is close to a 4:5 portrait; the rest are wide. Taller at big text sizes so titles fit.
  const lead = Math.round(column * 1.2);
  const rest = Math.round(Math.max(column * 0.68, 200 * Math.min(fontScale, 1.6)));

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="never"
      contentContainerClassName="gap-5 px-4 pb-28"
      contentContainerStyle={{ paddingTop: insets.top + 12 }}
    >
      <Stack.Screen options={{ headerShown: false, title: "今天" }} />
      <View className="gap-0.5">
        <Text variant="largeTitle">今天</Text>
        <Text variant="title3" className="font-bold text-muted-foreground">
          {dateLine()}
        </Text>
      </View>
      {STORIES.map((story, index) => (
        <StoryCard
          key={story.id}
          id={story.id}
          title={story.title}
          feature={story.feature}
          href={story.href}
          photo={photos[index]}
          height={index === 0 ? lead : rest}
        />
      ))}
      <FollowedStrip />
      <TodayBirthdays />
      <FollowedChanges />
    </ScrollView>
  );
}
