import { useEffect, useMemo } from "react";
import { PanResponder, Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";

import { RemoteImage } from "@/components/remote-image";
import {
  DOUBLE_TAP_ZOOM,
  MIN_ZOOM,
  ZOOM_SETTLE_THRESHOLD,
  clampPan,
  clampZoom,
  touchDistance,
} from "@/features/pandas/photo-zoom";

const SPRING_CFG = { damping: 24, stiffness: 260, mass: 0.9 } as const;

/**
 * Interactive photo viewer cell supporting two-finger pinch zoom, double-tap toggle, and zoomed pan
 * without adding native gesture dependencies.
 */
export function ZoomablePhoto({
  uri,
  width,
  height,
  active,
  zoomed,
  onZoomChange,
  accessibilityLabel,
}: {
  uri: string;
  width: number;
  height: number;
  active: boolean;
  zoomed: boolean;
  onZoomChange: (next: boolean) => void;
  accessibilityLabel: string;
}) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(MIN_ZOOM);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startScale = useSharedValue(MIN_ZOOM);
  const startDist = useSharedValue(0);
  const baseX = useSharedValue(0);
  const baseY = useSharedValue(0);
  const lastTap = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      scale.set(MIN_ZOOM);
      tx.set(0);
      ty.set(0);
    }
  }, [active, scale, tx, ty]);

  useEffect(() => {
    if (!active) return;
    if (!zoomed) {
      tx.set(reducedMotion ? 0 : withSpring(0, SPRING_CFG));
      ty.set(reducedMotion ? 0 : withSpring(0, SPRING_CFG));
      scale.set(reducedMotion ? MIN_ZOOM : withSpring(MIN_ZOOM, SPRING_CFG));
    } else if (scale.get() < ZOOM_SETTLE_THRESHOLD) {
      scale.set(reducedMotion ? DOUBLE_TAP_ZOOM : withSpring(DOUBLE_TAP_ZOOM, SPRING_CFG));
    }
  }, [active, reducedMotion, scale, tx, ty, zoomed]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: (evt) => evt.nativeEvent.touches.length >= 2,
        onMoveShouldSetPanResponder: (evt, gesture) =>
          evt.nativeEvent.touches.length >= 2 ||
          (scale.get() > ZOOM_SETTLE_THRESHOLD && (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4)),
        onPanResponderGrant: (evt) => {
          const touches = evt.nativeEvent.touches;
          baseX.set(tx.get());
          baseY.set(ty.get());
          startScale.set(scale.get());
          if (touches.length >= 2) {
            startDist.set(touchDistance(touches[0]!, touches[1]!));
          } else {
            startDist.set(0);
          }
        },
        onPanResponderMove: (evt, gesture) => {
          const touches = evt.nativeEvent.touches;
          if (touches.length >= 2) {
            const dist = touchDistance(touches[0]!, touches[1]!);
            const initialDist = startDist.get();
            if (initialDist <= 0) {
              startDist.set(dist);
              startScale.set(scale.get());
              return;
            }
            const nextScale = clampZoom(startScale.get() * (dist / initialDist));
            scale.set(nextScale);
            tx.set(clampPan(tx.get(), nextScale, width));
            ty.set(clampPan(ty.get(), nextScale, height));
            return;
          }
          const currentScale = scale.get();
          if (currentScale > ZOOM_SETTLE_THRESHOLD) {
            tx.set(clampPan(baseX.get() + gesture.dx, currentScale, width));
            ty.set(clampPan(baseY.get() + gesture.dy, currentScale, height));
          }
        },
        onPanResponderRelease: () => {
          startDist.set(0);
          if (scale.get() < ZOOM_SETTLE_THRESHOLD) {
            scale.set(reducedMotion ? MIN_ZOOM : withSpring(MIN_ZOOM, SPRING_CFG));
            tx.set(reducedMotion ? 0 : withSpring(0, SPRING_CFG));
            ty.set(reducedMotion ? 0 : withSpring(0, SPRING_CFG));
            onZoomChange(false);
          } else {
            onZoomChange(true);
          }
        },
        onPanResponderTerminate: () => {
          startDist.set(0);
          if (scale.get() < ZOOM_SETTLE_THRESHOLD) {
            scale.set(MIN_ZOOM);
            tx.set(0);
            ty.set(0);
            onZoomChange(false);
          }
        },
      }),
    [baseX, baseY, height, onZoomChange, reducedMotion, scale, startDist, startScale, tx, ty, width],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));

  function handleTap() {
    const now = Date.now();
    if (now - lastTap.get() < 280) {
      lastTap.set(0);
      onZoomChange(!(scale.get() > ZOOM_SETTLE_THRESHOLD));
    } else {
      lastTap.set(now);
    }
  }

  return (
    <View style={{ width, height, overflow: "hidden" }} {...panResponder.panHandlers}>
      <Pressable accessible={false} onPress={handleTap} style={{ width, height }}>
        <Animated.View style={[{ width, height }, animatedStyle]}>
          <RemoteImage
            source={uri}
            style={{ width, height }}
            contentFit="contain"
            accessibilityLabel={accessibilityLabel}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}
