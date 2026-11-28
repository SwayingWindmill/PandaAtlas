import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { View, useWindowDimensions } from "react-native";

import { Chip } from "@/components/chip";
import { ListCell, ListSection, useSingleColumn, useStacked } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Plane, Users } from "@/components/icons";
import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { RemoteImage } from "@/components/remote-image";
import { Scrim } from "@/components/scrim";
import { SectionHeader } from "@/components/section-header";
import { Text } from "@/components/ui/text";
import { semantic } from "@/design/tokens";
import { localToday } from "@/features/engagement/seen";
import { loadOverseasStatus } from "@/features/overseas/overseas-status";
import { type PandaListItem, pandaIndexQueryOptions } from "@/features/pandas/pandas";
import { useSpecialChips } from "@/features/pandas/special-chips";
import { usePandaCover } from "@/lib/covers";
import { RADIUS, pageColumn } from "@/lib/surface";

import { type GalleryTab, availableGalleryTabs, pickGalleryPandas } from "./gallery-filter";

const PLACEHOLDER = semantic.color.light.mediaPlaceholder;
const GRID_GAP = 10;
const TILE_HEIGHT = 112;

function GalleryTile({ panda, width, height }: { panda: PandaListItem; width: number; height: number }) {
  const hasPhoto = Boolean(panda.hasFullBleedCover);
  const photo = usePandaCover(hasPhoto ? panda.id : undefined);
  return (
    <PressScale
      role="link"
      accessibilityLabel={[panda.name, panda.place].filter(Boolean).join("，")}
      onPress={() => router.push({ pathname: "/pandas/[slug]", params: { slug: panda.slug } })}
      style={{ width, height }}
    >
      <View
        style={{
          flex: 1,
          borderRadius: RADIUS.tile,
          borderCurve: "continuous",
          overflow: "hidden",
          backgroundColor: PLACEHOLDER,
        }}
      >
        {photo && hasPhoto ? (
          <RemoteImage
            source={photo}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            contentFit="cover"
            transition={200}
            accessible={false}
          />
        ) : null}
        <Scrim id={`gallery-${panda.id}`} height="55%" />
        <View className="absolute right-0 bottom-0 left-0 px-3 pb-2">
          <Text variant="headline" role="none" className="text-on-media" numberOfLines={1}>
            {panda.name}
          </Text>
          {panda.place ? (
            <Text variant="footnote" className="text-on-media/85" numberOfLines={1}>
              {panda.place}
            </Text>
          ) : null}
        </View>
        <PhotoOutline radius={RADIUS.tile} />
      </View>
    </PressScale>
  );
}

export function CuratedGallerySection() {
  const { width, fontScale } = useWindowDimensions();
  const single = useSingleColumn();
  const stacked = useStacked();
  const [selected, setSelected] = useState<GalleryTab>("精选");
  const { data: pandas } = useQuery(pandaIndexQueryOptions());
  const special = useSpecialChips();
  const overseas = useQuery({ queryKey: ["overseas-status"], queryFn: loadOverseasStatus });

  const tabs = useMemo(
    () => (pandas ? availableGalleryTabs(pandas, special) : []),
    [pandas, special],
  );
  const activeTab = tabs.includes(selected) ? selected : (tabs[0] ?? "精选");
  const today = localToday();

  const items = useMemo(
    () => (pandas ? pickGalleryPandas(pandas, activeTab, special, today, 4) : []),
    [activeTab, pandas, special, today],
  );

  const hasTwins = special["双胞胎"].size > 0;
  const hasReturning = (overseas.data?.length ?? 0) > 0;
  if (items.length === 0 && !hasReturning && !hasTwins) return null;

  if (items.length === 0) {
    return (
      <ListSection title="精选专题">
        {hasTwins ? (
          <ListCell
            icon={Users}
            label="双胞胎怎么分"
            detail="对比双胞胎脸型与毛色"
            href="/look-alikes"
            role="link"
            last={!hasReturning}
          />
        ) : null}
        {hasReturning ? (
          <ListCell
            icon={Plane}
            label="归国与专题"
            href="/returning"
            role="link"
            last
          />
        ) : null}
      </ListSection>
    );
  }

  const column = pageColumn(width);
  const tileWidth = single ? column : Math.floor((column - GRID_GAP) / 2);
  const tileHeight = Math.round(TILE_HEIGHT * Math.min(Math.max(fontScale, 1), 1.4));

  return (
    <View className="gap-stack-tight">
      <SectionHeader
        title="精选专题"
        action={hasReturning ? { label: "归国与专题", href: "/returning" } : undefined}
      />
      {tabs.length > 1 ? (
        <View className="flex-row flex-wrap gap-2">
          {tabs.map((tab) => (
            <Chip
              key={tab}
              label={tab}
              appearance="ink"
              selected={activeTab === tab}
              onPress={() => setSelected(tab)}
            />
          ))}
        </View>
      ) : null}
      <View className="flex-row flex-wrap" style={{ gap: GRID_GAP }}>
        {items.map((panda) => (
          <GalleryTile key={panda.id} panda={panda} width={tileWidth} height={tileHeight} />
        ))}
      </View>

      {hasTwins || hasReturning ? (
        <View className={stacked ? "gap-2.5" : "flex-row gap-2.5"}>
          {hasTwins ? (
            <PressScale
              role="link"
              accessibilityLabel="双胞胎怎么分，对比双胞胎脸型与毛色"
              onPress={() => router.push("/look-alikes")}
              containerStyle={!stacked && hasReturning ? { flex: 1 } : stacked ? undefined : { flex: 1 }}
              className="min-w-0 gap-1 rounded-group border-hairline border-border bg-card p-3"
            >
              <View className="flex-row items-center gap-1.5">
                <Icon icon={Users} size="footnote" tone="tint" strokeWidth={2} />
                <Text variant="headline" numberOfLines={1}>
                  双胞胎怎么分
                </Text>
              </View>
              <Text variant="footnote" className="text-muted-foreground" numberOfLines={1}>
                对比双胞胎脸型与毛色
              </Text>
            </PressScale>
          ) : null}
          {hasReturning ? (
            <PressScale
              role="link"
              accessibilityLabel="海外与归国，旅居海外与近期回家时间线"
              onPress={() => router.push("/returning")}
              containerStyle={!stacked && hasTwins ? { flex: 1 } : stacked ? undefined : { flex: 1 }}
              className="min-w-0 gap-1 rounded-group border-hairline border-border bg-card p-3"
            >
              <View className="flex-row items-center gap-1.5">
                <Icon icon={Plane} size="footnote" tone="tint" strokeWidth={2} />
                <Text variant="headline" numberOfLines={1}>
                  海外与归国
                </Text>
              </View>
              <Text variant="footnote" className="text-muted-foreground" numberOfLines={1}>
                旅居海外与近期回家时间线
              </Text>
            </PressScale>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
