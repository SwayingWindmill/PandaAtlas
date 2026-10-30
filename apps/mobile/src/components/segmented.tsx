import { useState } from "react";
import { type LayoutChangeEvent, Pressable, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";

import { Text } from "@/components/ui/text";
import { cubicBezierCss, component, concentric, semantic } from "@/design/tokens";
import { selectionHaptic } from "@/lib/haptics";

const { height, padding } = component.segmented;
const TRACK_RADIUS = semantic.radius.control.value;
const THUMB_RADIUS = concentric(TRACK_RADIUS, padding);

/**
 * The iOS segmented control: a filled track with the selected segment raised on the elevated
 * surface. The thumb slides between segments on the `move` curve; with Reduce Motion it jumps.
 * Each segment is a radio, so VoiceOver and the web read the choice as one group.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  accessibilityLabel,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  accessibilityLabel: string;
}) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const segment = width > 0 ? (width - padding * 2) / options.length : 0;
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  return (
    <View
      role="radiogroup"
      accessibilityLabel={accessibilityLabel}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      className="flex-row bg-secondary"
      style={{ height, padding, borderRadius: TRACK_RADIUS, borderCurve: "continuous" }}
    >
      {segment > 0 ? (
        <Animated.View
          className="absolute bg-card shadow-sm dark:bg-accent"
          style={{
            top: padding,
            left: padding,
            bottom: padding,
            width: segment,
            borderRadius: THUMB_RADIUS,
            borderCurve: "continuous",
            transform: [{ translateX: index * segment }],
            transitionProperty: "transform",
            transitionDuration: reduced ? 0 : semantic.motion.move.duration,
            transitionTimingFunction: cubicBezierCss("inOut"),
          }}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            role="radio"
            aria-checked={selected}
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => {
              if (selected) return;
              selectionHaptic();
              onChange(option.value);
            }}
            className="flex-1 items-center justify-center"
          >
            <Text variant="subheadline" className={selected ? "font-semibold" : "text-muted-foreground"}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
