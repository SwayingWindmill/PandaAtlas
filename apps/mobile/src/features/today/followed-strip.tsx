import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";

import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { SectionHeader } from "@/components/section-header";
import { Text } from "@/components/ui/text";
import { useFollowed } from "@/features/engagement/favorites";
import { openPanda } from "@/features/pandas/panda-row";
import { type PandaListItem, loadPandaIndex } from "@/features/pandas/pandas";
import { usePandaCover } from "@/lib/covers";

/** The avatar's diameter: the size Photos gives the faces in People. */
export const AVATAR = 64;

/** One followed panda as a round photo with its name under it, one tap from the profile. */
export function PandaAvatar({ panda }: { panda: Pick<PandaListItem, "id" | "slug" | "name"> }) {
  const photo = usePandaCover(panda.id);
  return (
    <PressScale
      onPress={() => openPanda(panda.slug)}
      role="button"
      accessibilityLabel={panda.name}
      className="items-center gap-stack-tight"
      style={{ width: AVATAR + 8 }}
    >
      <View
        className="items-center justify-center overflow-hidden rounded-full bg-secondary"
        style={{ width: AVATAR, height: AVATAR }}
      >
        {photo ? (
          <Image
            source={photo}
            style={{ width: AVATAR, height: AVATAR }}
            contentFit="cover"
            transition={200}
            accessible={false}
          />
        ) : (
          <Text variant="title" role="none" className="text-muted-foreground">
            {panda.name.slice(0, 1)}
          </Text>
        )}
        {photo ? <PhotoOutline radius={AVATAR / 2} /> : null}
      </View>
      <Text variant="footnote" className="text-center" numberOfLines={1}>
        {panda.name}
      </Text>
    </PressScale>
  );
}

/** 你关注的 N 只 on 今天: the followed pandas as a row of round photos, as Photos shows People. */
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
    <View className="gap-row">
      <SectionHeader title={`你关注的 ${items.length} 只`} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-4"
        contentContainerClassName="gap-row px-4"
      >
        {items.map((panda) => (
          <PandaAvatar key={panda.id} panda={panda} />
        ))}
      </ScrollView>
    </View>
  );
}
