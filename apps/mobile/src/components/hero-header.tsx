import { isLiquidGlassAvailable } from "expo-glass-effect";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { Platform, View } from "react-native";
import { useAnimatedReaction, useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { GlassButton } from "@/components/glass-button";
import { ChevronLeft, Share } from "@/components/icons";
import { NATIVE_SYMBOLS, nanoSymbol } from "@/lib/native-symbols";
import { useIOSColors } from "@/lib/theme";

/**
 * Lucide `share` and `chevron-left`, because the system bar takes images, not components: custom SF
 * Symbols in a native build (`lib/native-symbols.ts`), template PNGs in Expo Go. Regenerate both with
 * `node scripts/tab-icons.mjs`.
 */
const TOOLBAR_ICON = {
  share: require("../../assets/toolbar-icons/share.png"),
  back: require("../../assets/toolbar-icons/back.png"),
};

/**
 * Where iOS draws Liquid Glass (iOS 26 and later), back and share go in the system bar, which puts
 * each in a glass button that stays legible over any photo. Before iOS 26 a transparent bar has no
 * material, so a dark glyph would sit straight on the photo; there, as on Android and web, the
 * buttons float on their own discs.
 */
export const SYSTEM_BAR = Platform.OS === "ios" && isLiquidGlassAvailable();

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

/**
 * Scroll state for a page that opens on a full-bleed photo. `scrollY` drives the photo's stretch;
 * `pastHero` turns true once the page has scrolled `heroHeight` points, which is when the page's
 * own title has gone under the bar. The scroll is read on the UI thread; React only hears the
 * two crossings, not every frame.
 */
export function useHeroScroll(heroHeight: number) {
  const scrollY = useSharedValue(0);
  const [pastHero, setPastHero] = useState(false);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });
  useAnimatedReaction(
    () => scrollY.get() > heroHeight,
    (past, before) => {
      if (past !== before) scheduleOnRN(setPastHero, past);
    },
    [heroHeight],
  );
  return { scrollY, onScroll, pastHero };
}

/** The custom SF Symbol for a toolbar button in a native build; nothing in Expo Go, which uses `icon`. */
function nativeGlyph(name: "back" | "share") {
  if (!NATIVE_SYMBOLS) return null;
  return <Stack.Toolbar.Icon xcasset={nanoSymbol(name).xcasset} renderingMode="template" />;
}

/**
 * The bar over a hero photo.
 *
 * iOS 26+: the system bar, transparent over the photo, with the system back button and a share
 * button in Liquid Glass. The title appears in the bar once the page's own title has
 * scrolled under it, and the system scroll-edge effect keeps it legible over the page.
 * A page opened straight from a link has no back button, so it gets one that goes to 今天.
 *
 * Earlier iOS, Android and web: no bar; back and share float over the photo as translucent discs.
 */
export function HeroHeader({ title, pastHero, onShare }: { title: string; pastHero: boolean; onShare?: () => void }) {
  const { label } = useIOSColors();
  if (!SYSTEM_BAR) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false, title }} />
        <FloatingToolbar onShare={onShare} />
      </>
    );
  }
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerLargeTitleEnabled: false,
          // Label, not tint: over a photo the tint glyph loses contrast; the bar stays neutral.
          headerTintColor: label,
          title,
          headerTitle: pastHero ? title : "",
        }}
      />
      {router.canGoBack() ? null : (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            icon={NATIVE_SYMBOLS ? undefined : TOOLBAR_ICON.back}
            iconRenderingMode="template"
            accessibilityLabel="返回"
            onPress={goBack}
          >
            {nativeGlyph("back")}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      )}
      {onShare ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon={NATIVE_SYMBOLS ? undefined : TOOLBAR_ICON.share}
            iconRenderingMode="template"
            accessibilityLabel="分享"
            onPress={onShare}
          >
            {nativeGlyph("share")}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
    </>
  );
}

/** Back and share over the photo where there is no system bar, fixed while the page scrolls. */
function FloatingToolbar({ onShare }: { onShare?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      className="absolute right-0 left-0 flex-row justify-between px-4"
      // Rendered before the page so a screen reader reads 返回 first; zIndex keeps it over the scrolling content.
      style={{ top: insets.top + 6, zIndex: 1 }}
    >
      <GlassButton icon={ChevronLeft} label="返回" onPress={goBack} />
      {onShare ? <GlassButton icon={Share} label="分享" onPress={onShare} /> : null}
    </View>
  );
}
