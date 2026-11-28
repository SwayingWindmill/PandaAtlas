import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { Share, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HeroHeader, useHeroScroll } from "@/components/hero-header";
import { LoadFailed } from "@/components/load-failed";
import { Scrim } from "@/components/scrim";
import { StretchyHero } from "@/components/stretchy-hero";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { useFollowed } from "@/features/engagement/favorites";
import { useSeenIds } from "@/features/engagement/use-seen-ids";
import { VisitGuide } from "@/features/institutions/institution-guide";
import { useInstitutionHero } from "@/features/institutions/institution-hero";
import {
  Former,
  HeroTitle,
  INSTITUTION_HERO_HEIGHT,
  PlateHero,
  Residents,
  VenueActionPair,
  VenueFooter,
  VenueMetricStrip,
  VenueQuickTools,
} from "@/features/institutions/institution-overview";
import { institutionQueryOptions } from "@/features/institutions/institutions";
import { VenueNewsSection } from "@/features/venue-news/venue-news-section";
import { VenueLiveCard } from "@/features/viewing/venue-live-card";
import { buildVenueLiveSnapshot } from "@/features/viewing/venue-live";
import { FacilityVisits } from "@/features/visits/facility-visits";
import { PAGE_COLUMN } from "@/lib/surface";

export default function InstitutionScreen() {
  const params = useLocalSearchParams<{ slug: string; tab?: string }>();
  const slug = params.slug;
  const { data: institution, isError, isFetching, refetch } = useQuery(institutionQueryOptions(slug));
  const failed = !institution && isError && !isFetching;
  const hero = useInstitutionHero(institution?.residents ?? null);
  const seen = useSeenIds();
  const followed = useFollowed();
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll, pastHero } = useHeroScroll(INSTITUTION_HERO_HEIGHT);

  const shareVenue = () => {
    if (!institution) return;
    void Share.share({ message: `吱熊猫　${institution.name}${institution.meta ? `（${institution.meta}）` : ""}` });
  };

  if (!institution) {
    return (
      <View className="flex-1 bg-background">
        <HeroHeader title="" pastHero={false} />
        {failed ? (
          <View className="px-gutter" style={[PAGE_COLUMN, { paddingTop: insets.top + 64 }]}>
            <LoadFailed message="这一页暂时打不开。" onRetry={() => void refetch()} />
          </View>
        ) : (
          <View className="gap-4" accessibilityLabel="正在加载">
            <Skeleton className="w-full rounded-none" style={{ height: INSTITUTION_HERO_HEIGHT + insets.top }} />
            <View className="flex-row gap-3 px-4">
              <Skeleton className="h-56 flex-1 rounded-tile" />
              <Skeleton className="h-56 flex-1 rounded-tile" />
            </View>
          </View>
        )}
      </View>
    );
  }

  const liveCardShown = buildVenueLiveSnapshot(institution.slug, institution.liveCamUrl) !== null;

  return (
    <View className="flex-1 bg-background">
      <HeroHeader title={institution.name} pastHero={pastHero} onShare={shareVenue} />
      <Animated.ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="never"
        contentContainerClassName="pb-16"
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {hero ? (
          <StretchyHero
            url={hero.url}
            height={INSTITUTION_HERO_HEIGHT}
            scrollY={scrollY}
            label={`${institution.name}，照片里是${hero.pandaName}`}
            overlay={
              <>
                <Scrim id="institution-hero" height="70%" />
                <HeroTitle institution={institution} />
              </>
            }
          />
        ) : (
          <PlateHero institution={institution} pending={hero === undefined} />
        )}
        <Animated.View
          entering={PAGE_ENTER}
          className="gap-6 bg-background px-gutter pt-4"
          style={PAGE_COLUMN}
        >
          <View className="gap-3">
            {institution.summary ? (
              <Text variant="subheadline" className="text-muted-foreground">
                {institution.summary}
              </Text>
            ) : null}
            <VenueActionPair institution={institution} />
          </View>

          <VenueMetricStrip institution={institution} />

          <VenueLiveCard variant="venue" slug={institution.slug} apiLiveCamUrl={institution.liveCamUrl} />

          <VenueQuickTools institution={institution} liveCardShown={liveCardShown} />

          <Residents pandas={institution.residents} seen={seen} followed={followed} />

          <VisitGuide institution={institution} />

          {institution.facilities.length > 0 ? <FacilityVisits facilities={institution.facilities} /> : null}

          <VenueNewsSection institutionSlug={institution.slug} />

          <Former pandas={institution.former} />

          <VenueFooter institution={institution} />

          {hero?.credit ? (
            <Text variant="footnote" className="text-muted-foreground">
              {`顶部照片：${hero.pandaName}，${hero.credit}`}
            </Text>
          ) : null}
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}
