import { isLiquidGlassAvailable } from "expo-glass-effect";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { ActionSheetIOS, Modal, Platform, Pressable, View } from "react-native";
import { useAnimatedReaction, useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { Icon } from "@/components/icon";
import { ChevronLeft, Ellipsis, type LucideIcon, Share } from "@/components/icons";
import { Text } from "@/components/ui/text";
import { component } from "@/design/tokens";
import { selectionHaptic } from "@/lib/haptics";
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
 * Earlier iOS, Android and web: no bar; back, share and 更多 sit on the photo as bare white glyphs.
 */
export interface HeroMenuItem {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
}

export function HeroHeader({
  title,
  pastHero,
  onShare,
  menu,
}: {
  title: string;
  pastHero: boolean;
  onShare?: () => void;
  /** The page's less frequent actions behind a 更多 button, top right, after share. */
  menu?: HeroMenuItem[];
}) {
  const { label } = useIOSColors();
  if (!SYSTEM_BAR) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false, title }} />
        <FloatingToolbar onShare={onShare} menu={menu} />
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
      {menu?.length && onShare ? (
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
      {menu?.length ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu icon="ellipsis" accessibilityLabel="更多">
            {menu.map((item) => (
              <Stack.Toolbar.MenuAction key={item.label} onPress={item.onPress}>
                {item.label}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      ) : onShare ? (
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

const SIZE = component.glassButton.size;
/** A bare glyph over a photo keeps its edge with a soft shadow instead of a disc. */
const GLYPH_SHADOW = { filter: "drop-shadow(0px 1px 3px rgba(0,0,0,0.45))" } as const;

/** A white glyph straight on the photo, with a 44pt hit area. */
function BareButton({ icon, label, onPress, size = 25 }: { icon: LucideIcon; label: string; onPress: () => void; size?: number }) {
  return (
    <Pressable
      role="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      className="items-center justify-center active:opacity-60"
      style={{ width: SIZE, height: SIZE }}
    >
      <View style={GLYPH_SHADOW}>
        <Icon icon={icon} size={size} tone="onMedia" strokeWidth={2.4} />
      </View>
    </Pressable>
  );
}

/** Back, share and 更多 over the photo where there is no system bar, fixed while the page scrolls. */
function FloatingToolbar({ onShare, menu }: { onShare?: () => void; menu?: HeroMenuItem[] }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const top = insets.top + 6;
  function more() {
    if (!menu?.length) return;
    selectionHaptic();
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...menu.map((item) => item.label), "取消"], cancelButtonIndex: menu.length },
        (index) => menu[index]?.onPress(),
      );
      return;
    }
    setOpen(true);
  }
  return (
    <View
      pointerEvents="box-none"
      className="absolute right-0 left-0 flex-row justify-between px-4"
      // Rendered before the page so a screen reader reads 返回 first; zIndex keeps it over the scrolling content.
      style={{ top, zIndex: 1 }}
    >
      <BareButton icon={ChevronLeft} label="返回" onPress={goBack} size={28} />
      <View className="flex-row items-center">
        {onShare ? <BareButton icon={Share} label="分享" onPress={onShare} size={23} /> : null}
        {menu?.length ? <BareButton icon={Ellipsis} label="更多" onPress={more} /> : null}
      </View>
      {menu?.length ? (
        <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable className="flex-1" accessibilityLabel="关闭" onPress={() => setOpen(false)}>
            <View
              role="menu"
              className="absolute right-4 min-w-48 overflow-hidden rounded-group bg-card shadow-lg"
              style={{ top: top + SIZE + 8, borderCurve: "continuous" }}
            >
              {menu.map((item) => (
                <Pressable
                  key={item.label}
                  role="menuitem"
                  accessibilityLabel={item.label}
                  onPress={() => {
                    setOpen(false);
                    item.onPress();
                  }}
                  className="min-h-11 flex-row items-center gap-3 px-4 py-3 active:bg-accent"
                >
                  <Icon icon={item.icon} tone="label" />
                  <Text variant="body">{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}
