import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { ListCell, ListSection } from "@/components/grouped-list";
import { Landmark, Newspaper, Plane } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { ScreenState } from "@/components/screen-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { type InstitutionListItem, institutionListQueryOptions, toListItems } from "@/features/institutions/institutions";
import { mapViewQueryOptions } from "@/features/map/load";
import { type MapItem } from "@/features/map/model";
import { type PlaceRow, PlaceRows } from "@/features/map/place-list";
import { loadOverseasStatus } from "@/features/overseas/overseas-status";
import { loadVenueNews } from "@/features/venue-news/venue-news";

interface Loaded {
  items: InstitutionListItem[];
  /** Who lives at each institution now, by slug, from the map. Empty when the map did not load. */
  residents: Map<string, MapItem>;
}

function rowsOf(items: InstitutionListItem[], residents: Loaded["residents"]): PlaceRow[] {
  return items.map((item) => {
    const place = residents.get(item.slug);
    return {
      key: item.slug,
      name: item.name,
      detail: item.meta || null,
      count: place?.residentCount ?? 0,
      lead: place?.residents[0],
      accessibilityLabel: `${item.name}，${item.meta}`,
      onPress: () => router.push({ pathname: "/institutions/[slug]", params: { slug: item.slug } }),
    };
  });
}

function Group({ title, items, residents }: { title: string; items: InstitutionListItem[]; residents: Loaded["residents"] }) {
  if (items.length === 0) return null;
  return (
    <View className="gap-1.5">
      <Text variant="footnote" role="heading" className="px-inset text-muted-foreground tabular-nums">
        {`${title}　${items.length} 家`}
      </Text>
      <PlaceRows rows={rowsOf(items, residents)} icon={Landmark} />
    </View>
  );
}

/** 场馆动态 and 归国熊猫, each only once it has something published: an entry must not open onto an empty page. */
function NewsAndReturns() {
  const news = useQuery({ queryKey: ["venue-news", "all"], queryFn: () => loadVenueNews() });
  const overseas = useQuery({ queryKey: ["overseas-status"], queryFn: loadOverseasStatus });
  const hasNews = (news.data?.length ?? 0) > 0;
  const hasReturns = (overseas.data?.length ?? 0) > 0;
  if (!hasNews && !hasReturns) return null;
  return (
    <ListSection>
      {hasNews ? <ListCell icon={Newspaper} label="场馆动态" href="/venue-news" last={!hasReturns} /> : null}
      {hasReturns ? <ListCell icon={Plane} label="归国熊猫" href="/returning" last /> : null}
    </ListSection>
  );
}

export default function InstitutionsScreen() {
  const list = useQuery({ ...institutionListQueryOptions(), select: toListItems });
  // The list is the page; who lives where only dresses the rows, so a map failure is not one.
  const map = useQuery(mapViewQueryOptions());
  const residents = new Map<string, MapItem>();
  for (const item of map.data?.items ?? []) if (item.kind === "institution") residents.set(item.slug, item);
  const loaded: Loaded | null = list.data && !map.isPending ? { items: list.data, residents } : null;
  const failed = list.isError;

  function retry() {
    void list.refetch();
    if (map.isError) void map.refetch();
  }

  return (
    <Page title="基地和动物园" label={loaded && loaded.items.length > 0 ? `${loaded.items.length} 家` : undefined}>
      {loaded ? (
        loaded.items.length > 0 ? (
          <Animated.View entering={PAGE_ENTER} className="gap-section-tight">
            <NewsAndReturns />
            <Group title="国内" items={loaded.items.filter((item) => item.domestic)} residents={loaded.residents} />
            <Group title="海外" items={loaded.items.filter((item) => !item.domestic)} residents={loaded.residents} />
          </Animated.View>
        ) : (
          <ScreenState message="基地和动物园的资料还在整理中。" />
        )
      ) : failed ? (
        <LoadFailed message="列表暂时打不开。" onRetry={retry} />
      ) : (
        <View className="gap-1.5" accessibilityLabel="正在加载">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-52 w-full rounded-group" />
        </View>
      )}
    </Page>
  );
}
