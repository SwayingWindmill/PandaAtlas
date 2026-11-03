import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { Landmark } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { ScreenState } from "@/components/screen-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { type InstitutionListItem, loadInstitutions } from "@/features/institutions/institutions";
import { loadMapView } from "@/features/map/load";
import { type MapItem } from "@/features/map/model";
import { type PlaceRow, PlaceRows } from "@/features/map/place-list";

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

export default function InstitutionsScreen() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    // The list is the page; who lives where only dresses the rows, so a map failure is not one.
    Promise.all([loadInstitutions(), loadMapView().catch(() => null)])
      .then(([items, map]) => {
        const residents = new Map<string, MapItem>();
        for (const item of map?.items ?? []) if (item.kind === "institution") residents.set(item.slug, item);
        setLoaded({ items, residents });
      })
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  function retry() {
    setFailed(false);
    load();
  }

  return (
    <Page title="基地和动物园" label={loaded && loaded.items.length > 0 ? `${loaded.items.length} 家` : undefined}>
      {loaded ? (
        loaded.items.length > 0 ? (
          <Animated.View entering={PAGE_ENTER} className="gap-section-tight">
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
