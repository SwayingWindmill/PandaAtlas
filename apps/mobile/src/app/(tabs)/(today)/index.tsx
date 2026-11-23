import { Stack, router } from "expo-router";
import { Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BARLESS_TOP } from "@/components/page";
import { StatusBarCover } from "@/components/status-bar-cover";
import { Text } from "@/components/ui/text";
import { component } from "@/design/tokens";
import { BirthdayReminderCard } from "@/features/birthdays/reminder-card";
import { CuratedGallerySection } from "@/features/explore/curated-gallery";
import { FeaturedPandaCard } from "@/features/explore/featured-panda-card";
import { LearningAndPlaySection } from "@/features/explore/learning-and-play";
import { LiveClockSection } from "@/features/explore/live-clock";
import { StarOrFollowedStrip } from "@/features/explore/star-strip";
import { TimelyBanner } from "@/features/explore/timely-banner";
import { ProfileAvatar } from "@/features/profile/avatar";
import { displayName, useProfile } from "@/features/profile/profile";
import { useSession } from "@/features/session/session";
import { SoundStripSection } from "@/features/sounds/sound-strip";
import { FollowedChanges } from "@/features/today/followed-changes";
import { TodayVenueNews } from "@/features/today/venue-blocks";
import { WeekHero, useWeekMemory } from "@/features/today/week-hero";
import { useBottomClearance } from "@/lib/bottom-clearance";
import { usePullToRefresh } from "@/lib/pull-to-refresh";
import { PAGE_COLUMN, pageColumn } from "@/lib/surface";

const PROFILE_AVATAR_SIZE = 36;

function ExploreHeader() {
  const { state } = useSession();
  const { profile } = useProfile();
  const signedIn = state.status === "signedIn";
  const email = signedIn ? state.email : null;
  const name = signedIn && profile ? displayName(profile, email) : null;
  return (
    <View className="flex-row items-end justify-between gap-3">
      <Text variant="display" role="heading">
        探索
      </Text>
      <Pressable
        role="link"
        accessibilityLabel="我的"
        onPress={() => router.push("/me")}
        hitSlop={(component.hitTarget - PROFILE_AVATAR_SIZE) / 2}
        className="mb-1 active:opacity-70"
      >
        <ProfileAvatar name={name} size={PROFILE_AVATAR_SIZE} quiet />
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
          <TimelyBanner />
          <BirthdayReminderCard />
          <StarOrFollowedStrip />
          <LiveClockSection />
          {memory ? <WeekHero hero={memory} height={heroHeight} /> : <FeaturedPandaCard />}
        </View>

        <CuratedGallerySection />
        <SoundStripSection />
        <LearningAndPlaySection />
        <TodayVenueNews />
        <FollowedChanges />
      </ScrollView>
    </>
  );
}
