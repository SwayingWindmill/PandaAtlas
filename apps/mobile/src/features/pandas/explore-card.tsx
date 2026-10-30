import { Image } from "expo-image";
import { type Href, router } from "expo-router";
import { View } from "react-native";

import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { Scrim } from "@/components/scrim";
import { Text } from "@/components/ui/text";
import { semantic } from "@/design/tokens";
import type { StoryPhoto } from "@/features/today/story-photos";
import { RADIUS } from "@/lib/surface";

const PLACEHOLDER = semantic.color.light.mediaPlaceholder;

/**
 * A landscape photo card that opens one of 找熊猫's ways in (熊猫在哪里, 基地和动物园, 查两只熊猫的
 * 关系), as Music's Browse leads with large artwork: a real panda photo, the destination's name in
 * white and a footnote that names the panda pictured, so the photo never pretends to be something else.
 */
export function ExploreCard({
  id,
  title,
  photo,
  href,
  width,
}: {
  id: string;
  title: string;
  photo: StoryPhoto | undefined;
  href: Href;
  width: number;
}) {
  return (
    <PressScale
      onPress={() => router.push(href)}
      role="button"
      accessibilityLabel={title}
      style={{ width, aspectRatio: 4 / 3 }}
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
          <Text variant="title" role="none" className="text-white" numberOfLines={2}>
            {title}
          </Text>
          {photo ? (
            <Text variant="footnote" className="text-white/85" numberOfLines={1}>
              {`照片：${photo.name}`}
            </Text>
          ) : null}
        </View>
        <PhotoOutline radius={RADIUS.tile} />
      </View>
    </PressScale>
  );
}
