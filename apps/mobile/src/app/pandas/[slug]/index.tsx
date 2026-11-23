import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { HeroHeader, useHeroScroll } from "@/components/hero-header";
import { Icon } from "@/components/icon";
import { Flag, FolderHeart, Mars, Venus } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { HeroFade } from "@/components/scrim";
import { Segmented } from "@/components/segmented";
import { StretchyHero } from "@/components/stretchy-hero";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { CompareRows } from "@/features/compare/compare-rows";
import { PandaActions } from "@/features/engagement/panda-actions";
import { pandaIndexQueryOptions } from "@/features/pandas/pandas";
import { recordView } from "@/features/pandas/recent";
import { profileQueryOptions } from "@/features/pandas/profile";
import { FamilyTab } from "@/features/pandas/profile-family-tab";
import {
  EventsList,
  Experience,
  KeyRows,
  Memories,
  NoPhoto,
  Sources,
  Stats,
  openPandaCorrection,
} from "@/features/pandas/profile-overview";
import { PhotosTab } from "@/features/pandas/profile-photos-tab";
import { queryClient } from "@/lib/query-client";

/** Hero height below the status bar. The photo runs under the status bar too. */
const HERO = 320;
/** How far the name block rides up onto the photo's faded bottom. */
const OVERLAP = 64;

/**
 * Whether the profile will open on a photo, from the list and cover already loaded on the way here: most pandas
 * have no cover, and a skeleton that always reserves one jumps by the hero's height when the profile lands.
 * Unknown (opened from a link) counts as a photo.
 */
function expectsPhoto(slug: string): boolean {
  const id = queryClient.getQueryData(pandaIndexQueryOptions().queryKey)?.find((item) => item.slug === slug)?.id;
  return id === undefined || queryClient.getQueryData(["public", "panda-cover", id]) !== null;
}

function ProfileSkeleton({ slug }: { slug: string }) {
  const insets = useSafeAreaInsets();
  const photo = expectsPhoto(slug);
  return (
    <View accessibilityLabel="正在加载资料">
      {photo ? (
        <Skeleton className="w-full rounded-none" style={{ height: HERO + insets.top }} />
      ) : (
        <View className="px-gutter pb-4" style={{ paddingTop: insets.top + 64 }}>
          <Skeleton className="h-24 w-full rounded-group" />
        </View>
      )}
      <View className="gap-4 px-gutter" style={photo ? { marginTop: -OVERLAP } : undefined}>
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-12 w-full rounded-pill" />
        <View className="flex-row gap-2.5">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-24 flex-1 rounded-tile" />
          ))}
        </View>
      </View>
    </View>
  );
}

type Tab = "overview" | "family" | "photos" | "events";
const TABS: { value: Tab; label: string }[] = [
  { value: "overview", label: "概况" },
  { value: "family", label: "家族" },
  { value: "photos", label: "照片" },
  { value: "events", label: "动态" },
];

export default function ProfileScreen() {
  const { slug, tab: opened } = useLocalSearchParams<{ slug: string; tab?: string }>();
  const { data: profile, isError: failed, refetch } = useQuery(profileQueryOptions(slug));
  const { scrollY, onScroll, pastHero } = useHeroScroll(HERO);
  const [tab, setTab] = useState<Tab>(() => TABS.find((item) => item.value === opened)?.value ?? "overview");
  const page = String(useCSSVariable("--color-background"));
  const viewedId = profile?.id;
  useEffect(() => {
    if (viewedId) void recordView(viewedId);
  }, [viewedId]);

  if (!profile) {
    return (
      <View className="flex-1 bg-background">
        <HeroHeader title="" pastHero={false} />
        {failed ? (
          <View className="px-gutter pt-28">
            <LoadFailed message="资料暂时打不开。" onRetry={() => void refetch()} />
          </View>
        ) : (
          <ProfileSkeleton slug={slug} />
        )}
      </View>
    );
  }

  const cover = profile.photos[0];
  const share = () => router.push({ pathname: "/pandas/[slug]/share", params: { slug: profile.slug } });
  const sexIcon = profile.sex === "male" ? Mars : profile.sex === "female" ? Venus : null;
  return (
    <View className="flex-1 bg-background">
      <HeroHeader
        title={profile.name}
        pastHero={pastHero}
        onShare={share}
        menu={[
          {
            label: "加入合集",
            icon: FolderHeart,
            onPress: () => router.push({ pathname: "/pandas/[slug]/collect", params: { slug: profile.slug } }),
          },
          { label: "资料有误", icon: Flag, onPress: () => openPandaCorrection(profile.slug) },
        ]}
      />
      <Animated.ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="never"
        contentContainerClassName="pb-16"
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {cover ? (
          <StretchyHero
            url={cover.url}
            height={HERO}
            scrollY={scrollY}
            label={`查看${profile.name}的照片，共 ${profile.photos.length} 张`}
            onPress={() => router.push({ pathname: "/pandas/[slug]/photos", params: { slug: profile.slug } })}
            overlay={<HeroFade id={`hero-${profile.id}`} page={page} />}
          />
        ) : (
          <NoPhoto profile={profile} />
        )}
        <Animated.View entering={PAGE_ENTER} className="gap-4 px-gutter" style={cover ? { marginTop: -OVERLAP } : undefined}>
          <View>
            <View className="flex-row items-center gap-2">
              <Text variant="display" className="shrink">
                {profile.name}
              </Text>
            </View>
            {profile.nameEn || sexIcon ? (
              <View
                className="flex-row items-center gap-1.5"
                accessible
                accessibilityLabel={`${profile.nameEn ?? ""}${profile.sex === "male" ? "，雄性" : profile.sex === "female" ? "，雌性" : ""}`}
              >
                {profile.nameEn ? (
                  <Text variant="subheadline" className="text-muted-foreground">
                    {profile.nameEn}
                  </Text>
                ) : null}
                {sexIcon ? <Icon icon={sexIcon} size="footnote" tone="secondary" strokeWidth={2.4} /> : null}
              </View>
            ) : null}
          </View>
          <PandaActions pandaId={profile.id} name={profile.name} deceased={profile.deceased} />
          {tab === "overview" ? <Stats profile={profile} /> : null}
          <View className="pt-0.5">
            <Segmented value={tab} options={TABS} onChange={setTab} accessibilityLabel="资料分区" />
          </View>
          {tab === "overview" ? (
            <View className="gap-3">
              <KeyRows profile={profile} />
              <Experience profile={profile} />
              <CompareRows slug={profile.slug} />
              {profile.memories.length > 0 ? <Memories profile={profile} /> : null}
              {profile.sources.length > 0 ? <Sources sources={profile.sources} /> : null}
              {cover?.credit ? (
                <Text variant="footnote" className="px-4 text-muted-foreground">
                  {`封面照片：${cover.credit}`}
                </Text>
              ) : null}
            </View>
          ) : tab === "family" ? (
            <FamilyTab profile={profile} />
          ) : tab === "photos" ? (
            <PhotosTab profile={profile} />
          ) : (
            <EventsList profile={profile} />
          )}
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}
