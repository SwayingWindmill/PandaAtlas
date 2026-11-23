import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder } from "react-native";

import { type Camera, type Viewport, fitPoints } from "@/features/map/camera";
import { mapTimelineQueryOptions, mapViewQueryOptions } from "@/features/map/load";
import { MAP_BUTTON_SIZE } from "@/features/map/map-controls";
import { pointsOf } from "@/features/map/map-sheets";
import type { MapItem } from "@/features/map/model";
import { openVenue } from "@/features/map/place-list";
import { buildTimeline, eventsInYear, residentsInYear } from "@/features/map/timeline";
import { useMapCamera } from "@/features/map/use-map-camera";
import type { MapMarker, YearView } from "@/features/map/venue-map";
import { WILD_AREAS, type WildArea, venuesNear } from "@/features/map/wild";
import { useBackToClose } from "@/lib/use-back-to-close";

const SHEET_SHARE = 0.5;
const PLAY_STEP_MS = 700;

type MapSelection = { kind: "place"; id: string } | { kind: "wild"; id: string } | null;

export function useMapScreen(insetsTop: number, windowWidth: number, windowHeight: number) {
  const { data: view, isError: failed, refetch } = useQuery(mapViewQueryOptions());
  const { data: history } = useQuery(mapTimelineQueryOptions());
  const [selection, setSelection] = useState<MapSelection>(null);
  const [layers, setLayers] = useState({ venues: true, wild: true });
  const top = insetsTop + 8 + MAP_BUTTON_SIZE + 8;
  // The camera frames the strip above the sheet at its tallest, so the map does not jump as the sheet moves.
  const sheetMax = Math.round(windowHeight * SHEET_SHARE);
  const viewport = useMemo<Viewport | null>(
    () => (windowWidth && windowHeight ? { width: windowWidth, height: windowHeight, top, bottom: sheetMax } : null),
    [windowWidth, windowHeight, top, sheetMax],
  );
  const { camera, setCamera, flyTo, handlers } = useMapCamera(viewport);

  const thisYear = new Date().getFullYear();
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
  // 中国西南: the Sichuan bases and the wild ranges, close enough that the bases open as separate places.
  const home = (port: Viewport): Camera => fitPoints([...china, ...(layers.wild ? wildPoints : [])], port, 40, 8);

  const opened = useRef(false);
  useEffect(() => {
    if (!viewport || !view || opened.current) return;
    opened.current = true;
    setCamera(home(viewport));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on the first layout with data
  }, [viewport, view]);

  const [sheetUp, setSheetUp] = useState(true);
  const [sheetResponder] = useState(() =>
    PanResponder.create({
      // Capture, so a vertical drag is taken from the grabber's Pressable, which keeps the tap.
      onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 40) setSheetUp(false);
        else if (gesture.dy < -40) setSheetUp(true);
      },
    }),
  );

  const place = selection?.kind === "place" ? view?.items.find((item) => item.id === selection.id) : undefined;
  const wildArea = selection?.kind === "wild" ? WILD_AREAS.find((area) => area.range.id === selection.id) : undefined;
  const nearVenues = wildArea ? venuesNear(wildArea, view?.items ?? []).length : 0;

  function choose(item: MapItem) {
    if (!item.point || !viewport || !camera) {
      openVenue(item);
      return;
    }
    setSelection({ kind: "place", id: item.id });
    setSheetUp(true);
    flyTo({ x: item.point.x, y: item.point.y, scale: Math.max(camera.scale, home(viewport).scale) });
  }

  function onMarker(marker: MapMarker) {
    const [only] = marker.items;
    if (marker.items.length === 1 && only) choose(only);
    else if (viewport) flyTo(fitPoints(pointsOf(marker.items), viewport, 64, 4));
  }

  function onWild(area: WildArea) {
    setSelection({ kind: "wild", id: area.range.id });
    setSheetUp(true);
    if (viewport) flyTo(fitPoints(area.patches, viewport, 72, 6));
  }

  function play() {
    if (playing) {
      setPlaying(false);
      return;
    }
    setSelection(null);
    if (yearIndex === null || yearIndex >= lastIndex) setYearIndex(0);
    setPlaying(true);
  }

  function selectYear(next: number) {
    setPlaying(false);
    setSelection(null);
    setYearIndex(next >= lastIndex ? null : next);
  }

  function toggleVenues() {
    setLayers((current) => ({ ...current, venues: !current.venues }));
  }

  function toggleWild() {
    setLayers((current) => ({ ...current, wild: !current.wild }));
    if (selection?.kind === "wild") setSelection(null);
  }

  function flyOverseas() {
    if (!viewport) return;
    setSelection(null);
    flyTo(fitPoints(everywhere, viewport, 56, 0));
  }

  function flyHome() {
    if (!viewport) return;
    setSelection(null);
    flyTo(home(viewport));
  }

  // Back closes the selected place's or wild area's sheet before it leaves the map.
  useBackToClose(selection !== null, () => setSelection(null));

  return {
    view,
    failed,
    refetch,
    layers,
    toggleVenues,
    toggleWild,
    clearSelection: () => setSelection(null),
    viewport,
    camera,
    handlers,
    timeline,
    index,
    year,
    playing,
    play,
    selectYear,
    yearEvents,
    yearView,
    overseas,
    flyOverseas,
    flyHome,
    sheetUp,
    toggleSheet: () => setSheetUp((up) => !up),
    sheetMax,
    sheetResponder,
    place,
    wildArea,
    nearVenues,
    choose,
    onMarker,
    onWild,
  };
}
