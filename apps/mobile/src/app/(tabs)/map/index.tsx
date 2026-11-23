import { Stack } from "expo-router";
import { BottomTabBarHeightContext } from "expo-router/js-tabs";
import { use } from "react";
import { Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LoadFailed } from "@/components/load-failed";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { component } from "@/design/tokens";
import { FilterBar, ViewControls } from "@/features/map/map-controls";
import { CloseButton, Overview, PlaceSheet, WildSheet } from "@/features/map/map-sheets";
import { TimelineBlock, YearSheet } from "@/features/map/map-timeline-sheet";
import { useMapScreen } from "@/features/map/use-map-screen";
import { VenueMap } from "@/features/map/venue-map";
import { WILD_AREAS } from "@/features/map/wild";

export default function MapTabScreen() {
  const insets = useSafeAreaInsets();
  const tabBar = use(BottomTabBarHeightContext);
  const window = useWindowDimensions();

  const bottomSafeInset =
    Platform.OS === "ios"
      ? insets.bottom + 54
      : Platform.OS === "web"
        ? insets.bottom + component.tabBar.webHeight
        : (tabBar ?? insets.bottom);

  const map = useMapScreen(insets.top, bottomSafeInset, window.width, window.height);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    height: map.sheetHeight.get(),
  }));

  const yearSpan = map.timeline?.years.length
    ? `${map.timeline.years[0]} — ${map.timeline.years[map.timeline.years.length - 1]}`
    : "1950 — 2026";

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
      <Stack.Screen options={{ headerShown: false, title: "地图" }} />

      <View testID="panda-world-map" className="absolute inset-0" {...map.handlers}>
        {map.viewport && map.camera && map.view ? (
          <>
            <Pressable accessible={false} onPress={map.clearSelection} className="absolute inset-0" />
            <VenueMap
              items={map.visibleItems}
              camera={map.camera}
              viewport={map.viewport}
              selectedId={map.place?.id ?? null}
              onSelect={map.onMarker}
              wild={map.showWild ? WILD_AREAS : []}
              selectedWildId={map.wildArea?.range.id ?? null}
              onSelectWild={map.onWild}
              year={map.yearView}
            />
          </>
        ) : (
          <View className="flex-1 bg-map-water" />
        )}
      </View>

      <View className="absolute inset-x-0" style={{ top: insets.top + 8 }} pointerEvents="box-none">
        <FilterBar active={map.filter} counts={map.filterCounts} onSelect={map.setFilter} />
      </View>

      {map.viewport && map.view ? (
        <View
          className="absolute right-gutter items-end"
          style={{ top: insets.top + 60 }}
          pointerEvents="box-none"
        >
          <ViewControls
            overseas={map.overseas}
            worldView={map.worldView}
            wild={map.layers.wild}
            onToggleWorld={map.toggleWorldView}
            onToggleWild={map.toggleWild}
          />
        </View>
      ) : null}

      <Animated.View
        className="absolute inset-x-0 bottom-0 rounded-t-card bg-paper"
        style={[
          sheetAnimatedStyle,
          {
            boxShadow: "0 -2px 16px rgba(0,0,0,0.08)",
            borderCurve: "continuous",
          },
        ]}
      >
        <View {...map.sheetResponder.panHandlers}>
          <Pressable
            role="button"
            accessibilityLabel={map.sheetSnap === "expanded" ? "收起面板" : "调整面板高度"}
            onPress={map.cycleSheet}
            className="items-center pt-3 pb-2"
          >
            <View className="rounded-full bg-tertiary-foreground" style={{ width: 36, height: 5, opacity: 0.6 }} />
          </Pressable>
        </View>

        <ScrollView
          scrollEnabled={map.sheetSnap !== "peek"}
          contentContainerClassName="px-gutter pt-stack-tight"
          contentContainerStyle={{ paddingBottom: bottomSafeInset + 20 }}
        >
          {map.view ? (
            map.place ? (
              <PlaceSheet item={map.place} liveMeta={map.featuredLiveMeta} onClose={map.clearSelection} />
            ) : map.wildArea ? (
              <WildSheet area={map.wildArea} nearVenues={map.nearVenues} onClose={map.clearSelection} />
            ) : map.timelineOpen || map.year !== undefined ? (
              <View className="gap-stack-tight">
                <View className="flex-row items-center justify-between">
                  <Text variant="title" role="heading">
                    分布时间轴
                  </Text>
                  <CloseButton label="关闭时间轴" onPress={map.closeTimeline} />
                </View>
                {map.year !== undefined ? (
                  <YearSheet timelineBlock={timelineBlock} events={map.yearEvents} />
                ) : (
                  timelineBlock
                )}
              </View>
            ) : (
              <Overview
                view={map.view}
                filter={map.filter}
                filteredItems={map.filteredItems}
                featuredPlace={map.featuredPlace}
                featuredLiveMeta={map.featuredLiveMeta}
                explicitPlace={map.place}
                yearSpan={yearSpan}
                wildShown={map.layers.wild}
                onClearPlace={map.clearSelection}
                onOpenTimeline={map.openTimeline}
                onChoose={map.choose}
                onWild={map.onWild}
              />
            )
          ) : map.failed ? (
            <LoadFailed message="地图暂时打不开。" onRetry={() => void map.refetch()} />
          ) : (
            <View className="gap-stack" accessibilityLabel="正在加载地图">
              <Skeleton className="h-12 w-full rounded-group" />
              <View className="flex-row gap-2.5">
                <Skeleton className="h-11 flex-1 rounded-pill" />
                <Skeleton className="h-11 flex-1 rounded-pill" />
              </View>
              <Skeleton className="h-40 w-full rounded-group" />
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
