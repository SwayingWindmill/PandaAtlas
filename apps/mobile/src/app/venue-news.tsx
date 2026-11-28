import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";

import { Chip } from "@/components/chip";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { ScreenState } from "@/components/screen-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_ENTER } from "@/design/motion";
import { NewsTimeline } from "@/features/venue-news/news-timeline";
import { useNewsContext } from "@/features/venue-news/use-news-context";
import { loadVenueNews } from "@/features/venue-news/venue-news";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ALL = "all";
const FOLLOWED = "followed";

/**
 * 场馆动态 (v4 `07b-venue-news`): official notices only, newest first, on one timeline card. Chips narrow it
 * to the venues the user's pandas live at (关注的) or to one venue; each venue with a notice gets a chip.
 * A row is the notice's own headline and opens the original.
 */
export default function VenueNewsScreen() {
  const params = useLocalSearchParams<{ institution?: string }>();
  const start = params.institution && SLUG.test(params.institution) ? params.institution : ALL;
  const [filter, setFilter] = useState(start);
  const news = useQuery({ queryKey: ["venue-news", "all"], queryFn: () => loadVenueNews() });
  const { venues, pandas, followedVenues } = useNewsContext();

  const items = news.data ?? [];
  const venuesWithNews = [...new Set(items.map((item) => item.institutionSlug))];
  const followedWithNews = followedVenues ? venuesWithNews.filter((slug) => followedVenues.has(slug)) : [];
  const shown =
    filter === ALL
      ? items
      : filter === FOLLOWED
        ? items.filter((item) => followedVenues?.has(item.institutionSlug))
        : items.filter((item) => item.institutionSlug === filter);
  const chips = [
    { key: ALL, label: "全部" },
    ...(followedWithNews.length > 0 ? [{ key: FOLLOWED, label: "关注的" }] : []),
    ...venuesWithNews.map((slug) => ({ key: slug, label: venues.get(slug) ?? slug })),
  ];

  return (
    <Page title="场馆动态" prominent>
      {news.isError ? (
        <LoadFailed message="场馆动态暂时打不开。" onRetry={() => void news.refetch()} />
      ) : !news.data ? (
        <View className="gap-row" accessibilityLabel="正在加载">
          <Skeleton className="h-8 w-2/3 rounded-pill" />
          <Skeleton className="h-64 w-full rounded-group" />
        </View>
      ) : items.length === 0 ? (
        <ScreenState message="暂无动态" />
      ) : (
        <Animated.View entering={PAGE_ENTER} className="gap-row">
          {venuesWithNews.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="-mx-gutter"
              contentContainerClassName="gap-stack-tight px-gutter"
            >
              {chips.map((chip) => (
                <Chip key={chip.key} label={chip.label} appearance="ink" selected={filter === chip.key} onPress={() => setFilter(chip.key)} />
              ))}
            </ScrollView>
          ) : null}
          {shown.length > 0 ? (
            <NewsTimeline items={shown} venues={venues} pandas={pandas} showVenue={filter === ALL || filter === FOLLOWED} />
          ) : (
            <ScreenState message="这里暂无动态" />
          )}
        </Animated.View>
      )}
    </Page>
  );
}
