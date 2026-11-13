import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Linking, Pressable, View, useWindowDimensions } from "react-native";
import Animated from "react-native-reanimated";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { ListCell, ListSection } from "@/components/grouped-list";
import { House } from "@/components/icons";
import { Page } from "@/components/page";
import { ScreenState } from "@/components/screen-state";
import { StatTile } from "@/components/stat-tile";
import { Text } from "@/components/ui/text";
import { PAGE_ENTER } from "@/design/motion";
import { mapViewQueryOptions } from "@/features/map/load";
import { openVenue } from "@/features/map/place-list";
import { WILD_AREAS, WILD_SOURCE, type WildArea, type WildPopulation, venuesNear } from "@/features/map/wild";
import { HAIRLINE, pageColumn } from "@/lib/surface";

const MAP_HEIGHT = 220;
const MAP_PAD = 24;

const letterOf = (area: WildArea, name: string) => name.slice(area.range.name.length) || name;

function WildSketch({ area, width }: { area: WildArea; width: number }) {
  const [land, wild, ink] = useCSSVariable(["--color-map-land", "--color-map-wild", "--color-map-wild-ink"]).map(String) as [
    string,
    string,
    string,
  ];
  const left = Math.min(...area.patches.map((patch) => patch.x - patch.radius));
  const right = Math.max(...area.patches.map((patch) => patch.x + patch.radius));
  const top = Math.min(...area.patches.map((patch) => patch.y - patch.radius));
  const bottom = Math.max(...area.patches.map((patch) => patch.y + patch.radius));
  const scale = Math.min((width - MAP_PAD * 2) / Math.max(right - left, 0.01), (MAP_HEIGHT - MAP_PAD * 2) / Math.max(bottom - top, 0.01));
  const offsetX = (width - (right - left) * scale) / 2;
  const offsetY = (MAP_HEIGHT - (bottom - top) * scale) / 2;
  const at = (x: number, y: number) => ({ x: offsetX + (x - left) * scale, y: offsetY + (y - top) * scale });
  return (
    <View
      className="overflow-hidden rounded-card"
      style={{ width, height: MAP_HEIGHT, backgroundColor: land, borderCurve: "continuous" }}
      accessible
      role="img"
      accessibilityLabel={`${area.range.name}的${area.patches.length}个局域种群在地图上的大致位置`}
    >
      <Svg width={width} height={MAP_HEIGHT}>
        {area.patches.map((patch) => {
          const centre = at(patch.x, patch.y);
          return (
            <Circle
              key={patch.name}
              cx={centre.x}
              cy={centre.y}
              r={Math.max(patch.radius * scale, 10)}
              fill={wild}
              fillOpacity={0.85}
              stroke={ink}
              strokeOpacity={0.5}
              strokeWidth={1.5}
            />
          );
        })}
        {area.patches.map((patch) => {
          const centre = at(patch.x, patch.y);
          return (
            <SvgText key={patch.name} x={centre.x} y={centre.y + 5} fill={ink} fontSize={15} fontWeight="700" textAnchor="middle">
              {letterOf(area, patch.name)}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

function Population({ area, population, largest }: { area: WildArea; population: WildPopulation; largest: number }) {
  const [ink] = useCSSVariable(["--color-map-wild-ink"]).map(String) as [string];
  return (
    <View className="gap-stack-tight px-inset py-row" accessible accessibilityLabel={`${population.name}，${population.count} 只，${population.counties.join("、")}`}>
      <View className="flex-row items-baseline gap-stack-tight">
        <Text variant="headline">{letterOf(area, population.name)}</Text>
        <Text variant="subheadline" className="min-w-0 flex-1 text-muted-foreground" numberOfLines={1}>
          {population.counties.join("、")}
        </Text>
        <Text variant="headline" className="tabular-nums">{`${population.count} 只`}</Text>
      </View>
      <View className="h-1.5 overflow-hidden rounded-pill bg-secondary">
        <View className="h-full rounded-pill" style={{ width: `${(population.count / largest) * 100}%`, backgroundColor: ink }} />
      </View>
    </View>
  );
}

export default function WildAreaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const { data: view } = useQuery(mapViewQueryOptions());
  const area = WILD_AREAS.find((item) => item.range.id === id);
  if (!area) {
    return (
      <Page title="野生栖息地">
        <ScreenState message="没找到这片栖息地。" />
      </Page>
    );
  }
  const column = pageColumn(width);
  const populations = [...area.range.populations].sort((a, b) => b.count - a.count);
  const largest = populations[0]?.count ?? 1;
  const near = venuesNear(area, view?.items ?? []);
  const others = WILD_AREAS.filter((item) => item !== area).sort((a, b) => b.count - a.count);
  const share = Math.round((area.count / WILD_SOURCE.parkTotal) * 100);

  return (
    <Page title={area.range.name} label={`${area.provinces.join("、")}　大熊猫国家公园`} prominent>
      <Animated.View entering={PAGE_ENTER} className="gap-section">
        <WildSketch area={area} width={column} />
        <View className="flex-row gap-stack-tight">
          <StatTile label="野生大熊猫" value={`${area.count} 只`} />
          <StatTile label="栖息地 km²" value={Math.round(area.habitatKm2).toLocaleString("en-US")} />
          <StatTile label="占国家公园" value={`${share} %`} />
        </View>
        <View className="gap-1.5">
          <Text variant="footnote" role="heading" className="px-inset font-semibold text-muted-foreground">
            {`局域种群　${populations.length} 个`}
          </Text>
          <View className="overflow-hidden rounded-group bg-card" style={{ borderCurve: "continuous" }}>
            {populations.map((population, order) => (
              <View key={population.name}>
                <Population area={area} population={population} largest={largest} />
                {order === populations.length - 1 ? null : <View className="ml-inset bg-border" style={{ height: HAIRLINE }} />}
              </View>
            ))}
          </View>
        </View>
        {near.length > 0 ? (
          <ListSection title="附近能看到熊猫的地方">
            {near.map((item, index) => (
              <ListCell
                key={item.id}
                icon={House}
                label={item.name}
                meta={item.residentCount > 0 ? `${item.residentCount} 只` : undefined}
                onPress={() => openVenue(item)}
                last={index === near.length - 1}
              />
            ))}
          </ListSection>
        ) : null}
        <ListSection title="其他山系">
          {others.map((item, index) => (
            <ListCell
              key={item.range.id}
              label={item.range.name}
              meta={`${item.count} 只`}
              onPress={() => router.replace({ pathname: "/wild/[id]", params: { id: item.range.id } })}
              last={index === others.length - 1}
            />
          ))}
        </ListSection>
        <Pressable role="link" accessibilityLabel="打开数据来源" onPress={() => void Linking.openURL(WILD_SOURCE.url)} className="px-inset active:opacity-60">
          <Text variant="footnote" className="text-muted-foreground">
            {`数量和栖息地面积出自${WILD_SOURCE.title}，${WILD_SOURCE.note}`}
            <Text variant="footnote" className="text-primary">
              查看来源
            </Text>
          </Text>
        </Pressable>
      </Animated.View>
    </Page>
  );
}

