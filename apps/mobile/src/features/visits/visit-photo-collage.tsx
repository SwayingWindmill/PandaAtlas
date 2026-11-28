import { Image } from "expo-image";
import { View } from "react-native";

import { PhotoOutline } from "@/components/photo-outline";
import { RADIUS } from "@/lib/surface";

import { type LocalVisitPhoto, collageLayoutForCount } from "./visit-photos-model";

function PhotoCell({
  photo,
  index,
  height,
  flex = false,
}: {
  photo: LocalVisitPhoto;
  index: number;
  height: number;
  flex?: boolean;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`第 ${index + 1} 张现场实拍`}
      className={flex ? "flex-1 overflow-hidden rounded-control bg-media-placeholder" : "overflow-hidden rounded-control bg-media-placeholder"}
      style={{ height, borderCurve: "continuous" }}
    >
      <Image
        source={{ uri: photo.uri }}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
        transition={0}
        accessible={false}
      />
      <PhotoOutline radius={RADIUS.control} />
    </View>
  );
}

/** Adaptive 1-to-4 local photo collage rendered inside both the diary timeline and exported souvenir ticket. */
export function VisitPhotoCollage({
  photos,
  compact = false,
}: {
  photos: readonly LocalVisitPhoto[];
  compact?: boolean;
}) {
  const shown = photos.slice(0, 4);
  const layout = collageLayoutForCount(shown.length);
  if (layout === "none") return null;

  if (layout === "single") {
    return <PhotoCell photo={shown[0]!} index={0} height={compact ? 156 : 180} />;
  }

  if (layout === "pair") {
    return (
      <View className="flex-row gap-1.5">
        {shown.map((photo, index) => (
          <PhotoCell key={photo.id} photo={photo} index={index} height={compact ? 120 : 136} flex />
        ))}
      </View>
    );
  }

  if (layout === "triple") {
    return (
      <View className="flex-row gap-1.5">
        {shown.map((photo, index) => (
          <PhotoCell key={photo.id} photo={photo} index={index} height={compact ? 96 : 112} flex />
        ))}
      </View>
    );
  }

  const rowHeight = compact ? 88 : 96;
  return (
    <View className="gap-1.5">
      <View className="flex-row gap-1.5">
        <PhotoCell photo={shown[0]!} index={0} height={rowHeight} flex />
        <PhotoCell photo={shown[1]!} index={1} height={rowHeight} flex />
      </View>
      <View className="flex-row gap-1.5">
        <PhotoCell photo={shown[2]!} index={2} height={rowHeight} flex />
        <PhotoCell photo={shown[3]!} index={3} height={rowHeight} flex />
      </View>
    </View>
  );
}
