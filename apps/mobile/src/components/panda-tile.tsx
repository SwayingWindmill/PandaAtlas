import { Image } from "expo-image";
import { View } from "react-native";

import { PhotoOutline } from "@/components/photo-outline";
import { PressScale } from "@/components/press-scale";
import { Scrim } from "@/components/scrim";
import { Text } from "@/components/ui/text";
import { semantic } from "@/design/tokens";
import { usePandaCover } from "@/lib/covers";
import { RADIUS } from "@/lib/surface";

const PLACEHOLDER = semantic.color.light.mediaPlaceholder;

/**
 * A portrait photo tile for one panda, as Photos and Music draw an album: its cover with continuous
 * 16pt corners, the name in white over a bottom scrim and an optional footnote caption under it.
 * With no cover the tile keeps its shape on the media placeholder, so a shelf never jumps.
 */
export function PandaTile({
  pandaId,
  name,
  caption,
  width,
  aspect = 4 / 5,
  onPress,
  accessibilityLabel,
}: {
  pandaId: string;
  name: string;
  caption?: string;
  /** Omit to fill the column it sits in. */
  width?: number;
  aspect?: number;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const cover = usePandaCover(pandaId);
  return (
    <PressScale
      onPress={onPress}
      role="button"
      accessibilityLabel={accessibilityLabel}
      style={{ width, aspectRatio: aspect }}
      containerStyle={width === undefined ? { flex: 1 } : undefined}
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
        {cover ? (
          <Image
            source={cover}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            contentFit="cover"
            transition={200}
            accessible={false}
          />
        ) : null}
        <Scrim id={`tile-${pandaId}`} height="55%" />
        <View className="absolute right-0 bottom-0 left-0 gap-hair-gap p-row">
          <Text variant="headline" role="none" className="text-white" numberOfLines={1}>
            {name}
          </Text>
          {caption ? (
            <Text variant="footnote" className="text-white/85 tabular-nums" numberOfLines={1}>
              {caption}
            </Text>
          ) : null}
        </View>
        <PhotoOutline radius={RADIUS.tile} />
      </View>
    </PressScale>
  );
}
