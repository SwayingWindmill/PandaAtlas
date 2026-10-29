import type { ReactNode } from "react";
import { Platform, Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { useUniwind } from "uniwind";

import { cn } from "@/lib/utils";

/** A lifted surface. Light mode separates it with a soft shadow; dark mode already lifts --color-card. */
export function cardShadow(theme: string | undefined): StyleProp<ViewStyle> {
  const dark = theme === "dark";
  return Platform.select({
    ios: {
      shadowColor: dark ? "#000000" : "#1d211c",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: dark ? 0.35 : 0.08,
      shadowRadius: 18,
    },
    android: { elevation: dark ? 4 : 2 },
    default: {
      boxShadow: dark ? "0 12px 28px rgba(0, 0, 0, 0.35)" : "0 10px 28px rgba(29, 33, 28, 0.08)",
    },
  });
}

export function Card({ className, children }: { className?: string; children?: ReactNode }) {
  const { theme } = useUniwind();
  return (
    <View className={cn("overflow-hidden rounded-xl border-hairline border-border bg-card", className)} style={cardShadow(theme)}>
      {children}
    </View>
  );
}

export function PressableCard({ className, children, ...press }: PressableProps & { className?: string }) {
  const { theme } = useUniwind();
  return (
    <Pressable
      className={cn("overflow-hidden rounded-xl border-hairline border-border bg-card active:opacity-90", className)}
      style={cardShadow(theme)}
      {...press}
    >
      {children}
    </Pressable>
  );
}
