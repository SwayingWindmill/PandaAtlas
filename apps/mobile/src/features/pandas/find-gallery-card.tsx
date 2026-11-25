import { memo } from "react";
import { View } from "react-native";

import { Icon } from "@/components/icon";
import { Check, Mars, Venus } from "@/components/icons";
import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { RemoteImage } from "@/components/remote-image";
import { Scrim } from "@/components/scrim";
import { Text } from "@/components/ui/text";
import { openPanda } from "@/features/pandas/panda-row";
import type { PandaListItem } from "@/features/pandas/pandas";
import { usePandaCover } from "@/lib/covers";
import { RADIUS } from "@/lib/surface";

/**
 * A 4:5 portrait panda card for 找熊猫's gallery view: full-bleed photograph, bottom scrim,
 * optional studbook pill in top-left, optional seen/followed status badge in top-right, and
 * name + sex + place/birth-year caption along the bottom.
 */
export const FindGalleryCard = memo(function FindGalleryCard({
  item,
  width,
  seen = false,
  followed = false,
  singleColumn = false,
  onOpen,
}: {
  item: PandaListItem;
  width: number;
  seen?: boolean;
  followed?: boolean;
  singleColumn?: boolean;
  onOpen?: () => void;
}) {
  const cover = usePandaCover(item.hasFullBleedCover ? item.id : undefined);
  const height = Math.round((width * 5) / 4);
  const birthYear = item.birthDate ? item.birthDate.slice(0, 4) : null;
  const subtitle = [
    item.place,
    birthYear ? `${birthYear} 年生` : null,
    !birthYear && item.deceased ? "已离世" : null,
  ]
    .filter(Boolean)
    .join("　");

  const spoken = [
    item.name,
    item.sex === "female" ? "雌性" : item.sex === "male" ? "雄性" : null,
    item.studbookNumber ? `谱系号 ${item.studbookNumber}` : null,
    subtitle || null,
    seen ? "已见过" : null,
    followed ? "已关注" : null,
  ]
    .filter(Boolean)
    .join("，");

  return (
    <PressScale
      role="button"
      accessibilityLabel={spoken}
      onPress={() => {
        onOpen?.();
        openPanda(item.slug);
      }}
      style={{ width, height }}
    >
      <View
        className="flex-1 overflow-hidden rounded-tile bg-media-placeholder"
        style={{ borderCurve: "continuous" }}
      >
        {cover ? (
          <RemoteImage
            source={cover}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            contentFit="cover"
            transition={200}
            accessible={false}
          />
        ) : null}
        <Scrim id={`find-gallery-${item.id}`} height="58%" />

        {item.studbookNumber || seen || followed ? (
          <View
            pointerEvents="none"
            className="absolute top-2.5 right-2.5 left-2.5 flex-row items-center justify-between gap-1.5"
          >
            {item.studbookNumber ? (
              <View className="max-w-full shrink rounded-pill bg-glass-fallback px-2 py-0.5">
                <Text
                  variant="footnote"
                  role="none"
                  className="font-semibold text-on-media tabular-nums"
                  numberOfLines={1}
                >
                  {item.studbookNumber}
                </Text>
              </View>
            ) : (
              <View />
            )}
            {seen || followed ? (
              <View className="shrink-0 flex-row items-center gap-1 rounded-pill bg-primary px-2 py-0.5">
                <Icon icon={Check} size={11} tone="onButton" strokeWidth={2.5} />
                <Text variant="footnote" role="none" className="font-semibold text-primary-foreground">
                  {seen ? "见过" : "关注"}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View pointerEvents="none" className="absolute right-0 bottom-0 left-0 gap-0.5 p-row">
          <View className="flex-row items-center gap-1">
            <Text
              variant="headline"
              role="none"
              className="min-w-0 shrink font-bold text-on-media"
              numberOfLines={singleColumn ? 2 : 1}
            >
              {item.name}
            </Text>
            {item.sex ? (
              <Icon icon={item.sex === "female" ? Venus : Mars} size="footnote" tone="onMedia" />
            ) : null}
          </View>
          {subtitle ? (
            <Text variant="footnote" role="none" className="text-on-media/85 tabular-nums" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <PhotoOutline radius={RADIUS.tile} />
      </View>
    </PressScale>
  );
});
