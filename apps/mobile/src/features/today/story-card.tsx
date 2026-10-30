import { Image } from "expo-image";
import { type Href, Link } from "expo-router";
import { View } from "react-native";

import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { Scrim } from "@/components/scrim";
import { Text } from "@/components/ui/text";
import { semantic } from "@/design/tokens";
import type { StoryPhoto } from "@/features/today/story-photos";
import { RADIUS } from "@/lib/surface";

/** Under the photo while it loads, dark enough that the white title already reads. */
const PLACEHOLDER = semantic.color.light.mediaPlaceholder;

/**
 * An App Store Today-style story card: one photograph with continuous corners, the title in white
 * over a bottom scrim, and a footnote under it naming the feature and the panda in the photo.
 * `featured` is the one large card at the top of 今天 (24pt corners, display title); the rest are
 * the smaller cards in the scroller under it (16pt corners, title size). On iOS 18+ the card
 * zooms into the screen it opens, as App Store Today cards do.
 */
export function StoryCard({
  id,
  title,
  feature,
  photo,
  href,
  width,
  height,
  featured = false,
}: {
  id: string;
  title: string;
  feature: string;
  photo: StoryPhoto | undefined;
  href: Href;
  width?: number;
  height: number;
  featured?: boolean;
}) {
  const radius = featured ? RADIUS.card : RADIUS.tile;
  const caption = photo ? `${feature}　照片：${photo.name}` : feature;
  return (
    <Link href={href} asChild>
      <Link.AppleZoom>
        <PressScale role="link" accessibilityLabel={`${title}，${feature}`} style={{ width, height }}>
          <View
            style={{
              flex: 1,
              borderRadius: radius,
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
                transition={250}
                accessible={false}
              />
            ) : null}
            <Scrim id={`scrim-${id}`} />
            <View className={featured ? "absolute right-0 bottom-0 left-0 gap-1 p-5" : "absolute right-0 bottom-0 left-0 gap-0.5 p-4"}>
              <Text variant={featured ? "display" : "title"} role="none" className="text-white" numberOfLines={featured ? 3 : 2}>
                {title}
              </Text>
              <Text variant="footnote" className="font-semibold text-white/85" numberOfLines={featured ? 2 : 1}>
                {caption}
              </Text>
            </View>
            <PhotoOutline radius={radius} />
          </View>
        </PressScale>
      </Link.AppleZoom>
    </Link>
  );
}
