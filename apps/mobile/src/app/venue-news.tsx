import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { ListSection } from "@/components/grouped-list";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { ScreenState } from "@/components/screen-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PAGE_ENTER } from "@/design/motion";
import { institutionListQueryOptions } from "@/features/institutions/institutions";
import { type VenueNewsItem, loadVenueNews } from "@/features/venue-news/venue-news";
import { VenueNewsRow } from "@/features/venue-news/venue-news-section";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function byInstitution(items: VenueNewsItem[]) {
  const groups = new Map<string, VenueNewsItem[]>();
  for (const item of items) groups.set(item.institutionSlug, [...(groups.get(item.institutionSlug) ?? []), item]);
  return [...groups];
}

/**
 * 场馆动态: official notices only, grouped by institution, newest first. A row is the notice's own
 * headline and opens the original. Like Apple Developer's News list: headline, then source and date.
 */
export default function VenueNewsScreen() {
  const params = useLocalSearchParams<{ institution?: string }>();
  const institution = params.institution && SLUG.test(params.institution) ? params.institution : undefined;
  const news = useQuery({ queryKey: ["venue-news", institution ?? "all"], queryFn: () => loadVenueNews(institution) });
  const institutions = useQuery(institutionListQueryOptions());
  const names = new Map((institutions.data ?? []).map((i) => [i.slug, i.nameZh ?? i.slug]));

  return (
    <Page title="场馆动态" label={institution ? names.get(institution) : "官方公告"}>
      {news.isError ? (
        <LoadFailed message="场馆动态暂时打不开。" onRetry={() => void news.refetch()} />
      ) : !news.data ? (
        <View className="gap-1.5" accessibilityLabel="正在加载">
          <Skeleton className="h-16 w-full rounded-group" />
          <Skeleton className="h-16 w-full rounded-group" />
        </View>
      ) : news.data.length === 0 ? (
        <ScreenState message="暂无动态" />
      ) : (
        <Animated.View entering={PAGE_ENTER} className="gap-section-tight">
          {byInstitution(news.data).map(([slug, items]) => (
            <ListSection key={slug} title={institution ? undefined : (names.get(slug) ?? slug)}>
              {items.map((item, index) => (
                <VenueNewsRow key={item.id} item={item} last={index === items.length - 1} />
              ))}
            </ListSection>
          ))}
        </Animated.View>
      )}
    </Page>
  );
}
