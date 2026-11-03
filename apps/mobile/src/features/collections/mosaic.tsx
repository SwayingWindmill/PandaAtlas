import { Image } from "expo-image";
import { View } from "react-native";

import { Icon } from "@/components/icon";
import { FolderHeart } from "@/components/icons";
import { PhotoOutline } from "@/components/photo-outline";
import { usePandaCover } from "@/lib/covers";
import { RADIUS } from "@/lib/surface";

/** The hairline of background between the four covers of a mosaic. */
const SEAM = 2;

function Cover({ pandaId, size }: { pandaId: string; size: number }) {
  const photo = usePandaCover(pandaId);
  return (
    <View className="bg-secondary" style={{ width: size, height: size }}>
      {photo ? (
        <Image source={photo} style={{ width: size, height: size }} contentFit="cover" transition={200} accessible={false} />
      ) : null}
    </View>
  );
}

/** Photos' album cover: the first four pandas as a 2×2 mosaic; one panda fills it; none shows the folder. */
export function Mosaic({ pandaIds, size }: { pandaIds: string[]; size: number }) {
  const half = (size - SEAM) / 2;
  return (
    <View
      className="overflow-hidden rounded-tile bg-secondary"
      style={{ width: size, height: size, borderCurve: "continuous" }}
    >
      {pandaIds.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Icon icon={FolderHeart} size="title3" tone="secondary" />
        </View>
      ) : pandaIds.length < 4 ? (
        <Cover pandaId={pandaIds[0] ?? ""} size={size} />
      ) : (
        <View className="flex-row flex-wrap bg-card" style={{ gap: SEAM }}>
          {pandaIds.slice(0, 4).map((id) => (
            <Cover key={id} pandaId={id} size={half} />
          ))}
        </View>
      )}
      {pandaIds.length > 0 ? <PhotoOutline radius={RADIUS.tile} /> : null}
    </View>
  );
}
