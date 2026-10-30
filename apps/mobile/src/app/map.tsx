import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { ScreenState } from "@/components/screen-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { loadMapView } from "@/features/map/load";
import { type MapItem, type MapView } from "@/features/map/model";
import { MapRows } from "@/features/map/place-list";
import { WorldMap } from "@/features/map/world-map";

function openMapItem(item: MapItem) {
  if (item.kind === "institution") {
    router.push({ pathname: "/institutions/[slug]", params: { slug: item.slug } });
    return;
  }
  router.push({ pathname: "/places/[slug]", params: { slug: item.slug } });
}

/** A grouped list's header: footnote, with the count in the same line. */
function GroupHeader({ title, count }: { title: string; count: string }) {
  return (
    <Text variant="footnote" role="heading" className="px-inset text-muted-foreground tabular-nums">
      {`${title}　${count}`}
    </Text>
  );
}

/** "12 个地方　86 只熊猫": what the map holds, under the title. */
function summary(view: MapView): string | undefined {
  if (view.items.length === 0) return undefined;
  const pandas = view.items.reduce((sum, item) => sum + item.residentCount, 0);
  return `${view.items.length} 个地方　${pandas} 只熊猫`;
}

export default function MapScreen() {
  const [view, setView] = useState<MapView | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(() => {
    loadMapView()
      .then(setView)
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  function retry() {
    setFailed(false);
    load();
  }

  const selected = view?.clusters.find((cluster) => cluster.id === selectedId);
  const stacked = selected && selected.items.length > 1 ? selected.items : [];

  return (
    <Page title="熊猫在哪里" label={view ? summary(view) : undefined}>
      {view ? (
        <Animated.View entering={PAGE_ENTER} className="gap-section">
          <View className="gap-stack-tight">
            <WorldMap clusters={view.clusters} selectedId={selectedId} onOpen={openMapItem} onSelect={setSelectedId} />
            {stacked.length > 0 ? (
              <View className="gap-1.5">
                <GroupHeader title="这个点上" count={`${stacked.length} 个地方`} />
                <MapRows items={stacked} onOpen={openMapItem} />
              </View>
            ) : (
              <Text variant="footnote" className="px-inset text-muted-foreground">
                圆点越大，住的熊猫越多。点一下打开那个地方。
              </Text>
            )}
          </View>
          {view.items.length > 0 ? (
            <View testID="map-places" className="gap-section-tight">
              {view.groups.map((group) =>
                group.items.length > 0 ? (
                  <View key={group.id} className="gap-1.5">
                    <GroupHeader title={group.title} count={`${group.items.length} 个地方`} />
                    <MapRows items={group.items} onOpen={openMapItem} />
                  </View>
                ) : null,
              )}
            </View>
          ) : (
            <ScreenState message="地点资料还在整理中。" />
          )}
        </Animated.View>
      ) : failed ? (
        <LoadFailed message="地图暂时打不开。" onRetry={retry} />
      ) : (
        <View className="gap-section" accessibilityLabel="正在加载地图">
          <Skeleton className="h-56 w-full rounded-card" />
          <View className="gap-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-52 w-full rounded-group" />
          </View>
        </View>
      )}
    </Page>
  );
}
