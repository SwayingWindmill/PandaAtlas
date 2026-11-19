import { Stack, router } from "expo-router";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { ChevronLeft } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { Skeleton } from "@/components/ui/skeleton";
import { FloatingButton, LayerToggle, ViewControls } from "@/features/map/map-controls";
import { Overview, PlaceSheet, WildSheet } from "@/features/map/map-sheets";
import { TimelineBlock, YearSheet } from "@/features/map/map-timeline-sheet";
import { useMapScreen } from "@/features/map/use-map-screen";
import { VenueMap } from "@/features/map/venue-map";
import { WILD_AREAS } from "@/features/map/wild";

const SHEET_PEEK = 176;

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const map = useMapScreen(insets.top, window.width, window.height);

  const timelineBlock = map.timeline ? (
    <TimelineBlock
      timeline={map.timeline}
      index={map.index}
      onIndex={map.selectYear}
      playing={map.playing}
      onPlay={map.play}
      subtitle={
        map.year === undefined
          ? `${map.view?.items.filter((item) => item.residentCount > 0).length ?? 0} 个场馆有熊猫`
          : `这一年 ${map.yearEvents.length} 件事　拖动或播放`
      }
    />
  ) : null;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false, title: "熊猫地图" }} />
      <View testID="panda-world-map" className="absolute inset-0" {...map.handlers}>
        {map.viewport && map.camera && map.view ? (
          <>
            <Pressable accessible={false} onPress={map.clearSelection} className="absolute inset-0" />
            <VenueMap
              items={map.layers.venues || map.year !== undefined ? map.view.items : []}
              camera={map.camera}
              viewport={map.viewport}
              selectedId={map.place?.id ?? null}
              onSelect={map.onMarker}
              wild={map.layers.wild && map.year === undefined ? WILD_AREAS : []}
              selectedWildId={map.wildArea?.range.id ?? null}
              onSelectWild={map.onWild}
              year={map.yearView}
            />
          </>
        ) : (
          <View className="flex-1 bg-map-water" />
        )}
      </View>

      <View className="absolute left-gutter" style={{ top: insets.top + 8 }}>
        <FloatingButton label="返回" onPress={() => router.back()}>
          <Icon icon={ChevronLeft} size={24} tone="label" strokeWidth={2.25} />
        </FloatingButton>
      </View>
      {map.viewport && map.view ? (
        <View className="absolute right-gutter items-end gap-stack-tight" style={{ top: insets.top + 8 }} pointerEvents="box-none">
          <LayerToggle
            venues={map.layers.venues}
            wild={map.layers.wild}
            onVenues={map.toggleVenues}
            onWild={map.toggleWild}
          />
          <ViewControls overseas={map.overseas} onOverseas={map.flyOverseas} onHome={map.flyHome} />
        </View>
      ) : null}

      <View
        className="absolute inset-x-0 bottom-0 rounded-t-card bg-paper"
        style={{
          height: map.sheetUp ? map.sheetMax : SHEET_PEEK + insets.bottom,
          boxShadow: "0 -2px 16px rgba(0,0,0,0.08)",
          borderCurve: "continuous",
        }}
      >
        <View {...map.sheetResponder.panHandlers}>
          <Pressable
            role="button"
            accessibilityLabel={map.sheetUp ? "收起面板" : "展开面板"}
            onPress={map.toggleSheet}
            className="items-center pt-3 pb-3"
          >
            <View className="rounded-full bg-tertiary-foreground" style={{ width: 36, height: 5, opacity: 0.6 }} />
          </Pressable>
        </View>
        <ScrollView
          scrollEnabled={map.sheetUp}
          contentContainerClassName="px-gutter pt-stack-tight"
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        >
          {map.view ? (
            map.place ? (
              <PlaceSheet item={map.place} onClose={map.clearSelection} />
            ) : map.wildArea ? (
              <WildSheet area={map.wildArea} nearVenues={map.nearVenues} onClose={map.clearSelection} />
            ) : map.year !== undefined ? (
              <YearSheet timelineBlock={timelineBlock} events={map.yearEvents} />
            ) : (
              <Overview view={map.view} timelineBlock={timelineBlock} wildShown={map.layers.wild} onChoose={map.choose} />
            )
          ) : map.failed ? (
            <LoadFailed message="地图暂时打不开。" onRetry={() => void map.refetch()} />
          ) : (
            <View className="gap-stack" accessibilityLabel="正在加载地图">
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-40 w-full rounded-group" />
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}
