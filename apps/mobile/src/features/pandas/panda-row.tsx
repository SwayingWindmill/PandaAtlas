import { Image } from "expo-image";
import { router } from "expo-router";
import { memo } from "react";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import { type PandaListItem, listMeta } from "@/features/pandas/pandas";
import { usePandaCover } from "@/lib/covers";
import { cn } from "@/lib/utils";

export function openPanda(slug: string) {
  router.push({ pathname: "/pandas/[slug]", params: { slug } });
}

export const PandaRow = memo(function PandaRow({ item, last }: { item: PandaListItem; last: boolean }) {
  const photo = usePandaCover(item.id);
  const meta = listMeta(item);
  return (
    <Pressable
      onPress={() => openPanda(item.slug)}
      role="button"
      accessibilityLabel={meta ? `${item.name}，${meta}` : item.name}
      className={cn("flex-row items-center gap-3 border-t-hairline border-border py-2.5 active:bg-accent", last && "border-b-hairline")}
    >
      <View className="size-14 items-center justify-center overflow-hidden rounded-md bg-accent">
        {photo ? (
          <Image source={photo} style={{ width: 56, height: 56 }} contentFit="cover" accessible={false} />
        ) : (
          <Text className="font-extrabold">{item.name.slice(0, 1)}</Text>
        )}
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-bold" numberOfLines={1}>
          {item.name}
        </Text>
        {meta ? (
          <Text variant="muted" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});
