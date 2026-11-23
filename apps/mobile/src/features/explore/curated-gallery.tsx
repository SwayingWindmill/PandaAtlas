import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { View, useWindowDimensions } from "react-native";

import { Chip } from "@/components/chip";
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

function GalleryTile({ panda, width }: { panda: PandaListItem; width: number }) {
  const photo = usePandaCover(panda.id);
  return (
    <PressScale
      role="link"
      accessibilityLabel={[panda.name, panda.place].filter(Boolean).join("，")}
      onPress={() => router.push({ pathname: "/pandas/[slug]", params: { slug: panda.slug } })}
      style={{ width, height: TILE_HEIGHT }}
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
        {photo ? (
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
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState<GalleryTab>("精选");
  const { data: pandas } = useQuery(pandaIndexQueryOptions());
  const special = useSpecialChips();
  const overseas = useQuery({ queryKey: ["overseas-status"], queryFn: loadOverseasStatus });

  const tabs = useMemo(
    () => (pandas ? availableGalleryTabs(pandas, special) : ["精选" as const]),
    [pandas, special],
  );
  const activeTab = tabs.includes(selected) ? selected : "精选";
  const today = localToday();

  const items = useMemo(
    () => (pandas ? pickGalleryPandas(pandas, activeTab, special, today, 4) : []),
    [activeTab, pandas, special, today],
  );

  if (items.length === 0) return null;

  const tileWidth = Math.floor((pageColumn(width) - GRID_GAP) / 2);
  const hasReturning = (overseas.data?.length ?? 0) > 0;

  return (
    <View className="gap-stack-tight">
      <SectionHeader
        title="精选画报"
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
          <GalleryTile key={panda.id} panda={panda} width={tileWidth} />
        ))}
      </View>
    </View>
  );
}
