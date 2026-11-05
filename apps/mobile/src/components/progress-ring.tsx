import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Text } from "@/components/ui/text";
import { component } from "@/design/tokens";
import { useIOSColors } from "@/lib/theme";

/**
 * A ring that fills clockwise from twelve o'clock, as Fitness draws one: the `fill` track and a
 * `graphic` arc with round caps, the value in rounded figures in the middle. RNR's Progress is a
 * bar; a ring is a react-native-svg composition (sourcing exception in the v2.14 review).
 * Static by design: it states a value, it does not perform one.
 */
export function ProgressRing({
  value,
  label,
  accessibilityLabel,
  size = "regular",
  children,
}: {
  /** 0 to 1. */
  value: number;
  /** What sits in the middle ("7/12"). */
  label?: string;
  accessibilityLabel: string;
  /** "large" leads a page (月度挑战). */
  size?: "regular" | "small" | "large";
  /** Center content in place of `label`, when the value needs more than one style ("3/5"). */
  children?: React.ReactNode;
}) {
  const colors = useIOSColors();
  const ring = component.progressRing;
  const px = size === "small" ? ring.small : size === "large" ? ring.large : ring.size;
  const stroke = size === "small" ? ring.smallStroke : size === "large" ? ring.largeStroke : ring.stroke;
  const r = (px - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(Math.max(value, 0), 1);
  return (
    <View
      accessible
      role="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{ width: px, height: px }}
      className="items-center justify-center"
    >
      <Svg width={px} height={px} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={px / 2} cy={px / 2} r={r} stroke={colors.fill} strokeWidth={stroke} fill="none" />
        {clamped > 0 ? (
          <Circle
            cx={px / 2}
            cy={px / 2}
            r={r}
            stroke={colors.graphic}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - clamped)}
            fill="none"
          />
        ) : null}
      </Svg>
      {children ?? (label ? (
        <Text variant={size === "small" ? "footnote" : "subheadline"} className="font-rounded font-semibold tabular-nums" role="none">
          {label}
        </Text>
      ) : null)}
    </View>
  );
}
