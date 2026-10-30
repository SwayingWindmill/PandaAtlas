import { Image } from "expo-image";
import { Link, router } from "expo-router";
import type { ReactNode } from "react";
import { Platform, Pressable, View } from "react-native";
import Animated, {
  Extrapolation,
  type SharedValue,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { GlassButton } from "@/components/glass-button";
import { ChevronLeft, Share } from "@/components/icons";

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

/** The top bar over a hero photo: Liquid Glass back and share, fixed while the page scrolls. */
export function HeroToolbar({ onShare }: { onShare?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      className="absolute right-0 left-0 flex-row justify-between px-4"
      style={{ top: insets.top + 6 }}
    >
      <GlassButton icon={ChevronLeft} label="返回" onPress={goBack} />
      {onShare ? <GlassButton icon={Share} label="分享" onPress={onShare} /> : null}
    </View>
  );
}

/**
 * A full-bleed photograph under the status bar that stretches from its bottom edge on pull-down and
 * drifts a little slower than the page on scroll, as Music and App Store heroes do. On iOS 18+ it
 * is the target a tapped tile zooms into. `overlay` is drawn on the photo (an institution's name).
 */
export function StretchyHero({
  url,
  height: base,
  scrollY,
  onPress,
  label,
  overlay,
}: {
  url: string;
  height: number;
  scrollY: SharedValue<number>;
  onPress?: () => void;
  label: string;
  overlay?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const muted = String(useCSSVariable("--color-muted"));
  const height = base + insets.top;
  const stretch = useAnimatedStyle(() => {
    const y = scrollY.get();
    return {
      transform: [
        { translateY: interpolate(y, [-height, 0, height], [-height / 2, 0, height * 0.35], Extrapolation.CLAMP) },
        { scale: interpolate(y, [-height, 0], [2, 1], Extrapolation.CLAMP) },
      ],
    };
  });
  const photo = <Image source={url} style={{ flex: 1 }} contentFit="cover" accessible={false} transition={200} />;
  return (
    <View style={{ height, overflow: Platform.OS === "web" ? "hidden" : "visible" }}>
      <Animated.View style={[{ height, backgroundColor: muted }, stretch]}>
        <Link.AppleZoomTarget>
          {onPress ? (
            <Pressable onPress={onPress} role="button" accessibilityLabel={label} style={{ flex: 1 }}>
              {photo}
            </Pressable>
          ) : (
            <View style={{ flex: 1 }} accessibilityLabel={label}>
              {photo}
            </View>
          )}
        </Link.AppleZoomTarget>
      </Animated.View>
      {overlay}
    </View>
  );
}
