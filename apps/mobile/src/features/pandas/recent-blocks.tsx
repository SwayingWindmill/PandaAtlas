import { Image } from "expo-image";
import { Pressable, ScrollView, View } from "react-native";

import { Chip, ChipRow } from "@/components/chip";
import { PhotoOutline } from "@/components/photo-outline";
import { Text } from "@/components/ui/text";
import type { PandaListItem } from "@/features/pandas/pandas";
import { openPanda } from "@/features/pandas/panda-row";
import { clearRecentSearches, clearRecentViews, useRecentSearches, useRecentViews } from "@/features/pandas/recent";
import { usePandaCover } from "@/lib/covers";
import { nameInitial } from "@/lib/panda";

const THUMB = 72;

function RecentHeader({ title, onClear }: { title: string; onClear: () => void }) {
  return (
    <View className="min-h-11 flex-row items-end justify-between gap-row">
      <Text variant="title" className="min-w-0 flex-1" numberOfLines={1}>
        {title}
      </Text>
      <Pressable
        onPress={onClear}
        role="button"
        accessibilityLabel={`清空${title}`}
        hitSlop={8}
        className="min-h-11 justify-end active:opacity-60"
      >
        <Text variant="body" className="text-primary">
          清空
        </Text>
      </Pressable>
    </View>
  );
}

function Thumb({ item }: { item: PandaListItem }) {
  const photo = usePandaCover(item.id);
  return (
    <Pressable
      onPress={() => openPanda(item.slug)}
      role="button"
      accessibilityLabel={item.name}
      className="items-center gap-hair-gap active:opacity-60"
      style={{ width: THUMB }}
    >
      <View
        className="items-center justify-center overflow-hidden bg-secondary"
        style={{ width: THUMB, height: THUMB, borderRadius: 16, borderCurve: "continuous" }}
      >
        {photo ? (
          <Image source={photo} style={{ width: THUMB, height: THUMB }} contentFit="cover" accessible={false} />
        ) : (
          <Text variant="headline" className="text-muted-foreground">
            {nameInitial(item.name)}
          </Text>
        )}
        {photo ? <PhotoOutline radius={16} /> : null}
      </View>
      <Text variant="footnote" numberOfLines={1}>
        {item.name}
      </Text>
    </Pressable>
  );
}

export function RecentViews({ pandas }: { pandas: readonly PandaListItem[] }) {
  const ids = useRecentViews();
  const byId = new Map(pandas.map((panda) => [panda.id, panda]));
  const items = (ids ?? []).flatMap((id) => byId.get(id) ?? []);
  if (items.length === 0) return null;
  return (
    <View className="gap-stack-tight">
      <RecentHeader title="最近看过" onClear={clearRecentViews} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-gutter"
        contentContainerClassName="gap-row px-gutter"
        accessibilityLabel="最近看过的熊猫"
      >
        {items.map((item) => (
          <Thumb key={item.id} item={item} />
        ))}
      </ScrollView>
    </View>
  );
}

export function RecentSearches({ onPick }: { onPick: (query: string) => void }) {
  const queries = useRecentSearches();
  if (!queries || queries.length === 0) return null;
  return (
    <View className="gap-stack-tight">
      <RecentHeader title="最近搜索" onClear={clearRecentSearches} />
      <ChipRow>
        {queries.map((query) => (
          <Chip key={query} label={query} onPress={() => onPick(query)} />
        ))}
      </ChipRow>
    </View>
  );
}
