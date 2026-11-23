import { Image, type ImageProps } from "expo-image";
import { type ReactNode, useState } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

/**
 * A remote photo: kept in memory and on disk, faded in when `transition` says so (never under reduced
 * motion), and replaced by `fallback` in the same box when there is no source or it fails to load. Without a
 * fallback the box stays empty, so the placeholder fill of whatever holds the photo shows.
 */
export function RemoteImage({
  source,
  fallback,
  transition = 0,
  style,
  onError,
  ...props
}: ImageProps & { fallback?: ReactNode }) {
  const reduced = useReducedMotion();
  const [failedSource, setFailedSource] = useState<ImageProps["source"]>(null);
  if (!source || failedSource === source) {
    return fallback ? (
      <View className="items-center justify-center" style={style as StyleProp<ViewStyle>} accessible={false}>
        {fallback}
      </View>
    ) : null;
  }
  return (
    <Image
      {...props}
      source={source}
      style={style}
      cachePolicy="memory-disk"
      transition={reduced ? 0 : transition}
      onError={(event) => {
        setFailedSource(source);
        onError?.(event);
      }}
    />
  );
}
