import { useQuery } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { ChevronLeft, Globe, House, LocateFixed, PawPrint, X } from "@/components/icons";
import { LoadFailed } from "@/components/load-failed";
import { PandaTile } from "@/components/panda-tile";
import { ScreenState } from "@/components/screen-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { type Camera, type Point, type Viewport, fitPoints } from "@/features/map/camera";
import { mapViewQueryOptions } from "@/features/map/load";
import { type MapItem, type MapView, pandaCountLabel } from "@/features/map/model";
import { MapRows } from "@/features/map/place-list";
import { useMapCamera } from "@/features/map/use-map-camera";
import { type MapMarker, VenueMap } from "@/features/map/venue-map";
import { HAIRLINE } from "@/lib/surface";

const BUTTON = 44;
const TILE = 96;
/** The sheet never covers more than this share of the screen; the map keeps the rest. */
const SHEET_SHARE = 0.46;
const FLOAT_SHADOW = "0 1px 2px rgba(0,0,0,0.1), 0 4px 14px rgba(0,0,0,0.1)";

function openPage(item: MapItem) {
  if (item.kind === "institution") router.push({ pathname: "/institutions/[slug]", params: { slug: item.slug } });
  else router.push({ pathname: "/places/[slug]", params: { slug: item.slug } });
}

function pointsOf(items: readonly MapItem[]): Point[] {
  return items.flatMap((item) => (item.point ? [item.point] : []));
}

function pandasIn(view: MapView): number {
  return view.items.reduce((sum, item) => sum + item.residentCount, 0);
}

/** A round button floating over the map, on the card surface so it reads on land and sea. */
function FloatingButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      role="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="items-center justify-center rounded-full bg-paper active:opacity-70"
      style={{ width: BUTTON, height: BUTTON, boxShadow: FLOAT_SHADOW }}
    >
      {children}
    </Pressable>
  );
}

/** Apple Maps' control column: the map's two view buttons in one capsule, split by a hairline. */
function ViewControls({ overseas, onOverseas, onHome }: { overseas: number; onOverseas: () => void; onHome: () => void }) {
  return (
    <View className="overflow-hidden rounded-control bg-paper" style={{ width: BUTTON, boxShadow: FLOAT_SHADOW }}>
      {overseas > 0 ? (
        <>
          <Pressable
            role="button"
            accessibilityLabel={`看海外的 ${overseas} 个地方`}
            onPress={onOverseas}
            className="items-center justify-center active:opacity-60"
            style={{ height: BUTTON }}
          >
            <Icon icon={Globe} size={21} tone="tint" strokeWidth={2} />
          </Pressable>
          <View className="mx-2 bg-border" style={{ height: HAIRLINE }} />
        </>
      ) : null}
      <Pressable
        role="button"
        accessibilityLabel="回到中国"
        onPress={onHome}
        className="items-center justify-center active:opacity-60"
        style={{ height: BUTTON }}
      >
        <Icon icon={LocateFixed} size={21} tone="label" strokeWidth={2} />
      </Pressable>
    </View>
  );
}

/** One line of the map's totals, each after a bare glyph. */
function Totals({ view }: { view: MapView }) {
  return (
    <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
      <View className="flex-row items-center gap-1.5">
        <Icon icon={House} size="footnote" tone="secondary" />
        <Text variant="subheadline" className="text-muted-foreground tabular-nums">{`${view.items.length} 个地方`}</Text>
      </View>
      <View className="flex-row items-center gap-1.5">
        <Icon icon={PawPrint} size="footnote" tone="secondary" />
        <Text variant="subheadline" className="text-muted-foreground tabular-nums">{`${pandasIn(view)} 只熊猫住在这些地方`}</Text>
      </View>
    </View>
  );
}

/** The sheet with nothing chosen: what the map holds, and every place as a list, those without a position included. */
function Overview({ view, onChoose }: { view: MapView; onChoose: (item: MapItem) => void }) {
  if (view.items.length === 0) return <ScreenState message="地点资料还在整理中。" />;
  return (
    <View className="gap-section-tight">
      <View className="gap-1.5">
        <Text variant="title" role="heading">
          熊猫地图
        </Text>
        <Totals view={view} />
      </View>
      <View testID="map-places" className="gap-section-tight">
        {view.groups.map((group) => (
          <View key={group.id} className="gap-1.5">
            <Text variant="footnote" role="heading" className="px-inset text-muted-foreground tabular-nums">
              {`${group.title}　${group.items.length} 个地方`}
            </Text>
            <MapRows items={group.items} onOpen={onChoose} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** The sheet for one place: who lives there, and the way to its own page. */
function PlaceSheet({ item, onClose }: { item: MapItem; onClose: () => void }) {
  return (
    <View className="gap-stack">
      <View className="flex-row items-start gap-row">
        <View className="min-w-0 flex-1 gap-hair-gap">
          <Text variant="title" role="heading">
            {item.name}
          </Text>
          <Text variant="subheadline" className="text-muted-foreground tabular-nums">
            {[item.where, pandaCountLabel(item.residentCount)].filter(Boolean).join("　")}
          </Text>
        </View>
        <Pressable
          role="button"
          accessibilityLabel="关闭"
          onPress={onClose}
          hitSlop={8}
          className="items-center justify-center rounded-full bg-secondary active:bg-accent"
          style={{ width: 30, height: 30 }}
        >
          <Icon icon={X} size={16} tone="secondary" strokeWidth={2.5} />
        </Pressable>
      </View>
      {item.residents.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-gutter" contentContainerClassName="gap-stack-tight px-gutter">
          {item.residents.map((panda) => (
            <PandaTile
              key={panda.id}
              pandaId={panda.id}
              name={panda.name}
              width={TILE}
              accessibilityLabel={panda.name}
              onPress={() => router.push({ pathname: "/pandas/[slug]", params: { slug: panda.slug } })}
            />
          ))}
        </ScrollView>
      ) : null}
      <Pressable
        role="link"
        accessibilityLabel={`打开${item.name}的页面`}
        onPress={() => openPage(item)}
        className="h-12 flex-row items-center justify-center gap-2 rounded-full bg-highlight-soft active:opacity-70"
      >
        <Icon icon={House} size="subhead" tone="tint" strokeWidth={2} />
        <Text variant="headline" className="text-primary">
          {item.kind === "institution" ? "场馆页" : "地点页"}
        </Text>
      </Pressable>
    </View>
  );
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const { data: view, isError: failed, refetch } = useQuery(mapViewQueryOptions());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const top = insets.top + 8 + BUTTON + 8;
  // The camera frames the strip above the sheet at its tallest, so the map does not jump as the sheet changes.
  const sheetMax = Math.round(window.height * SHEET_SHARE);
  const viewport = useMemo<Viewport | null>(
    () => (window.width && window.height ? { width: window.width, height: window.height, top, bottom: sheetMax } : null),
    [window.width, window.height, top, sheetMax],
  );
  const { camera, setCamera, flyTo, handlers } = useMapCamera(viewport);

  const china = useMemo(() => pointsOf(view?.items.filter((item) => !item.overseas) ?? []), [view]);
  const everywhere = useMemo(() => pointsOf(view?.items ?? []), [view]);
  const overseas = view?.items.filter((item) => item.overseas && item.point).length ?? 0;
  // Close enough that the Sichuan bases, a few dozen kilometres apart, open as separate places.
  const home = (port: Viewport): Camera => fitPoints(china.length ? china : everywhere, port, 56, 8);

  // The map opens on China, where most pandas live, once it knows how much the sheet covers.
  const opened = useRef(false);
  useEffect(() => {
    if (!viewport || !view || opened.current) return;
    opened.current = true;
    setCamera(home(viewport));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on the first layout with data
  }, [viewport, view]);

  const selected = view?.items.find((item) => item.id === selectedId);

  function choose(item: MapItem) {
    if (!item.point || !viewport || !camera) {
      openPage(item);
      return;
    }
    setSelectedId(item.id);
    flyTo({ x: item.point.x, y: item.point.y, scale: Math.max(camera.scale, home(viewport).scale) });
  }

  function onMarker(marker: MapMarker) {
    const [only] = marker.items;
    if (marker.items.length === 1 && only) choose(only);
    else if (viewport) flyTo(fitPoints(pointsOf(marker.items), viewport, 64, 4));
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false, title: "熊猫地图" }} />
      <View testID="panda-world-map" className="absolute inset-0" {...handlers}>
        {viewport && camera && view ? (
          <>
            <Pressable accessible={false} onPress={() => setSelectedId(null)} className="absolute inset-0" />
            <VenueMap items={view.items} camera={camera} viewport={viewport} selectedId={selectedId} onSelect={onMarker} />
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
      {viewport && view ? (
        <View className="absolute right-gutter" style={{ top: insets.top + 8 }}>
          <ViewControls
            overseas={overseas}
            onOverseas={() => {
              setSelectedId(null);
              flyTo(fitPoints(everywhere, viewport, 56, 0));
            }}
            onHome={() => {
              setSelectedId(null);
              flyTo(home(viewport));
            }}
          />
        </View>
      ) : null}

      <View
        className="absolute inset-x-0 bottom-0 rounded-t-card bg-paper"
        style={{ maxHeight: sheetMax, boxShadow: "0 -2px 16px rgba(0,0,0,0.08)", borderCurve: "continuous" }}
      >
        <ScrollView
          contentContainerClassName="px-gutter pt-section-tight"
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        >
          {view ? (
            selected ? (
              <PlaceSheet item={selected} onClose={() => setSelectedId(null)} />
            ) : (
              <Overview view={view} onChoose={choose} />
            )
          ) : failed ? (
            <LoadFailed message="地图暂时打不开。" onRetry={() => void refetch()} />
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
