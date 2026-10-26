import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { Text } from "@/components/ui/text";
import { useFollowed } from "@/features/engagement/favorites";
import { openPanda } from "@/features/pandas/panda-row";
import { type PandaListItem, loadPandaIndex } from "@/features/pandas/pandas";
import { usePandaCover } from "@/lib/covers";

function Avatar({ panda }: { panda: PandaListItem }) {
  const photo = usePandaCover(panda.id);
  return (
    <Pressable
      onPress={() => openPanda(panda.slug)}
      role="button"
      accessibilityLabel={panda.name}
      className="w-16 items-center gap-1.5"
    >
      <View className="size-14 items-center justify-center overflow-hidden rounded-full bg-accent">
        {photo ? (
          <Image source={photo} style={{ width: 56, height: 56 }} contentFit="cover" accessible={false} />
        ) : (
          <Text className="font-extrabold">{panda.name.slice(0, 1)}</Text>
        )}
      </View>
      <Text variant="small" numberOfLines={1}>
        {panda.name}
      </Text>
    </Pressable>
  );
}

/** 你关注的 N 只 at the top of 今天: the followed pandas, one tap from their profiles. */
export function FollowedStrip() {
  const followed = useFollowed();
  const [pandas, setPandas] = useState<PandaListItem[] | null>(null);
  useEffect(() => {
    loadPandaIndex()
      .then(setPandas)
      .catch(() => setPandas([]));
  }, []);
  const items = useMemo(
    () => (pandas && followed ? pandas.filter((panda) => followed.has(panda.id)) : []),
    [pandas, followed],
  );
  if (items.length === 0) return null;
  return (
    <View className="gap-2">
      <Text variant="small" className="text-muted-foreground">{`你关注的 ${items.length} 只`}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {items.map((panda) => (
          <Avatar key={panda.id} panda={panda} />
        ))}
      </ScrollView>
    </View>
  );
}
