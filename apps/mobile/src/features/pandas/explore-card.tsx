import { Image } from "expo-image";
import { type Href, router } from "expo-router";
import { View } from "react-native";

import { Icon } from "@/components/icon";
import type { LucideIcon } from "@/components/icons";
import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { Scrim } from "@/components/scrim";
import { Text } from "@/components/ui/text";
import { semantic } from "@/design/tokens";
import type { StoryPhoto } from "@/features/today/story-photos";
import { RADIUS } from "@/lib/surface";

const PLACEHOLDER = semantic.color.light.mediaPlaceholder;

/**
 * A portrait photo card that opens one of 找熊猫's ways in (熊猫在哪里, 基地和动物园, 查两只熊猫的
 * 关系, 比一比两只熊猫), as Music's Browse leads with artwork: a real panda photo, the destination's glyph and
 * name in white, and a footnote that names the panda pictured, so the photo never pretends to be something else.
 */
export function ExploreCard({
  id,
  title,
  icon,
  photo,
  href,
  width,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  photo: StoryPhoto | undefined;
  href: Href;
  width: number;
}) {
  return (
    <PressScale
      onPress={() => router.push(href)}
      role="button"
      accessibilityLabel={title}
      style={{ width, aspectRatio: 4 / 5 }}
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
          <Image
            source={photo.url}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            contentFit="cover"
            transition={200}
            accessible={false}
          />
        ) : null}
        <Scrim id={`explore-${id}`} />
        <View className="absolute right-0 bottom-0 left-0 gap-hair-gap p-inset">
          <View className="flex-row items-center gap-stack-tight">
            <Icon icon={icon} tone="onMedia" />
            <Text variant="headline" role="none" className="shrink text-on-media" numberOfLines={2}>
              {title}
            </Text>
          </View>
          {photo ? (
            <Text variant="footnote" className="text-on-media/85" numberOfLines={1}>
              {`照片：${photo.name}`}
            </Text>
          ) : null}
        </View>
        <PhotoOutline radius={RADIUS.tile} />
      </View>
    </PressScale>
  );
}
