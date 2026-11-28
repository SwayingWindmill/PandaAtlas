import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { HeroHeader, useHeroScroll } from "@/components/hero-header";
import { Icon } from "@/components/icon";
import { Flag, FolderHeart, Mars, Venus } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { HeroFade } from "@/components/scrim";
import { StretchyHero } from "@/components/stretchy-hero";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { PandaActions } from "@/features/engagement/panda-actions";
import { pandaIndexQueryOptions } from "@/features/pandas/pandas";
import { profileQueryOptions } from "@/features/pandas/profile";
import {
  Memories,
  PandaFaceGuideCard,
  PandaVenueLive,
  openPandaCorrection,
} from "@/features/pandas/profile-overview";
import {
  FamilyStripSection,
  HighlightCarousel,
  JourneyRouteSection,
  LifeStageSection,
  NoPhotoIdentityHeader,
  PandaVenueNewsCard,
  PhotoPeekStrip,
  QuickToolsBar,
  QuietProfileFooter,
  RecommendedArticleCard,
  SameCohortSection,
  TraitsAndCareSection,
  UnifiedMetricStrip,
} from "@/features/pandas/profile-sections";
import { recordView } from "@/features/pandas/recent";
import { queryClient } from "@/lib/query-client";
import { PAGE_COLUMN } from "@/lib/surface";

/** Hero height below the status bar. The photo runs under the status bar too. */
const HERO = 292;
/** How far the name block rides up onto the photo's faded bottom. */
const OVERLAP = 52;

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
        <View className="flex-row items-center gap-3.5 px-gutter pb-3" style={[PAGE_COLUMN, { paddingTop: insets.top + 58 }]}>
          <Skeleton className="rounded-tile" style={{ width: 60, height: 60 }} />
          <View className="flex-1 gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-4 w-24" />
          </View>
        </View>
      )}
      <View className="gap-4 px-gutter" style={[PAGE_COLUMN, photo ? { marginTop: -OVERLAP } : null]}>
        {photo ? <Skeleton className="h-10 w-32" /> : null}
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-12 w-full rounded-pill" />
        <Skeleton className="h-20 w-full rounded-group" />
        <Skeleton className="h-24 w-full rounded-group" />
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: profile, isError: failed, refetch } = useQuery(profileQueryOptions(slug));
  const { scrollY, onScroll, pastHero } = useHeroScroll(HERO);
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
          <View className="px-gutter pt-28" style={PAGE_COLUMN}>
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
          <NoPhotoIdentityHeader profile={profile} adoptionName={profile.rich.adoptionName} leadBio={profile.rich.leadBio} />
        )}
        <Animated.View
          entering={PAGE_ENTER}
          className="gap-4 px-gutter"
          style={[PAGE_COLUMN, cover ? { marginTop: -OVERLAP } : { marginTop: 14 }]}
        >
          {cover ? (
            <View className="gap-1.5">
              <View>
                <View className="flex-row items-baseline justify-between gap-2">
                  <Text variant="display" role="heading" className="min-w-0 shrink">
                    {profile.name}
                  </Text>
                  {profile.rich.adoptionName ? (
                    <Text variant="footnote" className="shrink-0 font-semibold text-primary">
                      {`认养名　${profile.rich.adoptionName}`}
                    </Text>
                  ) : null}
                </View>
                {profile.nameEn || sexIcon ? (
                  <View
                    className="flex-row items-center gap-1.5"
                    accessible
                    accessibilityLabel={`${profile.nameEn ?? ""}${profile.sex === "male" ? "，雄性" : profile.sex === "female" ? "，雌性" : ""}`}
                  >
                    {profile.nameEn ? (
                      <Text variant="subheadline" className="min-w-0 shrink text-muted-foreground" numberOfLines={2}>
                        {profile.nameEn}
                      </Text>
                    ) : null}
                    {sexIcon ? <Icon icon={sexIcon} size="footnote" tone="secondary" strokeWidth={2.4} /> : null}
                  </View>
                ) : null}
              </View>
              {profile.rich.leadBio ? (
                <Text variant="subheadline" className="text-muted-foreground">
                  {profile.rich.leadBio}
                </Text>
              ) : null}
            </View>
          ) : null}

          <PandaActions pandaId={profile.id} name={profile.name} deceased={profile.deceased} />
          <UnifiedMetricStrip profile={profile} />
          <PandaVenueLive profile={profile} />
          <PhotoPeekStrip profile={profile} />
          <HighlightCarousel highlights={profile.rich.highlights} />
          <TraitsAndCareSection name={profile.name} traits={profile.rich.traits} />
          <PandaFaceGuideCard slug={profile.slug} pandaId={profile.id} />
          <LifeStageSection stage={profile.rich.lifeStage} />
          <JourneyRouteSection profile={profile} />
          <FamilyStripSection profile={profile} />
          <QuickToolsBar slug={profile.slug} name={profile.name} />
          <SameCohortSection profile={profile} />
          {profile.memories.length > 0 ? <Memories profile={profile} /> : null}
          <PandaVenueNewsCard slug={profile.slug} />
          <RecommendedArticleCard articleSlug={profile.rich.recommendedArticleSlug} />
          <QuietProfileFooter profile={profile} />
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}
