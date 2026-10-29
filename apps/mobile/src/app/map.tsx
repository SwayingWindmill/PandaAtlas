import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { LoadFailed } from "@/components/load-failed";
import { Page } from "@/components/page";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
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

function Group({ title, items }: { title: string; items: MapItem[] }) {
  if (items.length === 0) return null;
  return (
    <View className="gap-3">
      <View className="flex-row items-baseline justify-between gap-3">
        <Text variant="h2">{title}</Text>
        <Text variant="muted">{`${items.length} 个地方`}</Text>
      </View>
      <MapRows items={items} onOpen={openMapItem} />
    </View>
  );
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
    <Page label="找熊猫" title="熊猫在哪里">
      {view ? (
        <>
          <WorldMap clusters={view.clusters} selectedId={selectedId} onOpen={openMapItem} onSelect={setSelectedId} />
          {stacked.length > 0 ? (
            <View className="rounded-lg bg-secondary px-4">
              <MapRows items={stacked} onOpen={openMapItem} />
            </View>
          ) : null}
          {view.items.length > 0 ? (
            <View testID="map-places" className="gap-8">
              {view.groups.map((group) => (
                <Group key={group.id} title={group.title} items={group.items} />
              ))}
            </View>
          ) : (
            <Text className="text-muted-foreground">地点资料还在整理中。</Text>
          )}
        </>
      ) : failed ? (
        <LoadFailed message="地图暂时打不开。" onRetry={retry} />
      ) : (
        <View className="gap-3" accessibilityLabel="正在加载地图">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </View>
      )}
    </Page>
  );
}
