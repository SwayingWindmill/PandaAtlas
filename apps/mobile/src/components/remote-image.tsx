import { Image, type ImageProps } from "expo-image";
import { type ReactNode, useState } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

const FADE_MS = 200;

/** Starts a photo's download into the memory and disk cache, so a screen about to show it finds it there. */
export function prefetchImage(url: string | null | undefined): void {
  if (url) void Image.prefetch(url, "memory-disk").catch(() => false);
}

/**
 * A remote photo: kept in memory and on disk, faded in briefly (not at all under reduced motion), and
 * replaced by `fallback` in the same box when there is no source or it fails to load. Without a fallback the
 * box stays empty, so the placeholder fill of whatever holds the photo shows.
 */
export function RemoteImage({
  source,
  fallback,
  transition = FADE_MS,
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
