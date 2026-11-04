import { Image } from "expo-image";
import { router } from "expo-router";
import { memo } from "react";
import { Pressable, View } from "react-native";

import { Chevron } from "@/components/grouped-list";
import { Icon } from "@/components/icon";
import { Mars, Venus } from "@/components/icons";
import { PhotoOutline } from "@/components/photo-outline";
import { Text } from "@/components/ui/text";
import { type PandaListItem, listMeta } from "@/features/pandas/pandas";
import { usePandaCover } from "@/lib/covers";
import { HAIRLINE } from "@/lib/surface";
import { cn } from "@/lib/utils";

export function openPanda(slug: string) {
  router.push({ pathname: "/pandas/[slug]", params: { slug } });
}

const SEX: Record<string, string> = { male: "雄性", female: "雌性" };

/** The row's photo, and where the separator under it starts: under the name, past the photo. */
const PHOTO = 44;
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
        accessibilityLabel={[item.name, SEX[item.sex ?? ""], meta].filter(Boolean).join("，")}
        className="min-h-11 flex-row items-center gap-row px-inset py-stack-tight active:bg-accent"
      >
        <View
          className="items-center justify-center overflow-hidden rounded-full bg-secondary"
          style={{ width: PHOTO, height: PHOTO, borderCurve: "continuous" }}
        >
          {photo ? (
            <Image source={photo} style={{ width: PHOTO, height: PHOTO }} contentFit="cover" accessible={false} />
          ) : (
            <Text variant="headline" className="text-muted-foreground">
              {item.name.slice(0, 1)}
            </Text>
          )}
          {photo ? <PhotoOutline radius={PHOTO / 2} /> : null}
        </View>
        <View className="min-w-0 flex-1 gap-hair-gap">
          <View className="flex-row items-center gap-hair-gap">
            <Text variant="body" className="shrink" numberOfLines={1}>
              {item.name}
            </Text>
            {item.sex ? <Icon icon={item.sex === "female" ? Venus : Mars} size="footnote" /> : null}
          </View>
          {meta ? (
            <Text variant="subheadline" className="text-muted-foreground" numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
        <Chevron />
      </Pressable>
      {last ? null : <View className="bg-border" style={[{ height: HAIRLINE }, SEPARATOR_INSET]} />}
    </View>
  );
});
