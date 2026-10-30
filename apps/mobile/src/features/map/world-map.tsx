import { WORLD_CHINA_SHARE, WORLD_HEIGHT, WORLD_LAND_PATH, WORLD_WIDTH } from "@zhipanda/world-map";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, View, type ScrollViewInstance } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { type MapCluster, type MapItem, mapDotLabel } from "./model";

const MIN_TARGET = 28;

function dotSize(count: number): number {
  return count ? Math.min(44, 18 + Math.sqrt(count) * 5) : 12;
}

export function WorldMap({
  clusters,
  selectedId,
  onOpen,
  onSelect,
}: {
  clusters: MapCluster[];
  selectedId: string | null;
  onOpen: (item: MapItem) => void;
  onSelect: (id: string | null) => void;
}) {
  // Land in the elevated surface on the secondary fill, as Maps mutes its base map under pins.
  const [land, canvas] = useCSSVariable(["--color-card", "--color-secondary"]);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [viewport, setViewport] = useState(0);
  const mapWidth = viewport > 0 ? Math.max(viewport * 1.85, 640) : 0;
  const mapHeight = mapWidth > 0 ? (mapWidth * WORLD_HEIGHT) / WORLD_WIDTH : 0;

  // The outline is wider than a phone. Open it on China, where most pandas live.
  useEffect(() => {
    if (!viewport || !mapWidth) return;
    scrollRef.current?.scrollTo({ x: Math.max(0, mapWidth * WORLD_CHINA_SHARE - viewport / 2), animated: false });
  }, [viewport, mapWidth]);

  return (
    <View
      testID="panda-world-map"
      className="w-full overflow-hidden rounded-card bg-secondary"
      style={{ borderCurve: "continuous" }}
      onLayout={(event) => setViewport(event.nativeEvent.layout.width)}
    >
      {mapWidth > 0 ? (
        <ScrollView horizontal nestedScrollEnabled ref={scrollRef} showsHorizontalScrollIndicator={false}>
          <View style={{ width: mapWidth, height: mapHeight }}>
            <Svg
              width={mapWidth}
              height={mapHeight}
              viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
              accessibilityRole="image"
              accessibilityLabel="大熊猫所在地世界地图"
              pointerEvents="none"
            >
              <Path d={WORLD_LAND_PATH} fill={String(land)} stroke={String(canvas)} strokeWidth={0.6} />
            </Svg>
            {clusters.map((cluster) => {
              const size = dotSize(cluster.residentCount);
              const target = Math.max(size, MIN_TARGET);
              const selected = cluster.id === selectedId;
              const several = cluster.items.length > 1;
              return (
                <Pressable
                  key={cluster.id}
                  role="button"
                  accessibilityLabel={mapDotLabel(cluster)}
                  accessibilityState={several ? { expanded: selected } : undefined}
                  onPress={() => {
                    const only = cluster.items.length === 1 ? cluster.items[0] : undefined;
                    if (only) onOpen(only);
                    else onSelect(selected ? null : cluster.id);
                  }}
                  className="absolute items-center justify-center"
                  style={{
                    left: `${cluster.left}%`,
                    top: `${cluster.top}%`,
                    width: target,
                    height: target,
                    transform: [{ translateX: -target / 2 }, { translateY: -target / 2 }],
                  }}
                >
                  <View
                    className={cn(
                      "items-center justify-center overflow-hidden rounded-full border-2",
                      selected
                        ? "border-primary bg-foreground"
                        : cluster.residentCount > 0
                          ? "border-card bg-primary"
                          : "border-card bg-muted-foreground",
                    )}
                    style={{ width: size, height: size }}
                  >
                    {cluster.residentCount > 1 && size >= 24 ? (
                      // A map label, like a pin's: it keeps its size so the count stays inside the dot.
                      <Text
                        variant="footnote"
                        allowFontScaling={false}
                        className={cn("font-semibold tabular-nums", selected ? "text-background" : "text-primary-foreground")}
                      >
                        {cluster.residentCount}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      ) : (
        <View className="h-40" />
      )}
    </View>
  );
}
