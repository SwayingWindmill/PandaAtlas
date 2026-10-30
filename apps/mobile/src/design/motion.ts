import { Easing, Keyframe, ReduceMotion } from "react-native-reanimated";

import { cubicBezierCss, primitive, semantic, component } from "@/design/tokens";

const bezier = (name: keyof typeof primitive.easing) => {
  const [x1, y1, x2, y2] = primitive.easing[name];
  return Easing.bezier(x1, y1, x2, y2);
};

/** Strong ease-out: fast start, gentle settle. UI motion never eases in. */
export const EASE_OUT = bezier("out");

/** 竹 bamboo, the signature curve: bends ~3% past its mark and settles. Transforms only. */
export const EASE_BAMBOO = bezier("bamboo");

/** The bamboo spring for `withSpring`, when the motion is driven by a gesture or a shared value. */
export const SPRING_BAMBOO = { ...primitive.spring.bamboo, reduceMotion: ReduceMotion.System } as const;

/** Press feedback as a Reanimated CSS transition. */
export const PRESS = {
  scale: component.press.scale,
  reducedOpacity: component.press.reducedOpacity,
  duration: semantic.motion.press.duration,
  timing: cubicBezierCss("out"),
} as const;

/**
 * How a page's content arrives once its data is in: it fades in and rises 8pt on the bamboo curve,
 * so the column settles into place over the skeleton instead of snapping. Opacity overshoot clamps
 * at 1, so only the rise bends. Reanimated skips it when Reduce Motion is on.
 */
export const CONTENT_ENTER = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: component.enter.rise }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: EASE_BAMBOO },
})
  .duration(semantic.motion.enter.duration)
  .reduceMotion(ReduceMotion.System);
