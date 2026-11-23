import { Image } from "expo-image";
import { useEffect } from "react";
import {
  GestureDetector,
  useCompetingGestures,
  useExclusiveGestures,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from "react-native-gesture-handler";
import Animated, {
  ReduceMotion,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import {
  type Point,
  type Size,
  ZOOM,
  anchoredTranslation,
  clamp,
  doubleTapTarget,
  fittedSize,
  panLimit,
  rubberBand,
} from "@/features/pandas/photo-viewer";

const SETTLE = { duration: 400, dampingRatio: 1, reduceMotion: ReduceMotion.System } as const;
const SNAP_BACK = { duration: 400, dampingRatio: 0.8, reduceMotion: ReduceMotion.System } as const;
/** Below this the photo counts as unzoomed: paging and drag-to-dismiss come back. */
const ZOOMED = 1.01;
const DISMISS_DISTANCE = 0.18;
const DISMISS_VELOCITY = 900;
/** Fingers move this far before a drag starts, so a tap stays a tap. */
const SLOP = 12;
/** An offset range so wide it never trips: the pan neither fails nor activates on that axis. */
const ANY = 100_000;

type Drag = "idle" | "pinch" | "pan" | "dismiss";

/**
 * One page of the viewer. Pinch zooms around the fingers between 1x and 4x and stretches past them;
 * a drag pans the zoomed photo inside its edges; a double tap zooms to 2.5x at the tap and back; a
 * single tap toggles the viewer's chrome; at 1x a downward drag carries the photo and dismisses.
 */
export function ZoomablePhoto({
  uri,
  label,
  size,
  active,
  zoomed,
  dismissY,
  onZoomedChange,
  onTap,
  onDismiss,
}: {
  uri: string;
  label: string;
  size: Size;
  /** The page on screen. Every other page rests at 1x. */
  active: boolean;
  zoomed: boolean;
  /** The viewer's drag-to-dismiss offset, shared so the background fades with it. */
  dismissY: SharedValue<number>;
  onZoomedChange: (zoomed: boolean) => void;
  onTap: () => void;
  onDismiss: () => void;
}) {
  const scale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const image = useSharedValue<Size | null>(null);
  const drag = useSharedValue<Drag>("idle");
  const start = useSharedValue({ scale: 1, x: 0, y: 0, focal: { x: 0, y: 0 } });
  const focal = useSharedValue<Point>({ x: 0, y: 0 });

  useEffect(() => {
    if (active) return;
    scale.set(1);
    x.set(0);
    y.set(0);
  }, [active, scale, x, y]);

  useAnimatedReaction(
    () => scale.get() > ZOOMED,
    (now, before) => {
      if (before !== null && now !== before) scheduleOnRN(onZoomedChange, now);
    },
  );

  const fromCentre = (px: number, py: number): Point => {
    "worklet";
    return { x: px - size.width / 2, y: py - size.height / 2 };
  };

  const settle = () => {
    "worklet";
    const target = clamp(scale.get(), ZOOM.min, ZOOM.max);
    // Back inside the bounds around the same point the fingers last held.
    const anchored = anchoredTranslation(focal.get(), focal.get(), scale.get(), { x: x.get(), y: y.get() }, target);
    const limit = panLimit(target, size, fittedSize(size, image.get()));
    scale.set(withSpring(target, SETTLE));
    x.set(withSpring(clamp(anchored.x, -limit.x, limit.x), SETTLE));
    y.set(withSpring(clamp(anchored.y, -limit.y, limit.y), SETTLE));
  };

  const pinch = usePinchGesture({
    onActivate: (event) => {
      "worklet";
      const point = fromCentre(event.focalX, event.focalY);
      if (drag.get() === "dismiss") dismissY.set(withSpring(0, SNAP_BACK));
      drag.set("pinch");
      start.set({ scale: scale.get(), x: x.get(), y: y.get(), focal: point });
      focal.set(point);
    },
    onUpdate: (event) => {
      "worklet";
      const from = start.get();
      const next = rubberBand(from.scale * event.scale, ZOOM.min, ZOOM.max, 1);
      const point = fromCentre(event.focalX, event.focalY);
      const moved = anchoredTranslation(point, from.focal, from.scale, from, next);
      focal.set(point);
      scale.set(next);
      x.set(moved.x);
      y.set(moved.y);
    },
    onDeactivate: () => {
      "worklet";
      drag.set("idle");
      settle();
    },
  });

  const pan = usePanGesture({
    // At 1x only a downward drag is this page's: a sideways one fails so the pager takes it.
    activeOffsetX: zoomed ? [-SLOP, SLOP] : [-ANY, ANY],
    activeOffsetY: zoomed ? [-SLOP, SLOP] : [-ANY, SLOP],
    failOffsetX: zoomed ? [-ANY, ANY] : [-SLOP, SLOP],
    failOffsetY: zoomed ? [-ANY, ANY] : [-SLOP, ANY],
    maxPointers: zoomed ? 2 : 1,
    onActivate: () => {
      "worklet";
      if (drag.get() === "pinch") return;
      drag.set(scale.get() > ZOOMED ? "pan" : "dismiss");
      start.set({ scale: scale.get(), x: x.get(), y: y.get(), focal: focal.get() });
    },
    onUpdate: (event) => {
      "worklet";
      const mode = drag.get();
      if (mode === "dismiss") {
        dismissY.set(Math.max(0, event.translationY));
        return;
      }
      if (mode !== "pan") return;
      const from = start.get();
      const limit = panLimit(scale.get(), size, fittedSize(size, image.get()));
      x.set(rubberBand(from.x + event.translationX, -limit.x, limit.x, size.width));
      y.set(rubberBand(from.y + event.translationY, -limit.y, limit.y, size.height));
    },
    onDeactivate: (event) => {
      "worklet";
      const mode = drag.get();
      if (mode === "dismiss") {
        drag.set("idle");
        const far = dismissY.get() > size.height * DISMISS_DISTANCE;
        if (far || event.velocityY > DISMISS_VELOCITY) scheduleOnRN(onDismiss);
        else dismissY.set(withSpring(0, { ...SNAP_BACK, velocity: event.velocityY }));
        return;
      }
      if (mode !== "pan") return;
      drag.set("idle");
      const limit = panLimit(scale.get(), size, fittedSize(size, image.get()));
      const decay = { rubberBandEffect: true, reduceMotion: ReduceMotion.System } as const;
      x.set(withDecay({ ...decay, velocity: event.velocityX, clamp: [-limit.x, limit.x] }));
      y.set(withDecay({ ...decay, velocity: event.velocityY, clamp: [-limit.y, limit.y] }));
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onActivate: (event) => {
      "worklet";
      if (scale.get() > ZOOMED) {
        scale.set(withSpring(1, SETTLE));
        x.set(withSpring(0, SETTLE));
        y.set(withSpring(0, SETTLE));
        return;
      }
      const target = doubleTapTarget(fromCentre(event.x, event.y), size, fittedSize(size, image.get()));
      scale.set(withSpring(target.scale, SETTLE));
      x.set(withSpring(target.x, SETTLE));
      y.set(withSpring(target.y, SETTLE));
    },
  });

  const singleTap = useTapGesture({
    onActivate: () => {
      "worklet";
      scheduleOnRN(onTap);
    },
  });

  const gesture = useCompetingGestures(
    useSimultaneousGestures(pinch, pan),
    useExclusiveGestures(doubleTap, singleTap),
  );

  const style = useAnimatedStyle(() => {
    const lift = active ? dismissY.get() : 0;
    const shrink = 1 - Math.min(lift / size.height, 1) * 0.25;
    return {
      transform: [{ translateX: x.get() }, { translateY: y.get() + lift }, { scale: scale.get() * shrink }],
    };
  });

  return (
    <GestureDetector gesture={gesture} touchAction={zoomed ? "none" : "pan-x"}>
      <Animated.View style={[{ width: size.width, height: size.height }, style]}>
        <Image
          source={uri}
          // On web a mouse drag on an <img> starts the browser's image drag, which cancels the pan.
          style={{ width: size.width, height: size.height, pointerEvents: "none" }}
          contentFit="contain"
          accessibilityLabel={label}
          onLoad={(event) => image.set({ width: event.source.width, height: event.source.height })}
        />
      </Animated.View>
    </GestureDetector>
  );
}
