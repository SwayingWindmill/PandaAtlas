import { WORLD_LAND_PATH, clusterWorldPoints, projectToWorld } from "@zhipanda/world-map";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/icon";
import { House, Trees } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

import { type Camera, type Point, type Viewport, toScreen, viewBox } from "./camera";
import { type MapItem, mapItemLabel } from "./model";
import type { WildArea } from "./wild";

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

export interface YearView {
  year: number;
  /** Pandas at each map item at the end of the year. */
  counts: ReadonlyMap<string, number>;
  flows: { from: Point; to: Point }[];
}

/** A place in a past year, as flowmap draws a node: a ring whose size follows who lived there, and the count. */
function YearNode({
  marker,
  count,
  land,
  width,
  onPress,
}: {
  marker: MapMarker;
  count: number;
  land: string;
  width: number;
  onPress?: () => void;
}) {
  const size = Math.round(12 + Math.sqrt(count) * 4);
  const flip = flipsAt(marker, width);
  const halo = { textShadowColor: land, textShadowRadius: 3, textShadowOffset: { width: 0, height: 0 } };
  return (
    <Pressable
      role="button"
      accessibilityLabel={`${markerName(marker)}，这一年 ${count} 只熊猫`}
      onPress={onPress}
      disabled={!onPress}
      hitSlop={8}
      className={cn("absolute items-center gap-1", flip ? "flex-row-reverse" : "flex-row")}
      style={{ top: marker.y - size / 2, ...(flip ? { right: width - marker.x - size / 2 } : { left: marker.x - size / 2 }) }}
    >
      <View className="rounded-full border-2 border-primary bg-highlight-soft" style={{ width: size, height: size, opacity: 0.9 }} />
      <Text variant="footnote" allowFontScaling={false} numberOfLines={1} className="font-semibold" style={[halo, { maxWidth: LABEL_MAX }]}>
        {markerName(marker)}
      </Text>
      <Text variant="footnote" allowFontScaling={false} className="font-medium text-muted-foreground tabular-nums" style={halo}>
        {count}
      </Text>
    </Pressable>
  );
}

/** One quadratic arc from a to b, bowed upward, as a band that widens toward b and ends in an arrowhead. */
export function flowPath(a: Point, b: Point, width: number): string {
  const mid = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - Math.abs(b.x - a.x) * 0.22 - 12 };
  const at = (t: number) => ({
    x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * mid.x + t * t * b.x,
    y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * mid.y + t * t * b.y,
  });
  const normal = (t: number) => {
    const dx = 2 * (1 - t) * (mid.x - a.x) + 2 * t * (b.x - mid.x);
    const dy = 2 * (1 - t) * (mid.y - a.y) + 2 * t * (b.y - mid.y);
    const length = Math.hypot(dx, dy) || 1;
    return { x: -dy / length, y: dx / length };
  };
  const end = 0.88;
  const steps = 24;
  const left: Point[] = [];
  const right: Point[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = (index / steps) * end;
    const point = at(t);
    const n = normal(t);
    const half = (width * (0.2 + 0.8 * (t / end))) / 2;
    left.push({ x: point.x + n.x * half, y: point.y + n.y * half });
    right.push({ x: point.x - n.x * half, y: point.y - n.y * half });
  }
  const base = at(end);
  const n = normal(end);
  const head = width * 1.3;
  const line = (points: Point[]) => points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" L");
  return `M${line(left)} L${(base.x + n.x * head).toFixed(1)},${(base.y + n.y * head).toFixed(1)} L${b.x.toFixed(1)},${b.y.toFixed(1)} L${(base.x - n.x * head).toFixed(1)},${(base.y - n.y * head).toFixed(1)} L${line(right.reverse())} Z`;
}

function Flows({ flows, camera, viewport }: { flows: YearView["flows"]; camera: Camera; viewport: Viewport }) {
  const [tint] = useCSSVariable(["--color-graphic"]).map(String) as [string];
  if (flows.length === 0) return null;
  return (
    <Svg width={viewport.width} height={viewport.height} style={{ position: "absolute" }} pointerEvents="none">
      {flows.map((flow, index) => (
        <Path
          key={index}
          d={flowPath(toScreen(flow.from, camera, viewport), toScreen(flow.to, camera, viewport), 5)}
          fill={tint}
          fillOpacity={0.9}
        />
      ))}
    </Svg>
  );
}

/** Where a wild area's name goes: at its centre, or just above or below it when a venue's name is there. */
function wildLabelAt(at: Point, name: string, markers: readonly MapMarker[], named: ReadonlySet<string>, width: number): Point {
  const boxes = markers.filter((marker) => named.has(marker.id)).map((marker) => labelBox(marker, flipsAt(marker, width)));
  const labelWidth = 24 + name.length * 13;
  const clear = (y: number) =>
    boxes.every((box) => at.x - 24 > box.right || at.x - 24 + labelWidth < box.left || y - 11 > box.bottom || y + 11 < box.top);
  const y = [at.y, at.y + 24, at.y - 24, at.y + 44].find(clear) ?? at.y;
  return { x: at.x, y };
}

/** A wild area's name with a bare trees glyph, haloed like a city name; it selects the area. */
function WildLabel({
  area,
  x,
  y,
  land,
  ink,
  compact,
  selected,
  onPress,
}: {
  area: WildArea;
  x: number;
  y: number;
  land: string;
  ink: string;
  compact: boolean;
  selected: boolean;
  onPress?: () => void;
}) {
  const halo = { textShadowColor: land, textShadowRadius: 3, textShadowOffset: { width: 0, height: 0 } };
  const body = (
    <View className="flex-row items-center gap-1">
      <Icon icon={Trees} size={compact ? 13 : 15} color={ink} strokeWidth={2.25} />
      {compact ? null : (
        <Text variant="footnote" allowFontScaling={false} className="font-semibold" style={[halo, { color: ink }]}>
          {area.range.name}
        </Text>
      )}
    </View>
  );
  const style = { position: "absolute" as const, left: x - (compact ? 7 : 24), top: y - 9 };
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
      accessibilityLabel={`${area.range.name}，野生大熊猫 ${area.count} 只`}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={12}
      style={style}
      className="active:opacity-70"
    >
      {body}
    </Pressable>
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
  wild = [],
  selectedWildId = null,
  onSelectWild,
  year,
}: {
  items: readonly MapItem[];
  camera: Camera;
  viewport: Viewport;
  selectedId?: string | null;
  /** Glyphs only, no names: the thumbnail on 找熊猫. */
  compact?: boolean;
  onSelect?: (marker: MapMarker) => void;
  /** The wild areas to draw under the venues; empty when the layer is off. */
  wild?: readonly WildArea[];
  selectedWildId?: string | null;
  onSelectWild?: (area: WildArea) => void;
  /** A year on the timeline: each place drawn as a ring sized by who lived there, and the year's moves as flows. */
  year?: YearView;
}) {
  const [land, water, wildFill, wildInk] = useCSSVariable([
    "--color-map-land",
    "--color-map-water",
    "--color-map-wild",
    "--color-map-wild-ink",
  ]).map(String) as [string, string, string, string];
  const shown = useMemo(
    () => (year ? items.filter((item) => (year.counts.get(item.id) ?? 0) > 0) : items),
    [items, year],
  );
  const markers = useMemo(
    () => markersAt(shown, camera, viewport, compact ? GLYPH_GAP : MARKER_GAP),
    [shown, camera, viewport, compact],
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
        {wild.map((area) => {
          const selected = area.range.id === selectedWildId;
          return (
            // One group at one opacity, so where a range's circles overlap they read as one area.
            <G key={area.range.id} opacity={selected ? 1 : 0.85}>
              {area.patches.map((patch) => (
                <Circle
                  key={patch.name}
                  cx={patch.x}
                  cy={patch.y}
                  r={patch.radius}
                  fill={wildFill}
                  stroke={selected ? wildInk : "none"}
                  strokeWidth={selected ? 1.5 : 0}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </G>
          );
        })}
      </Svg>
      {wild.map((area) => {
        const at = wildLabelAt(toScreen(area.label, camera, viewport), area.range.name, markers, named, viewport.width);
        return (
          <WildLabel
            key={area.range.id}
            area={area}
            x={at.x}
            y={at.y}
            land={land}
            ink={wildInk}
            compact={compact}
            selected={area.range.id === selectedWildId}
            onPress={onSelectWild ? () => onSelectWild(area) : undefined}
          />
        );
      })}
      {year ? <Flows flows={year.flows} camera={camera} viewport={viewport} /> : null}
      {year ? (
        <Text
          variant="display"
          role="none"
          allowFontScaling={false}
          className="absolute inset-x-0 text-center tabular-nums"
          style={{ top: viewport.top + 12, opacity: 0.82, textShadowColor: land, textShadowRadius: 6, textShadowOffset: { width: 0, height: 0 } }}
        >
          {String(year.year)}
        </Text>
      ) : null}
      {cities.map((city) => (
        <CityLabel key={city.name} name={city.name} x={city.x} y={city.y} land={land} />
      ))}
      {year
        ? markers.map((marker) => (
            <YearNode
              key={marker.id}
              marker={marker}
              count={marker.items.reduce((sum, item) => sum + (year.counts.get(item.id) ?? 0), 0)}
              land={land}
              width={viewport.width}
              onPress={onSelect ? () => onSelect(marker) : undefined}
            />
          ))
        : null}
      {(year ? [] : markers).map((marker) => (
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
