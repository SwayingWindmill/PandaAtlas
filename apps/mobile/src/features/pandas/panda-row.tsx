import { Image } from "expo-image";
import { router } from "expo-router";
import { memo } from "react";
import { Pressable, View } from "react-native";

import { PhotoOutline } from "@/components/photo-outline";
import { Text } from "@/components/ui/text";
import { type PandaListItem, listMeta } from "@/features/pandas/pandas";
import { usePandaCover } from "@/lib/covers";
import { HAIRLINE, RADIUS } from "@/lib/surface";
import { cn } from "@/lib/utils";

export function openPanda(slug: string) {
  router.push({ pathname: "/pandas/[slug]", params: { slug } });
}

/** The row's photo, and where the separator under it starts: under the name, past the photo. */
const PHOTO = 56;
const SEPARATOR_INSET = { marginLeft: 16 + PHOTO + 12 } as const;

/**
 * One panda in a list, as Music lists albums: its cover in a small rounded square, the name in
 * headline and where it lives and when it was born under it. Consecutive rows read as one inset
 * group: `first` and `last` round the group's corners, and the separator stops before the last row.
 */
export const PandaRow = memo(function PandaRow({
  item,
  first = false,
  last,
}: {
  item: PandaListItem;
  first?: boolean;
  last: boolean;
}) {
  const photo = usePandaCover(item.id);
  const meta = listMeta(item);
  return (
    <View
      className={cn("overflow-hidden bg-card", first && "rounded-t-group", last && "rounded-b-group")}
      style={{ borderCurve: "continuous" }}
    >
      <Pressable
        onPress={() => openPanda(item.slug)}
        role="button"
        accessibilityLabel={meta ? `${item.name}，${meta}` : item.name}
        className="min-h-11 flex-row items-center gap-row px-inset py-stack-tight active:bg-accent"
      >
        <View
          className="items-center justify-center overflow-hidden rounded-control bg-secondary"
          style={{ width: PHOTO, height: PHOTO, borderCurve: "continuous" }}
        >
          {photo ? (
            <Image source={photo} style={{ width: PHOTO, height: PHOTO }} contentFit="cover" accessible={false} />
          ) : (
            <Text variant="title" className="text-muted-foreground">
              {item.name.slice(0, 1)}
            </Text>
          )}
          {photo ? <PhotoOutline radius={RADIUS.control} /> : null}
        </View>
        <View className="min-w-0 flex-1 gap-hair-gap">
          <Text variant="headline" numberOfLines={1}>
            {item.name}
          </Text>
          {meta ? (
            <Text variant="subheadline" className="text-muted-foreground" numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {last ? null : <View className="bg-border" style={[{ height: HAIRLINE }, SEPARATOR_INSET]} />}
    </View>
  );
});
