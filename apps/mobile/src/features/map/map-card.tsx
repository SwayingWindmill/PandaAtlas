import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Chevron } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Globe, House, MapPin, Trees } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";

import { fitPoints } from "./camera";
import { mapViewQueryOptions } from "./load";
import { VenueMap } from "./venue-map";
import { WILD_AREAS } from "./wild";

const MAP_HEIGHT = 168;

/**
 * 找熊猫's way into the map: a still thumbnail of China with a glyph per place, and the totals under
 * it. The whole card is one link; the map itself takes no gestures here.
 */
export function MapCard() {
  const { data: view } = useQuery(mapViewQueryOptions());
  const [width, setWidth] = useState(0);
  if (view && view.items.length === 0) return null;

  const china = view?.items.filter((item) => !item.overseas && item.point) ?? [];
  const overseas = view?.items.filter((item) => item.overseas).length ?? 0;
  const viewport = { width, height: MAP_HEIGHT, top: 0, bottom: 0 };
  const camera = fitPoints(
    [...china.flatMap((item) => (item.point ? [item.point] : [])), ...WILD_AREAS.flatMap((area) => area.patches)],
    viewport,
    24,
    8,
  );
  const totals = view ? `${view.items.length} 个场馆　${WILD_AREAS.length} 片野生区` : "";

  return (
    <Pressable
      role="link"
      accessibilityLabel={view ? `熊猫地图，${totals}` : "熊猫地图"}
      onPress={() => router.push("/map")}
      className="overflow-hidden rounded-group bg-card active:opacity-80"
      style={{ borderCurve: "continuous" }}
      onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}
    >
      <View style={{ height: MAP_HEIGHT }} pointerEvents="none">
        {view && width > 0 ? (
          <VenueMap items={view.items} camera={camera} viewport={viewport} wild={WILD_AREAS} compact />
        ) : (
          <Skeleton className="h-full w-full rounded-none" />
        )}
        {overseas > 0 ? (
          <View
            className="absolute left-3 top-3 flex-row items-center gap-1.5 rounded-full bg-paper px-3"
            style={{ height: 30, boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}
          >
            <Icon icon={Globe} size="footnote" tone="tint" strokeWidth={2} />
            <Text variant="footnote" className="font-semibold tabular-nums">{`海外 ${overseas} 个场馆`}</Text>
          </View>
        ) : null}
      </View>
      <View className="min-h-11 flex-row items-center gap-row px-inset py-row">
        <Icon icon={MapPin} tone="tint" strokeWidth={2} />
        <View className="min-w-0 flex-1 gap-hair-gap">
          <Text variant="headline">熊猫地图</Text>
          {view ? (
            <View className="flex-row flex-wrap items-center gap-x-3">
              <View className="flex-row items-center gap-1">
                <Icon icon={House} size="footnote" tone="secondary" />
                <Text variant="subheadline" className="text-muted-foreground tabular-nums">{`${view.items.length} 个场馆`}</Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Icon icon={Trees} size="footnote" tone="secondary" />
                <Text variant="subheadline" className="text-muted-foreground tabular-nums">{`${WILD_AREAS.length} 片野生区`}</Text>
              </View>
            </View>
          ) : null}
        </View>
        <Chevron />
      </View>
    </Pressable>
  );
}
