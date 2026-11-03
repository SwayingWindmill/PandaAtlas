import { Image } from "expo-image";
import { View } from "react-native";

import { Icon } from "@/components/icon";
import { Lock } from "@/components/icons";
import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { Scrim } from "@/components/scrim";
import { Text } from "@/components/ui/text";
import { semantic } from "@/design/tokens";
import { openPanda } from "@/features/pandas/panda-row";
import type { StoryPhoto } from "@/features/today/story-photos";
import { RADIUS } from "@/lib/surface";

const PLACEHOLDER = semantic.color.light.mediaPlaceholder;
const FILL = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const;

/**
 * A portrait tile for one of the day's reviewed photos: the photo, the panda's name in white over a
 * bottom scrim, and it opens that panda. Keeps its shape on the media placeholder while loading.
 */
export function StoryPhotoTile({ photo, width, slot }: { photo: StoryPhoto | undefined; width: number; slot: string }) {
  return (
    <PressScale
      onPress={() => photo && openPanda(photo.slug)}
      disabled={!photo}
      role="button"
      accessibilityLabel={photo?.name ?? "熊猫"}
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
          <>
            <Image source={photo.url} style={FILL} contentFit="cover" transition={200} accessible={false} />
            <Scrim id={`story-tile-${slot}`} height="50%" />
            <Text
              variant="headline"
              role="none"
              className="absolute right-0 bottom-0 left-0 p-row text-white"
              numberOfLines={1}
            >
              {photo.name}
            </Text>
          </>
        ) : null}
        <PhotoOutline radius={RADIUS.tile} />
      </View>
    </PressScale>
  );
}

/**
 * A 图鉴 tile not yet earned, for the signed-out preview: a real panda photo, blurred and dimmed under
 * a lock, so the grid reads as places waiting to fill rather than as pandas the fan has met.
 */
export function LockedPhotoTile({ photo, width }: { photo: StoryPhoto | undefined; width: number }) {
  return (
    <View
      style={{
        width,
        aspectRatio: 4 / 5,
        borderRadius: RADIUS.tile,
        borderCurve: "continuous",
        overflow: "hidden",
        backgroundColor: PLACEHOLDER,
      }}
    >
      {photo ? (
        <Image source={photo.url} style={FILL} contentFit="cover" blurRadius={20} transition={200} accessible={false} />
      ) : null}
      <View style={[FILL, { backgroundColor: semantic.scrim.color, opacity: 0.38 }]} />
      <View style={FILL} className="items-center justify-center">
        <View className="size-11 items-center justify-center rounded-full bg-white/20">
          <Icon icon={Lock} size="subhead" tone="onMedia" strokeWidth={2} />
        </View>
      </View>
      <PhotoOutline radius={RADIUS.tile} />
    </View>
  );
}
