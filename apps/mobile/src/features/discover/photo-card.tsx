import { Image } from "expo-image";
import { type Href, router } from "expo-router";
import type { ReactNode } from "react";
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
 * A photo card that opens one of 发现's pages, as Music's Browse leads with artwork: a real panda photo,
 * the destination's name in white, and a footnote naming the panda pictured, so the photo never pretends
 * to be something else. Without a photo the card keeps its plate and its name.
 */
export function PhotoCard({
  id,
  title,
  spoken = title,
  photo,
  href,
  width,
  ratio = 4 / 5,
  radius = RADIUS.tile,
  children,
}: {
  id: string;
  title: string;
  spoken?: string;
  photo: StoryPhoto | undefined;
  href: Href;
  width: number;
  /** Width over height: 4:5 for 专题, 1 for 玩一玩, wider for 时间里的熊猫. */
  ratio?: number;
  radius?: number;
  /** Anything set over the photo above the text, such as the 本期专题 label. */
  children?: ReactNode;
}) {
  return (
    <PressScale onPress={() => router.push(href)} role="button" accessibilityLabel={spoken} style={{ width, aspectRatio: ratio }}>
      <View style={{ flex: 1, borderRadius: radius, borderCurve: "continuous", overflow: "hidden", backgroundColor: PLACEHOLDER }}>
        {photo ? (
          <Image
            source={photo.url}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            contentFit="cover"
            transition={200}
            accessible={false}
          />
        ) : null}
        <Scrim id={`discover-${id}`} />
        {children}
        <View className="absolute right-0 bottom-0 left-0 gap-hair-gap p-inset">
          <Text variant="headline" role="none" className="text-on-media" numberOfLines={2}>
            {title}
          </Text>
          {photo ? (
            <Text variant="footnote" className="text-on-media/85" numberOfLines={1}>
              {`照片：${photo.name}`}
            </Text>
          ) : null}
        </View>
        <PhotoOutline radius={radius} />
      </View>
    </PressScale>
  );
}
