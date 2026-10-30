import { Image } from "expo-image";
import { type Href, router } from "expo-router";
import { Pressable, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { Text } from "@/components/ui/text";
import type { StoryPhoto } from "@/features/today/story-photos";

/** Under the photo while it loads, dark enough that the white title already reads. */
const PLACEHOLDER = "#3A3A3C";

/** A bottom scrim, clear at the top to 72% black at the bottom, so white text holds on any photo. */
function Scrim({ id }: { id: string }) {
  return (
    <Svg style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "62%" }} width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity="0" />
          <Stop offset="0.45" stopColor="#000" stopOpacity="0.32" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.72" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/**
 * An App Store Today-style story card: a photo with 20pt continuous corners, the title in
 * white over a bottom scrim, and the feature it opens on a footnote line under the title.
 * The photo's panda is named on the same line, so the picture is never anonymous.
 */
export function StoryCard({
  id,
  title,
  feature,
  photo,
  href,
  height,
}: {
  id: string;
  title: string;
  feature: string;
  photo: StoryPhoto | undefined;
  href: Href;
  height: number;
}) {
  const caption = photo ? `${feature}　照片：${photo.name}` : feature;
  return (
    <Pressable
      onPress={() => router.push(href)}
      role="link"
      accessibilityLabel={`${title}，${feature}`}
      className="active:scale-[0.98] active:opacity-90"
      style={{
        height,
        borderRadius: 20,
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
      <View className="absolute right-0 bottom-0 left-0 gap-1 px-5 pt-10 pb-5">
        <Text variant="title1" className="text-white" numberOfLines={3}>
          {title}
        </Text>
        <Text variant="subhead" className="font-semibold text-white/85" numberOfLines={2}>
          {caption}
        </Text>
      </View>
    </Pressable>
  );
}
