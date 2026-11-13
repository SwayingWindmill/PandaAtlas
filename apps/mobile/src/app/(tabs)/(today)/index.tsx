import { type Href, Stack, router } from "expo-router";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { CalendarDays, House, type LucideIcon, Plane, Sun, Trophy } from "@/components/icons";
import { StatusBarCover } from "@/components/status-bar-cover";
import { Text } from "@/components/ui/text";
import { ProfileAvatar } from "@/features/profile/avatar";
import { displayName, useProfile } from "@/features/profile/profile";
import { useSession } from "@/features/session/session";
import { BirthdayReminderCard } from "@/features/birthdays/reminder-card";
import { localToday } from "@/features/engagement/seen";
import { FollowedChanges } from "@/features/today/followed-changes";
import { FollowedStrip } from "@/features/today/followed-strip";
import { OnThisDayCard } from "@/features/today/on-this-day-card";
import { StoryCard } from "@/features/today/story-card";
import { useStoryPhotos } from "@/features/today/story-photos";
import { TodayBirthdays } from "@/features/today/today-birthdays";
import { TodayCards, TodayVenueNews, type ViewingSpot, useFollowedViewing } from "@/features/today/venue-blocks";
import { WeekCard } from "@/features/today/week-card";
import { WeekHero, useWeekMemory } from "@/features/today/week-hero";
import { useBottomClearance } from "@/lib/bottom-clearance";
import { usePullToRefresh } from "@/lib/pull-to-refresh";
import { pageColumn } from "@/lib/surface";

const STORIES = [
  { id: "daily", title: "今天是哪只熊猫？", feature: "每日一猫", href: "/daily" },
  { id: "guess", title: "看照片认熊猫", feature: "猜熊猫", href: "/guess" },
  { id: "learn", title: "认识大熊猫", feature: "科普", href: "/learn" },
  { id: "calendar", title: "这个月谁过生日", feature: "熊猫日历", href: "/calendar" },
] as const;

const WEEKDAY = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

/** "10月29日 星期四", the date line over the title. */
function dateLine(now = new Date()) {
  return `${now.getMonth() + 1}月${now.getDate()}日 ${WEEKDAY[now.getDay()]}`;
}

/**
 * Shortcuts under the hero, each a bare glyph over its name (v4 `01-today`): 观猫时机 at the followed panda's
 * venue when it publishes the hours, else 日历; then 归国, 挑战 and 场馆.
 */
function QuickEntries({ viewing }: { viewing: ViewingSpot | null }) {
  const stacked = useStacked();
  const quick: { label: string; icon: LucideIcon; href: Href }[] = [
    viewing
      ? { label: "观猫时机", icon: Sun, href: { pathname: "/institutions/[slug]", params: { slug: viewing.slug, tab: "guide" } } }
      : { label: "日历", icon: CalendarDays, href: "/calendar" },
    { label: "归国", icon: Plane, href: "/returning" },
    { label: "挑战", icon: Trophy, href: "/challenge" },
    { label: "场馆", icon: House, href: "/institutions" },
  ];
  return (
    <View className={stacked ? "flex-row flex-wrap gap-y-2" : "flex-row"}>
      {quick.map((item) => (
        <Pressable
          key={item.label}
          role="link"
          accessibilityLabel={item.label}
          onPress={() => router.push(item.href)}
          className="min-h-11 items-center gap-1.5 py-2 active:opacity-60"
          style={stacked ? { width: "50%" } : { flex: 1 }}
        >
          <Icon icon={item.icon} size={26} tone="label" strokeWidth={2} />
          <Text variant="footnote" className="font-semibold">
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const AVATAR = 38;

/** The date over a large 今天, with the fan's avatar at the right, which opens 我的. */
function TodayHeader() {
  const { state } = useSession();
  const { profile } = useProfile();
  const signedIn = state.status === "signedIn";
  const email = signedIn ? state.email : null;
  const name = signedIn && profile ? displayName(profile, email) : null;
  return (
    <View className="flex-row items-end justify-between gap-3">
      <View className="shrink">
        <Text variant="footnote" className="font-semibold text-muted-foreground">
          {dateLine()}
        </Text>
        <Text variant="display" role="heading">
          今天
        </Text>
      </View>
      <Pressable role="link" accessibilityLabel="我的" onPress={() => router.push("/me")} className="mb-1 active:opacity-70">
        <ProfileAvatar name={name} size={AVATAR} quiet />
      </Pressable>
    </View>
  );
}

/** Gap between the small cards in the scroller, and what each snap moves past. */
const GAP = 12;

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const bottom = useBottomClearance();
  const refreshControl = usePullToRefresh();
  const { width, fontScale } = useWindowDimensions();
  const photos = useStoryPhotos(localToday(), STORIES.length);
  const column = pageColumn(width);
  // The head card is a wide band, so the shortcuts and the row below show on the first screen.
  // It grows with the text size so a big title still fits. The smaller cards show about one
  // and a half at a time, so the next one peeks in.
  const lead = Math.round(column * (useStacked() ? 1.2 : 0.62));
  const small = Math.round(Math.min(column * 0.72, 300));
  const smallHeight = Math.round(Math.max(small * 1.22, 220 * Math.min(fontScale, 1.6)));
  const memory = useWeekMemory();
  const viewing = useFollowedViewing();
  const [featured, ...more] = STORIES;
  // An anniversary this week takes the head of the page; the featured story joins the row.
  const rest = memory ? STORIES : more;

  return (
    <>
      <StatusBarCover />
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-section px-gutter"
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: bottom }}
      >
        {/* The column draws the title so the date can sit over it, with the avatar beside. */}
        <Stack.Screen options={{ title: "今天", headerShown: false }} />
        <View className="gap-stack">
          <TodayHeader />
          {memory ? (
            <WeekHero hero={memory} height={lead} />
          ) : (
            <StoryCard
              featured
              id={featured.id}
              title={featured.title}
              feature={featured.feature}
              href={featured.href}
              photo={photos[0]}
              height={lead}
            />
          )}
          <QuickEntries viewing={viewing} />
          <TodayCards viewing={viewing} />
          <TodayVenueNews />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="-mx-gutter"
            contentContainerClassName="px-gutter"
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
                photo={photos[memory ? index : index + 1]}
                width={small}
                height={smallHeight}
              />
            ))}
          </ScrollView>
        </View>
        <BirthdayReminderCard />
        <OnThisDayCard />
        <WeekCard />
        <FollowedStrip />
        <TodayBirthdays />
        <FollowedChanges />
      </ScrollView>
    </>
  );
}
