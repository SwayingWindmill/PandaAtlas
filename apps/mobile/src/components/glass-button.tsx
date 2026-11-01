import { Platform, Pressable } from "react-native";

import { Icon } from "@/components/icon";
import type { LucideIcon } from "@/components/icons";
import { component } from "@/design/tokens";
import { useIOSColors } from "@/lib/theme";

const SIZE = component.glassButton.size;

/**
 * A circular button that floats over a photo where there is no glass system bar (Android, web, iOS before 26):
 * a dark translucent disc, with a CSS blur on web, so the white glyph stays legible on any
 * picture. iOS 26+ uses the system bar instead (see HeroHeader), which draws Liquid Glass.
 */
export function GlassButton({ icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const { glassFallback } = useIOSColors();
  return (
    <Pressable
      onPress={onPress}
      role="button"
      accessibilityLabel={label}
      hitSlop={4}
      className="items-center justify-center active:opacity-70"
      style={[
        {
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          overflow: "hidden",
          backgroundColor: glassFallback,
        },
        Platform.OS === "web" ? ({ backdropFilter: "blur(20px) saturate(1.6)" } as object) : null,
      ]}
    >
      <Icon icon={icon} size="body" tone="onMedia" strokeWidth={2} />
    </Pressable>
  );
}
