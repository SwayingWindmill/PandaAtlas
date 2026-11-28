import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from "expo-router/js-tabs";
import { use } from "react";
import { Pressable, Text, View } from "react-native";

import { component } from "@/design/tokens";
import { HAIRLINE } from "@/lib/surface";
import { useIOSColors } from "@/lib/theme";

const BAR = component.capsuleBar;

/**
 * Android's tab bar: a capsule floating over the page, nearly opaque (`capsuleMaterial`), with the
 * selected tab's glyph in a tinted pill. There is no blur, so it costs nothing to draw. It
 * reports its full height, gap and navigation bar included, so a page under it can leave room
 * (`useBottomClearance`).
 */
export function CapsuleTabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const colors = useIOSColors();
  const onHeightChange = use(BottomTabBarHeightCallbackContext);
  return (
    <View
      pointerEvents="box-none"
      onLayout={(event) => onHeightChange?.(event.nativeEvent.layout.height)}
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: BAR.inset, paddingBottom: insets.bottom + BAR.gap }}
    >
      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: "row",
          height: BAR.height,
          borderRadius: BAR.height / 2,
          borderWidth: HAIRLINE,
          borderColor: colors.separator,
          backgroundColor: colors.capsuleMaterial,
          boxShadow: BAR.shadow,
        }}
      >
        {state.routes.map((route, index) => {
          const options = descriptors[route.key]?.options ?? {};
          const label = typeof options.title === "string" ? options.title : route.name;
          const selected = state.index === index;
          const color = selected ? colors.tint : colors.secondaryLabel;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              android_ripple={{ color: colors.pressed, borderless: true, radius: BAR.height / 2 }}
              onPress={() => {
                const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!selected && !event.defaultPrevented) navigateToTab(route.key);
              }}
              onLongPress={() => emitter.emit({ type: "tabLongPress", target: route.key })}
              style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: BAR.labelGap }}
            >
              <View
                style={{
                  width: BAR.pill.width,
                  height: BAR.pill.height,
                  borderRadius: BAR.pill.height / 2,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: selected ? colors.highlightSoft : "transparent",
                }}
              >
                {options.tabBarIcon?.({ focused: selected, color, size: component.tabBar.icon })}
              </View>
              <Text
                numberOfLines={1}
                style={{ color, fontSize: BAR.label, lineHeight: BAR.labelLine, fontWeight: selected ? "600" : "500" }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
