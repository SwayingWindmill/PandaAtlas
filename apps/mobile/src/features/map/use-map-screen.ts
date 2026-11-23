import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder } from "react-native";
import { useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";

import { institutionListQueryOptions } from "@/features/institutions/institutions";
import { type Camera, type Viewport, fitPoints } from "@/features/map/camera";
import { mapTimelineQueryOptions, mapViewQueryOptions } from "@/features/map/load";
import { MAP_BUTTON_SIZE } from "@/features/map/map-controls";
import {
  type MapFilter,
  filterMapItems,
  mapFilterCounts,
  resolveLiveCamMap,
  venueLiveMeta,
} from "@/features/map/map-filter";
import { pointsOf } from "@/features/map/map-sheets";
import type { MapItem } from "@/features/map/model";
import { openVenue } from "@/features/map/place-list";
import { buildTimeline, eventsInYear, residentsInYear } from "@/features/map/timeline";
import { useMapCamera } from "@/features/map/use-map-camera";
import type { MapMarker, YearView } from "@/features/map/venue-map";
import { WILD_AREAS, type WildArea, venuesNear } from "@/features/map/wild";
import { useBackToClose } from "@/lib/use-back-to-close";

export type SheetSnap = "peek" | "half" | "expanded";

const PLAY_STEP_MS = 700;
const PEEK_CONTENT = 148;

type MapSelection = { kind: "place"; id: string } | { kind: "wild"; id: string } | null;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function useMapScreen(
  insetsTop: number,
  bottomSafeInset: number,
  windowWidth: number,
  windowHeight: number,
) {
  const reducedMotion = useReducedMotion();
  const { data: view, isError: failed, refetch } = useQuery(mapViewQueryOptions());
  const { data: institutions } = useQuery(institutionListQueryOptions());
  const { data: history } = useQuery(mapTimelineQueryOptions());
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const [filter, setFilterState] = useState<MapFilter>("all");
  const [selection, setSelection] = useState<MapSelection>(null);
  const [layers, setLayers] = useState({ wild: true });
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [worldView, setWorldView] = useState(false);

  const top = insetsTop + 8 + MAP_BUTTON_SIZE + 8;
  const peekHeight = Math.round(Math.min(windowHeight * 0.42, PEEK_CONTENT + bottomSafeInset));
  const halfHeight = Math.round(clamp(windowHeight * 0.56, peekHeight + 90, Math.max(peekHeight + 90, windowHeight - top - 88)));
  const expandedHeight = Math.round(Math.max(halfHeight + 60, windowHeight - (insetsTop + 58)));

  const snapHeights = useMemo(
    () => ({ peek: peekHeight, half: halfHeight, expanded: expandedHeight }),
    [expandedHeight, halfHeight, peekHeight],
  );

  const [sheetSnap, setSheetSnap] = useState<SheetSnap>("half");
  const sheetHeight = useSharedValue(halfHeight);
  const dragStartHeight = useSharedValue(halfHeight);

  useEffect(() => {
    const target = snapHeights[sheetSnap];
    sheetHeight.set(reducedMotion ? target : withSpring(target, { damping: 24, stiffness: 260, mass: 0.9 }));
  }, [reducedMotion, sheetHeight, sheetSnap, snapHeights]);

  const viewport = useMemo<Viewport | null>(
    () => (windowWidth && windowHeight ? { width: windowWidth, height: windowHeight, top, bottom: halfHeight } : null),
    [halfHeight, top, windowHeight, windowWidth],
  );
  const { camera, setCamera, flyTo, handlers } = useMapCamera(viewport);

  const liveCamBySlug = useMemo(
    () =>
      resolveLiveCamMap(
        (institutions ?? []).map((inst) => ({
          slug: inst.slug,
          liveCamUrl: inst.profile?.liveCamUrl ?? null,
        })),
      ),
    [institutions],
  );

  const filterCounts = useMemo(
    () => mapFilterCounts(view?.items ?? [], liveCamBySlug),
    [liveCamBySlug, view?.items],
  );
  const filteredItems = useMemo(
    () => filterMapItems(view?.items ?? [], filter, liveCamBySlug),
    [filter, liveCamBySlug, view?.items],
  );

  const thisYear = now.getFullYear();
  const timeline = useMemo(
    () => (history ? buildTimeline(history.residencies, history.events, thisYear) : null),
    [history, thisYear],
  );
  const [yearIndex, setYearIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const lastIndex = timeline ? timeline.years.length - 1 : 0;
  const index = yearIndex ?? lastIndex;
  const year = timeline && yearIndex !== null && yearIndex < lastIndex ? timeline.years[yearIndex] : undefined;

  useEffect(() => {
    if (!playing || !timeline) return;
    const id = setInterval(() => {
      setYearIndex((current) => {
        const next = (current ?? 0) + 1;
        if (next >= lastIndex) {
          setPlaying(false);
          return null;
        }
        return next;
      });
    }, PLAY_STEP_MS);
    return () => clearInterval(id);
  }, [playing, timeline, lastIndex]);

  const yearEvents = useMemo(
    () => (view && history && year !== undefined ? eventsInYear(view.items, history.events, history.pandas, year) : []),
    [view, history, year],
  );
  const yearView = useMemo<YearView | undefined>(() => {
    if (!view || !history || year === undefined) return undefined;
    const byId = new Map(view.items.map((item) => [item.id, item]));
    return {
      year,
      counts: residentsInYear(view.items, history.residencies, year),
      flows: yearEvents.flatMap((event) => {
        const from = event.from ? byId.get(event.from)?.point : undefined;
        const to = event.to ? byId.get(event.to)?.point : undefined;
        return from && to && event.from !== event.to ? [{ from, to }] : [];
      }),
    };
  }, [view, history, year, yearEvents]);

  const china = useMemo(() => pointsOf(view?.items.filter((item) => !item.overseas) ?? []), [view]);
  const everywhere = useMemo(() => pointsOf(view?.items ?? []), [view]);
  const overseas = view?.items.filter((item) => item.overseas && item.point).length ?? 0;
  const wildPoints = useMemo(() => WILD_AREAS.flatMap((area) => area.patches.map((patch) => ({ x: patch.x, y: patch.y }))), []);

  const home = (port: Viewport): Camera => fitPoints([...china, ...(layers.wild ? wildPoints : [])], port, 40, 8);

  const opened = useRef(false);
  useEffect(() => {
    if (!viewport || !view || opened.current) return;
    opened.current = true;
    setCamera(home(viewport));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on the first layout with data
  }, [viewport, view]);

  const sheetResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          dragStartHeight.set(sheetHeight.get());
        },
        onPanResponderMove: (_, gesture) => {
          sheetHeight.set(clamp(dragStartHeight.get() - gesture.dy, snapHeights.peek, snapHeights.expanded));
        },
        onPanResponderRelease: (_, gesture) => {
          const projected = sheetHeight.get() - gesture.vy * 80;
          const choices: [SheetSnap, number][] = [
            ["peek", snapHeights.peek],
            ["half", snapHeights.half],
            ["expanded", snapHeights.expanded],
          ];
          choices.sort((a, b) => Math.abs(projected - a[1]) - Math.abs(projected - b[1]));
          setSheetSnap(choices[0]![0]);
        },
      }),
    [dragStartHeight, sheetHeight, snapHeights],
  );

  const selectedPlace = selection?.kind === "place" ? view?.items.find((item) => item.id === selection.id) : undefined;
  const featuredPlace = selectedPlace ?? filteredItems[0] ?? view?.items[0];
  const featuredLiveMeta = featuredPlace ? venueLiveMeta(featuredPlace, liveCamBySlug, now) : null;
  const wildArea = selection?.kind === "wild" ? WILD_AREAS.find((area) => area.range.id === selection.id) : undefined;
  const nearVenues = wildArea ? venuesNear(wildArea, view?.items ?? []).length : 0;

  function choose(item: MapItem) {
    if (!item.point || !viewport || !camera) {
      openVenue(item);
      return;
    }
    setSelection({ kind: "place", id: item.id });
    setTimelineOpen(false);
    setSheetSnap((current) => (current === "peek" ? "half" : current));
    flyTo({ x: item.point.x, y: item.point.y, scale: Math.max(camera.scale, home(viewport).scale) });
  }

  function onMarker(marker: MapMarker) {
    const [only] = marker.items;
    if (marker.items.length === 1 && only) choose(only);
    else if (viewport) flyTo(fitPoints(pointsOf(marker.items), viewport, 64, 4));
  }

  function onWild(area: WildArea) {
    setSelection({ kind: "wild", id: area.range.id });
    setTimelineOpen(false);
    setSheetSnap((current) => (current === "peek" ? "half" : current));
    if (viewport) flyTo(fitPoints(area.patches, viewport, 72, 6));
  }

  function setFilter(next: MapFilter) {
    setFilterState(next);
    setTimelineOpen(false);
    setPlaying(false);
    setYearIndex(null);
    if (next === "wild") {
      setLayers({ wild: true });
      if (selection?.kind === "place") setSelection(null);
      if (viewport) flyTo(fitPoints(wildPoints, viewport, 40, 8));
      setWorldView(false);
      return;
    }
    if (selection?.kind === "wild") setSelection(null);
    if (!viewport || !view) return;
    const nextItems = filterMapItems(view.items, next, liveCamBySlug);
    const pts = pointsOf(nextItems);
    if (next === "china" || next === "all") {
      flyTo(fitPoints([...(pts.length ? pts : china), ...(layers.wild ? wildPoints : [])], viewport, 40, 8));
      setWorldView(false);
    } else if (pts.length > 0) {
      flyTo(fitPoints(pts, viewport, 56, 8));
      setWorldView(next === "overseas");
    }
  }

  function play() {
    if (playing) {
      setPlaying(false);
      return;
    }
    setSelection(null);
    setTimelineOpen(true);
    if (yearIndex === null || yearIndex >= lastIndex) setYearIndex(0);
    setPlaying(true);
  }

  function selectYear(next: number) {
    setPlaying(false);
    setSelection(null);
    setTimelineOpen(true);
    setYearIndex(next >= lastIndex ? null : next);
  }

  function openTimeline() {
    setSelection(null);
    setTimelineOpen(true);
    setSheetSnap((current) => (current === "peek" ? "half" : current));
  }

  function closeTimeline() {
    setPlaying(false);
    setYearIndex(null);
    setTimelineOpen(false);
  }

  function toggleWild() {
    setLayers((current) => ({ wild: !current.wild }));
    if (selection?.kind === "wild") setSelection(null);
  }

  function toggleWorldView() {
    if (!viewport) return;
    setSelection(null);
    if (worldView) {
      setWorldView(false);
      flyTo(home(viewport));
    } else {
      setWorldView(true);
      flyTo(fitPoints(everywhere, viewport, 56, 0));
    }
  }

  function cycleSheet() {
    setSheetSnap((current) => (current === "half" ? "expanded" : current === "expanded" ? "peek" : "half"));
  }

  useBackToClose(selection !== null || timelineOpen, () => {
    if (timelineOpen) closeTimeline();
    else setSelection(null);
  });

  const showVenues = year !== undefined || filter !== "wild";
  const showWild = year === undefined && (filter === "wild" || layers.wild);
  const visibleItems = year !== undefined ? (view?.items ?? []) : showVenues ? filteredItems : [];

  return {
    view,
    failed,
    refetch,
    filter,
    setFilter,
    filterCounts,
    filteredItems,
    visibleItems,
    liveCamBySlug,
    now,
    layers,
    showWild,
    toggleWild,
    clearSelection: () => setSelection(null),
    viewport,
    camera,
    handlers,
    timeline,
    timelineOpen,
    openTimeline,
    closeTimeline,
    index,
    year,
    playing,
    play,
    selectYear,
    yearEvents,
    yearView,
    overseas,
    worldView,
    toggleWorldView,
    sheetSnap,
    sheetHeight,
    cycleSheet,
    sheetResponder,
    place: selectedPlace,
    featuredPlace,
    featuredLiveMeta,
    wildArea,
    nearVenues,
    choose,
    onMarker,
    onWild,
  };
}
