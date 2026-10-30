import { type ReactNode, useState } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";

/** A card the finger presses in: 3% smaller over 120ms on a strong ease-out, back on release. */
const PRESSED = 0.97;

/**
 * Press feedback for a photo card or tile. It is a Reanimated CSS transition between two states,
 * not a shared value, because a press is a two-state toggle. With Reduce Motion on, the card dims
 * a little instead of moving.
 */
export function PressScale({
  children,
  style,
  className,
  containerStyle,
  ...pressable
}: Omit<PressableProps, "style" | "children"> & {
  children: ReactNode;
  /** Style of the card that scales. */
  style?: StyleProp<ViewStyle>;
  className?: string;
  /** Style of the hit area around it: flex, when the card shares a row. */
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      {...pressable}
      onPressIn={(event) => {
        setPressed(true);
        pressable.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        pressable.onPressOut?.(event);
      }}
      pressRetentionOffset={16}
      style={containerStyle}
    >
      <Animated.View
        className={className}
        style={[
          style,
          {
            transform: [{ scale: pressed && !reduced ? PRESSED : 1 }],
            opacity: pressed && reduced ? 0.85 : 1,
            transitionProperty: ["transform", "opacity"],
            transitionDuration: 120,
            transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
