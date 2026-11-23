import { useState } from "react";
import { View } from "react-native";

import { PhotoOutline } from "@/components/photo-outline";
import { RemoteImage } from "@/components/remote-image";
import { Text } from "@/components/ui/text";
import { usePandaCover } from "@/lib/covers";
import { RADIUS } from "@/lib/surface";

/**
 * A panda's cover at row size: a circle for a panda as a person (Messages, Mail), a rounded square
 * for a panda as the subject of a row (Music's albums). With no cover it keeps its size on the
 * secondary fill with the name's first character, so a list never jumps when photos arrive.
 * Always decorative: the row it sits in carries the name.
 */
export function PandaThumb({
  pandaId,
  name,
  size,
  shape = "square",
}: {
  pandaId: string;
  name: string;
  size: number;
  /** "tile" is a photo tile in a grid (the 图鉴), at the photo radius. */
  shape?: "round" | "square" | "tile";
}) {
  const photo = usePandaCover(pandaId);
  const [loaded, setLoaded] = useState<string | null>(null);
  const radius = shape === "round" ? size / 2 : shape === "tile" ? RADIUS.tile : RADIUS.control;
  const initial = (
    <Text variant={size >= 48 ? "title" : "headline"} role="none" allowFontScaling={false} className="text-muted-foreground">
      {name.slice(0, 1)}
    </Text>
  );
  return (
    <View
      className="items-center justify-center overflow-hidden bg-secondary"
      style={{ width: size, height: size, borderRadius: radius, borderCurve: "continuous" }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {photo ? (
        <RemoteImage
          source={photo}
          fallback={initial}
          transition={200}
          style={{ width: size, height: size }}
          contentFit="cover"
          accessible={false}
          onLoad={() => setLoaded(photo)}
        />
      ) : (
        initial
      )}
      {photo && loaded === photo ? <PhotoOutline radius={radius} /> : null}
    </View>
  );
}
