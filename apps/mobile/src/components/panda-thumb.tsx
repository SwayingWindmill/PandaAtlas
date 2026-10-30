import { Image } from "expo-image";
import { View } from "react-native";

import { PhotoOutline } from "@/components/photo-outline";
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
  shape?: "round" | "square";
}) {
  const photo = usePandaCover(pandaId);
  const radius = shape === "round" ? size / 2 : RADIUS.control;
  return (
    <View
      className="items-center justify-center overflow-hidden bg-secondary"
      style={{ width: size, height: size, borderRadius: radius, borderCurve: "continuous" }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {photo ? (
        <Image source={photo} style={{ width: size, height: size }} contentFit="cover" transition={200} accessible={false} />
      ) : (
        <Text
          variant={size >= 48 ? "title" : "headline"}
          role="none"
          allowFontScaling={false}
          className="text-muted-foreground"
        >
          {name.slice(0, 1)}
        </Text>
      )}
      {photo ? <PhotoOutline radius={radius} /> : null}
    </View>
  );
}
