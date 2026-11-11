import { WORLD_LAND_PATH, clusterWorldPoints, projectToWorld } from "@zhipanda/world-map";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/icon";
import { House } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { type Camera, type Viewport, toScreen, viewBox } from "./camera";
import { type MapItem, mapItemLabel } from "./model";

/** Markers closer than this on screen, in pixels, are drawn as one. Bare glyphs need less room than named ones. */
const MARKER_GAP = 44;
const GLYPH_GAP = 24;
const GLYPH = 22;
/** A name longer than this ends in an ellipsis on the map; the sheet and the spoken label carry it whole. */
const LABEL_MAX = 150;

/**
 * Cities drawn faintly for orientation once the map shows China. Cities a venue already names
 * (成都, 雅安, 东京, 华盛顿) are left out so a label never sits on a marker.
 */
const CITIES = [
  { name: "重庆", lon: 106.55, lat: 29.56 },
  { name: "西安", lon: 108.94, lat: 34.34 },
  { name: "兰州", lon: 103.83, lat: 36.06 },
  { name: "昆明", lon: 102.83, lat: 24.88 },
  { name: "贵阳", lon: 106.63, lat: 26.65 },
  { name: "拉萨", lon: 91.11, lat: 29.65 },
  { name: "武汉", lon: 114.3, lat: 30.59 },
  { name: "广州", lon: 113.26, lat: 23.13 },
  { name: "上海", lon: 121.47, lat: 31.23 },
  { name: "北京", lon: 116.4, lat: 39.9 },
].map((city) => ({ name: city.name, point: projectToWorld(city.lon, city.lat) }));

/** City names appear from about the scale that fits China on a phone. */
const CITY_SCALE = 4;

export interface MapMarker {
  id: string;
  items: MapItem[];
  x: number;
  y: number;
}

/** Venues grouped by how close they fall on screen at this camera, the biggest one keeping its place. */
export function markersAt(items: readonly MapItem[], camera: Camera, viewport: Viewport, gap = MARKER_GAP): MapMarker[] {
  return clusterWorldPoints(items, (item) => item.point, gap / camera.scale).map((cluster) => {
    const screen = toScreen(cluster, camera, viewport);
    return { id: cluster.items.map((item) => item.id).join("+"), items: cluster.items, x: screen.x, y: screen.y };
  });
}

/** Rough box a marker's glyph and label take, for thinning labels; footnote CJK is about 13px a character. */
function labelBox(marker: MapMarker, flip: boolean) {
  const width = GLYPH + 4 + Math.min(LABEL_MAX, markerName(marker).length * 13) + 24;
  const left = flip ? marker.x + GLYPH / 2 - width : marker.x - GLYPH / 2;
  return { left, right: left + width, top: marker.y - 11, bottom: marker.y + 11 };
}

function flipsAt(marker: MapMarker, width: number): boolean {
  return marker.x > width - LABEL_MAX - 40;
}

/**
 * Which markers keep their names. Markers come biggest first, so where two labels would overlap the
 * smaller place shows its glyph alone, as Maps thins labels when zoomed out.
 */
function namedMarkers(markers: readonly MapMarker[], width: number): Set<string> {
  const placed: ReturnType<typeof labelBox>[] = [];
  const named = new Set<string>();
  for (const marker of markers) {
    const box = labelBox(marker, flipsAt(marker, width));
    const clashes = placed.some(
      (other) => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top,
    );
    if (clashes) continue;
    placed.push(box);
    named.add(marker.id);
  }
  return named;
}

function markerName(marker: MapMarker): string {
  const [first] = marker.items;
  if (marker.items.length === 1 && first) return first.name;
  return `${marker.items.length} 个地方`;
}

function markerCount(marker: MapMarker): number {
  return marker.items.reduce((sum, item) => sum + item.residentCount, 0);
}

function markerLabel(marker: MapMarker): string {
  const [first] = marker.items;
  if (marker.items.length === 1 && first) return mapItemLabel(first);
  return `${marker.items.map((item) => item.name).join("、")}，${marker.items.length} 个地方，点一下放大`;
}

/**
 * A place as Apple Maps draws one: a bare house glyph with a halo in the land color, and its name
 * and resident count beside it, haloed the same way. The selected place becomes a filled capsule.
 */
function Marker({
  marker,
  land,
  selected,
  compact,
  width,
  onPress,
}: {
  marker: MapMarker;
  land: string;
  /** The map's width: a marker near the right edge hangs its name to the left instead. */
  width: number;
  selected: boolean;
  compact: boolean;
  onPress?: () => void;
}) {
  const count = markerCount(marker);
  const halo = { textShadowColor: land, textShadowRadius: 3, textShadowOffset: { width: 0, height: 0 } };
  const glyph = selected ? (
    <Icon icon={House} size={18} tone="onButton" strokeWidth={2.5} />
  ) : (
    <View style={{ width: GLYPH, height: GLYPH }}>
      <View style={{ position: "absolute" }}>
        <Icon icon={House} size={GLYPH} color={land} strokeWidth={6} />
      </View>
      <Icon icon={House} size={GLYPH} tone="tint" strokeWidth={2.5} />
    </View>
  );
  const label = compact ? null : (
    <View className="flex-row items-center gap-1">
      <Text
        variant="footnote"
        allowFontScaling={false}
        numberOfLines={1}
        style={[selected ? undefined : halo, { maxWidth: LABEL_MAX }]}
        className={selected ? "font-semibold text-primary-foreground" : "font-semibold"}
      >
        {markerName(marker)}
      </Text>
      {count > 0 ? (
        <Text
          variant="footnote"
          allowFontScaling={false}
          style={selected ? undefined : halo}
          className={selected ? "font-medium text-primary-foreground tabular-nums" : "font-medium text-muted-foreground tabular-nums"}
        >
          {count}
        </Text>
      ) : null}
    </View>
  );
  const flip = !compact && flipsAt(marker, width);
  const body = (
    <View
      className={cn("items-center gap-1", flip ? "flex-row-reverse" : "flex-row", selected && "rounded-full bg-primary")}
      style={selected ? { paddingHorizontal: 10, height: 32, boxShadow: "0 2px 8px rgba(0,0,0,0.18)" } : undefined}
    >
      {glyph}
      {label}
    </View>
  );
  // The glyph's centre sits on the place; the label hangs to its right, or its left by the edge.
  const inset = selected ? 10 + 9 : GLYPH / 2;
  const style = {
    position: "absolute" as const,
    top: marker.y - (selected ? 16 : GLYPH / 2),
    ...(flip ? { right: width - marker.x - inset } : { left: marker.x - inset }),
  };
  if (!onPress) {
    return (
      <View style={style} pointerEvents="none" accessible={false}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      role="button"
      accessibilityLabel={markerLabel(marker)}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={10}
      style={style}
      className="active:opacity-70"
    >
      {body}
    </Pressable>
  );
}

function CityLabel({ name, x, y, land }: { name: string; x: number; y: number; land: string }) {
  return (
    <View
      pointerEvents="none"
      accessible={false}
      className="flex-row items-center gap-1"
      style={{ position: "absolute", left: x - 2.5, top: y - 9 }}
    >
      <View className="rounded-full border border-muted-foreground" style={{ width: 5, height: 5 }} />
      <Text
        variant="footnote"
        allowFontScaling={false}
        className="text-muted-foreground"
        style={{ textShadowColor: land, textShadowRadius: 3, textShadowOffset: { width: 0, height: 0 } }}
      >
        {name}
      </Text>
    </View>
  );
}

/**
 * The panda map at one camera: the Natural Earth land outline, faint city names, and a marker per
 * place (or per group of places too close to tell apart). It draws; the screen owns the gestures.
 */
export function VenueMap({
  items,
  camera,
  viewport,
  selectedId = null,
  compact = false,
  onSelect,
}: {
  items: readonly MapItem[];
  camera: Camera;
  viewport: Viewport;
  selectedId?: string | null;
  /** Glyphs only, no names: the thumbnail on 找熊猫. */
  compact?: boolean;
  onSelect?: (marker: MapMarker) => void;
}) {
  const [land, water] = useCSSVariable(["--color-map-land", "--color-map-water"]).map(String) as [string, string];
  const markers = useMemo(
    () => markersAt(items, camera, viewport, compact ? GLYPH_GAP : MARKER_GAP),
    [items, camera, viewport, compact],
  );
  const named = useMemo(() => namedMarkers(markers, viewport.width), [markers, viewport.width]);
  const cities =
    camera.scale < CITY_SCALE
      ? []
      : CITIES.map((city) => ({ name: city.name, ...toScreen(city.point, camera, viewport) })).filter(
          (city) =>
            city.x > 0 &&
            city.x < viewport.width &&
            city.y > 0 &&
            city.y < viewport.height &&
            markers.every((marker) => Math.hypot(marker.x - city.x, marker.y - city.y) > (compact ? 28 : 56)),
        );
  return (
    <View style={{ width: viewport.width, height: viewport.height, backgroundColor: water, overflow: "hidden" }}>
      <Svg
        width={viewport.width}
        height={viewport.height}
        viewBox={viewBox(camera, viewport)}
        preserveAspectRatio="none"
        pointerEvents="none"
        accessibilityRole="image"
        accessibilityLabel="大熊猫所在地地图"
      >
        <Path d={WORLD_LAND_PATH} fill={land} />
      </Svg>
      {cities.map((city) => (
        <CityLabel key={city.name} name={city.name} x={city.x} y={city.y} land={land} />
      ))}
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          marker={marker}
          land={land}
          compact={compact || !named.has(marker.id)}
          width={viewport.width}
          selected={marker.items.length === 1 && marker.items[0]?.id === selectedId}
          onPress={onSelect ? () => onSelect(marker) : undefined}
        />
      ))}
    </View>
  );
}
