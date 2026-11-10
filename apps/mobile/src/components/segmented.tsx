import { useState } from "react";
import { type LayoutChangeEvent, Pressable, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";

import { Text } from "@/components/ui/text";
import { component, semantic } from "@/design/tokens";
import { cssEasing } from "@/design/motion";
import { selectionHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const { height, padding, hit } = component.segmented;
/** A segment's label padding inside the thumb. */
const SEGMENT_PAD_Y = 6;
/** How far each segment's hit area reaches past the track, so it is 44pt tall. */
const REACH = (hit - height) / 2;

/**
 * A pill segmented control: a filled pill track with the selected segment raised as a page-coloured
 * pill with a soft shadow. The thumb slides between segments on the `move` curve; with Reduce Motion it jumps.
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
      className="flex-row rounded-pill bg-secondary"
      // minHeight, not height: at large text a label wraps and the track grows with it.
      style={{ minHeight: height, padding }}
    >
      {segment > 0 ? (
        <Animated.View
          className="absolute rounded-pill bg-background shadow-md"
          style={{
            top: padding,
            left: padding,
            bottom: padding,
            width: segment,
            transform: [{ translateX: index * segment }],
            transitionProperty: "transform",
            transitionDuration: reduced ? 0 : semantic.motion.move.duration,
            transitionTimingFunction: cssEasing("inOut"),
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
            className="flex-1 items-center justify-center px-1"
            // Each segment's hit area reaches past the track to 44pt.
            style={{ marginVertical: -padding - REACH, paddingVertical: SEGMENT_PAD_Y + padding + REACH - 2 }}
          >
            <Text
              variant="subheadline"
              className={cn("text-center font-medium", selected && "font-semibold")}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
