import { useCallback, useEffect, useRef, useState } from "react";
import {
  type GestureResponderEvent,
  PanResponder,
  Platform,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import {
  type Camera,
  type Point,
  type Viewport,
  between,
  panBy,
  zoomAt,
} from "./camera";

const FLIGHT_MS = 450;

type Touches = GestureResponderEvent["nativeEvent"]["touches"];

/** The midpoint of the fingers and, with two, how far apart they are. */
function fingers(touches: Touches): { centre: Point; spread: number | null } {
  const [a, b] = touches;
  if (a && b) {
    return {
      centre: { x: (a.pageX + b.pageX) / 2, y: (a.pageY + b.pageY) / 2 },
      spread: Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY),
    };
  }
  return { centre: { x: a?.pageX ?? 0, y: a?.pageY ?? 0 }, spread: null };
}

/**
 * The camera of a full-screen map: one finger drags it, two pinch it about their midpoint, a mouse
 * wheel zooms it on the web, and `flyTo` moves it to a place (at once with Reduce Motion on).
 * The map fills the screen from its top-left corner, so page coordinates are map coordinates.
 */
export function useMapCamera(viewport: Viewport | null) {
  const [camera, setCameraState] = useState<Camera | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const viewportRef = useRef(viewport);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);
  const reduced = useReducedMotion();
  const frame = useRef<number | null>(null);
  const last = useRef<{
    centre: Point;
    spread: number | null;
    count: number;
  } | null>(null);

  const setCamera = useCallback((next: Camera) => {
    cameraRef.current = next;
    setCameraState(next);
  }, []);

  const stopFlight = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  useEffect(() => stopFlight, [stopFlight]);

  const flyTo = useCallback(
    (target: Camera) => {
      stopFlight();
      const from = cameraRef.current;
      if (!from || reduced) {
        setCamera(target);
        return;
      }
      const start = Date.now();
      const step = () => {
        const t = Math.min(1, (Date.now() - start) / FLIGHT_MS);
        setCamera(between(from, target, t));
        frame.current = t < 1 ? requestAnimationFrame(step) : null;
      };
      frame.current = requestAnimationFrame(step);
    },
    [reduced, setCamera, stopFlight],
  );

  // One responder for the screen's life: setCamera and stopFlight never change. Its handlers read
  // the refs when a finger moves, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      // Taps stay with the markers; the map takes over once fingers move or a second one lands.
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        gesture.numberActiveTouches > 1 ||
        Math.abs(gesture.dx) + Math.abs(gesture.dy) > 6,
      onPanResponderGrant: (event) => {
        stopFlight();
        const { centre, spread } = fingers(event.nativeEvent.touches);
        last.current = {
          centre,
          spread,
          count: event.nativeEvent.touches.length,
        };
      },
      onPanResponderMove: (event) => {
        const current = cameraRef.current;
        const view = viewportRef.current;
        if (!current || !view) return;
        const touches = event.nativeEvent.touches;
        const { centre, spread } = fingers(touches);
        const previous = last.current;
        last.current = { centre, spread, count: touches.length };
        // A finger landing or lifting moves the midpoint without the map moving.
        if (!previous || previous.count !== touches.length) return;
        let next = panBy(
          current,
          centre.x - previous.centre.x,
          centre.y - previous.centre.y,
          view,
        );
        if (spread && previous.spread)
          next = zoomAt(next, spread / previous.spread, centre, view);
        setCamera(next);
      },
      onPanResponderRelease: () => {
        last.current = null;
      },
      onPanResponderTerminate: () => {
        last.current = null;
      },
    }),
  );

  const onWheel = useCallback(
    (event: {
      deltaY: number;
      clientX: number;
      clientY: number;
      preventDefault: () => void;
    }) => {
      const current = cameraRef.current;
      const view = viewportRef.current;
      if (!current || !view) return;
      event.preventDefault();
      stopFlight();
      setCamera(
        zoomAt(
          current,
          Math.exp(-event.deltaY / 400),
          { x: event.clientX, y: event.clientY },
          view,
        ),
      );
    },
    [setCamera, stopFlight],
  );

  const handlers =
    Platform.OS === "web"
      ? { ...responder.panHandlers, onWheel }
      : responder.panHandlers;
  return { camera, setCamera, flyTo, handlers };
}
