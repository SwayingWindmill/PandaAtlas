import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HeroHeader, useHeroScroll } from "@/components/hero-header";
import { LoadFailed } from "@/components/load-failed";
import { Scrim } from "@/components/scrim";
import { Segmented } from "@/components/segmented";
import { StretchyHero } from "@/components/stretchy-hero";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { seenIdsQueryOptions } from "@/features/engagement/seen";
import { VisitGuide } from "@/features/institutions/institution-guide";
import { useInstitutionHero } from "@/features/institutions/institution-hero";
import {
  Badges,
  Former,
  HeroTitle,
  INSTITUTION_HERO_HEIGHT,
  Overview,
  PlateHero,
  Residents,
} from "@/features/institutions/institution-overview";
import { institutionQueryOptions, unseenResidents } from "@/features/institutions/institutions";
import { useSession } from "@/features/session/session";
import { FacilityVisits } from "@/features/visits/facility-visits";

const TABS = ["overview", "pandas", "guide"] as const;
type Tab = (typeof TABS)[number];
const isTab = (value: string | undefined): value is Tab => TABS.some((tab) => tab === value);

export default function InstitutionScreen() {
  const params = useLocalSearchParams<{ slug: string; tab?: string }>();
  const slug = params.slug;
  const { data: institution, isError, isFetching, refetch } = useQuery(institutionQueryOptions(slug));
  const failed = !institution && isError && !isFetching;
  const [tab, setTab] = useState<Tab>(isTab(params.tab) ? params.tab : "overview");
  const hero = useInstitutionHero(institution?.residents ?? null);
  const { state } = useSession();
  const accountId = state.status === "signedIn" ? state.accountId : null;
  // 见过 is a nicety on the 攻略: signed out, or if it fails, the row is simply left out.
  const { data: seen = null } = useQuery({
    ...seenIdsQueryOptions(accountId ?? ""),
    enabled: accountId !== null,
  });
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll, pastHero } = useHeroScroll(INSTITUTION_HERO_HEIGHT);

  if (!institution) {
    return (
      <View className="flex-1 bg-background">
        <HeroHeader title="" pastHero={false} />
        {failed ? (
          <View className="px-gutter" style={{ paddingTop: insets.top + 64 }}>
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

  const unseen = accountId !== null && seen ? unseenResidents(institution.residents, seen) : null;
  const tabs = [
    { value: "overview" as const, label: "概况" },
    institution.residents.length + institution.former.length > 0 ? { value: "pandas" as const, label: "熊猫" } : null,
    institution.facilities.length > 0 || institution.websiteUrl ? { value: "guide" as const, label: "攻略" } : null,
  ].filter((option) => option !== null);
  const shown = tabs.some((option) => option.value === tab) ? tab : "overview";

  return (
    <View className="flex-1 bg-background">
      <HeroHeader title={institution.name} pastHero={pastHero} />
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
        <Animated.View entering={PAGE_ENTER} className="gap-7 bg-background px-gutter pt-4">
          <View className="gap-section">
            <Badges institution={institution} />
            {tabs.length > 1 ? (
              <Segmented value={shown} options={tabs} onChange={setTab} accessibilityLabel={`${institution.name}的页面`} />
            ) : null}
          </View>
          {shown === "overview" ? <Overview institution={institution} onPandas={() => setTab("pandas")} /> : null}
          {shown === "pandas" ? (
            <>
              {institution.residents.length > 0 ? <Residents pandas={institution.residents} /> : null}
              {institution.former.length > 0 ? <Former pandas={institution.former} /> : null}
            </>
          ) : null}
          {shown === "guide" ? (
            <>
              <VisitGuide institution={institution} unseen={unseen} />
              {institution.facilities.length > 0 ? <FacilityVisits facilities={institution.facilities} /> : null}
            </>
          ) : null}
          {hero?.credit ? (
            <Text variant="footnote" className="px-4 text-muted-foreground">
              {`顶部照片：${hero.pandaName}，${hero.credit}`}
            </Text>
          ) : null}
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}
