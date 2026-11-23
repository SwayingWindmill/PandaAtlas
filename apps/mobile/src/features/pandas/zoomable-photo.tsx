import { Image } from "expo-image";
import { memo, useEffect } from "react";
import { Platform, View } from "react-native";
import {
  GestureDetector,
  GestureStateManager,
  type NativeGesture,
  type PanGestureConfig,
  type PinchGestureConfig,
  State,
  type TapGestureConfig,
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
  useDerivedValue,
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
  restingScale,
  rubberBand,
} from "@/features/pandas/photo-viewer";

const SETTLE = { duration: 400, dampingRatio: 1, reduceMotion: ReduceMotion.System } as const;
const SNAP_BACK = { duration: 400, dampingRatio: 0.8, reduceMotion: ReduceMotion.System } as const;
const DISMISS_DISTANCE = 0.18;
const DISMISS_VELOCITY = 900;
/** Fingers move this far before a drag starts, so a tap stays a tap. */
const SLOP = 12;
/** An offset range so wide it never trips: the pan neither fails nor activates on that axis. */
const ANY = 100_000;
/** Shorter than the 500 ms default, so a single tap toggles the chrome sooner. */
const DOUBLE_TAP_DELAY = 250;

/**
 * The pager waits for this page's pan to fail before it scrolls. At rest only a downward drag is the
 * page's: sideways or upward travel fails the pan and hands the touch to the pager. Zoomed, any drag
 * pans and nothing fails it, so the pager cannot start.
 */
const PAN_BOUNDS = {
  rest: { activeX: [-ANY, ANY], activeY: [-ANY, SLOP], failX: [-SLOP, SLOP], failY: [-SLOP, ANY], pointers: 1 },
  zoomed: { activeX: [-SLOP, SLOP], activeY: [-SLOP, SLOP], failX: [-ANY, ANY], failY: [-ANY, ANY], pointers: 2 },
} as const;

type Drag = "idle" | "pinch" | "pan" | "dismiss";
type Range = keyof Omit<(typeof PAN_BOUNDS)["rest"], "pointers">;

const boundsFor = (scale: number) => {
  "worklet";
  return PAN_BOUNDS[scale > ZOOM.zoomed ? "zoomed" : "rest"];
};

// The bounds follow the scale on the UI thread, so the pager locks the frame a zoom starts.
function useRange(scale: SharedValue<number>, range: Range): [SharedValue<number>, SharedValue<number>] {
  const from = useDerivedValue<number>(() => boundsFor(scale.get())[range][0]);
  const to = useDerivedValue<number>(() => boundsFor(scale.get())[range][1]);
  return [from, to];
}

export const ZoomablePhoto = memo(function ZoomablePhoto({
  id,
  uri,
  label,
  size,
  active,
  zoomed,
  pager,
  dismissY,
  onZoomedChange,
  onTap,
  onDismiss,
}: {
  id: string;
  uri: string;
  label: string;
  size: Size;
  active: boolean;
  zoomed: boolean;
  /** The pager's native scroll gesture, which must wait for this page's pinch and pan. Null on web. */
  pager: NativeGesture | null;
  /** The viewer's drag-to-dismiss offset, shared so the background fades with it. */
  dismissY: SharedValue<number>;
  onZoomedChange: (id: string, zoomed: boolean) => void;
  onTap: () => void;
  onDismiss: () => void;
}) {
  const scale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const image = useSharedValue<Size | null>(null);
  const drag = useSharedValue<Drag>("idle");
  const start = useSharedValue({ scale: 1, x: 0, y: 0, lift: 0, focal: { x: 0, y: 0 } });
  const focal = useSharedValue<Point>({ x: 0, y: 0 });
  const touchStart = useSharedValue<Point>({ x: 0, y: 0 });
  const blocksPager = pager ?? undefined;
  // gesture-handler's web handlers drop the detector's touchAction each time a gesture's config is
  // applied and fall back to "none", which stops a phone browser paging the list, so every gesture
  // carries its own. The field is missing from the config types, hence the casts.
  const touchAction = Platform.OS === "web" ? (zoomed ? "none" : "pan-x") : undefined;

  const activeX = useRange(scale, "activeX");
  const activeY = useRange(scale, "activeY");
  const failX = useRange(scale, "failX");
  const failY = useRange(scale, "failY");
  const maxPointers = useDerivedValue<number>(() => boundsFor(scale.get()).pointers);

  useEffect(() => {
    if (active) return;
    scale.set(1);
    x.set(0);
    y.set(0);
  }, [active, scale, x, y]);

  useAnimatedReaction(
    () => scale.get() > ZOOM.zoomed,
    (now, before) => {
      if (before !== null && now !== before) scheduleOnRN(onZoomedChange, id, now);
    },
  );

  const fromCentre = (px: number, py: number): Point => {
    "worklet";
    return { x: px - size.width / 2, y: py - size.height / 2 };
  };

  const settle = () => {
    "worklet";
    const target = restingScale(scale.get());
    const anchored = anchoredTranslation(focal.get(), focal.get(), scale.get(), { x: x.get(), y: y.get() }, target);
    const limit = panLimit(target, size, fittedSize(size, image.get()));
    scale.set(withSpring(target, SETTLE));
    x.set(withSpring(clamp(anchored.x, -limit.x, limit.x), SETTLE));
    y.set(withSpring(clamp(anchored.y, -limit.y, limit.y), SETTLE));
  };

  const pinch = usePinchGesture({
    block: blocksPager,
    touchAction,
    onTouchesDown: (event) => {
      "worklet";
      const touch = event.allTouches[0];
      if (event.numberOfTouches === 1 && touch) touchStart.set({ x: touch.absoluteX, y: touch.absoluteY });
    },
    // One finger never fails a pinch on its own, and the pager waits for it, so a one-finger swipe at
    // rest fails it here once it travels past the slop.
    onTouchesMove: (event) => {
      "worklet";
      const touch = event.allTouches[0];
      if (!touch || event.numberOfTouches !== 1 || event.state === State.ACTIVE || scale.get() > ZOOM.zoomed) return;
      const from = touchStart.get();
      if (Math.hypot(touch.absoluteX - from.x, touch.absoluteY - from.y) > SLOP) GestureStateManager.fail(event.handlerTag);
    },
    onActivate: (event) => {
      "worklet";
      const point = fromCentre(event.focalX, event.focalY);
      if (drag.get() === "dismiss") dismissY.set(withSpring(0, SNAP_BACK));
      drag.set("pinch");
      start.set({ scale: scale.get(), x: x.get(), y: y.get(), lift: 0, focal: point });
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
  } as PinchGestureConfig);

  const pan = usePanGesture({
    block: blocksPager,
    touchAction,
    activeOffsetX: activeX,
    activeOffsetY: activeY,
    failOffsetX: failX,
    failOffsetY: failY,
    maxPointers,
    onActivate: (event) => {
      "worklet";
      if (drag.get() === "pinch") return;
      drag.set(scale.get() > ZOOM.zoomed ? "pan" : "dismiss");
      // A drag that catches the dismiss spring mid-flight carries the photo on from where it is.
      start.set({ scale: scale.get(), x: x.get(), y: y.get(), lift: dismissY.get() - event.translationY, focal: focal.get() });
    },
    onUpdate: (event) => {
      "worklet";
      const mode = drag.get();
      const from = start.get();
      if (mode === "dismiss") {
        dismissY.set(Math.max(0, from.lift + event.translationY));
        return;
      }
      if (mode !== "pan") return;
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
  } as PanGestureConfig);

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    maxDelay: DOUBLE_TAP_DELAY,
    touchAction,
    onActivate: (event) => {
      "worklet";
      if (scale.get() > ZOOM.zoomed) {
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
  } as TapGestureConfig);

  const singleTap = useTapGesture({
    touchAction,
    onActivate: () => {
      "worklet";
      scheduleOnRN(onTap);
    },
  } as TapGestureConfig);

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
    <GestureDetector gesture={gesture}>
      {/* Gestures report focal points in the detector child's own frame, so that child stays untransformed. */}
      <View style={{ width: size.width, height: size.height }}>
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
      </View>
    </GestureDetector>
  );
});
