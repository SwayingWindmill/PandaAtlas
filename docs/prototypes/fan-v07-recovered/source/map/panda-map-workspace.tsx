"use client";

/* eslint-disable @next/next/no-img-element -- prototype uses currently published panda media URLs directly. */

import "@/styles/third-party/maplibre.css";

import { GeoJsonLayer, PathLayer } from "@deck.gl/layers";
import { MapboxOverlay } from "@deck.gl/mapbox";
import type { Geometry } from "geojson";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Layers3, LocateFixed, MapPin, Minus, Pause, Play, Plus, Route as RouteIcon, Search, Trees, X } from "lucide-react";
import {
  LngLatBounds,
  Map as MapLibreMapClass,
  Marker,
  Popup,
  setWorkerUrl,
  type GeoJSONSource,
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-csp-worker.js?maplibre-worker";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import styles from "./map-workspace.module.css";

export type PandaMapWorkspaceMode = "institutions" | "individual" | "wild";
type PandaBasemapId = "carto-tracker" | "carto-light" | "carto-contrast";

export interface PandaMapWorkspacePerson {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  relationship: "current" | "historical";
}

export interface PandaMapWorkspaceItem {
  id: string;
  title: string;
  subtitle: string;
  placeLabel: string;
  statusDetail: string;
  dateRange: string;
  startDate: string | null;
  endDate: string | null;
  status: "current" | "historical";
  kind: "institution" | "residency" | "conservation_area";
  coordinate: [number, number] | null;
  geometry: Geometry | null;
  people: PandaMapWorkspacePerson[];
  primaryHref: string | null;
}

interface PandaMapWorkspaceProps {
  locale: "zh" | "en";
  mode: PandaMapWorkspaceMode;
  focus: string;
  selectedId: string;
  snapshot: string;
  routeBase: string;
  items: PandaMapWorkspaceItem[];
  tileUrl: string;
  attribution: string;
}

const modeCopy = {
  zh: {
    institutions: {
      label: "熊猫在哪里",
      short: "地点",
      description: "从一个地方认识现在或曾经生活在这里的熊猫",
      search: "搜索熊猫、机构或地点…",
      empty: "没有找到匹配的熊猫地点。",
    },
    individual: {
      label: "熊猫旅行记",
      short: "旅程",
      description: "沿着公开居住记录，看一只熊猫走过哪些地方",
      search: "输入熊猫名字查看旅程…",
      empty: "没有找到匹配的熊猫居住记录。",
    },
    wild: {
      label: "野生家园",
      short: "家园",
      description: "从保护范围和地区理解野生大熊猫生活的空间",
      search: "搜索保护范围或地区…",
      empty: "没有找到匹配的野生家园记录。",
    },
  },
  en: {
    institutions: {
      label: "Where pandas live",
      short: "Places",
      description: "Start from a place and meet the pandas living there now or in the past",
      search: "Search panda, institution or place…",
      empty: "No matching panda places found.",
    },
    individual: {
      label: "Panda journeys",
      short: "Journey",
      description: "Follow published residency records through a panda's life",
      search: "Enter a panda name to see its journey…",
      empty: "No matching panda residency records found.",
    },
    wild: {
      label: "Wild homes",
      short: "Wild",
      description: "Explore protected ranges and regions connected to wild giant pandas",
      search: "Search range or region…",
      empty: "No matching wild-home records found.",
    },
  },
} as const;

function workspaceHref(
  routeBase: string,
  snapshot: string,
  mode: PandaMapWorkspaceMode,
  options: { focus?: string; selected?: string } = {},
): string {
  const query = new URLSearchParams();
  query.set("mode", mode);
  if (options.focus) query.set("focus", options.focus);
  query.set("snapshot", snapshot);
  if (options.selected) query.set("selected", options.selected);
  return `${routeBase}?${query.toString()}`;
}

function yearFromIsoDate(value: string | null): number | null {
  if (!value) return null;
  const year = Number.parseInt(value.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

function visitGeometryCoordinates(geometry: Geometry | null, visit: (coordinate: [number, number]) => void): void {
  if (!geometry) return;
  if (geometry.type === "GeometryCollection") {
    geometry.geometries.forEach((child) => visitGeometryCoordinates(child, visit));
    return;
  }
  const walk = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      visit([value[0], value[1]]);
      return;
    }
    value.forEach(walk);
  };
  walk(geometry.coordinates);
}

const BASEMAP_PAINT: Record<PandaBasemapId, {
  saturation: number;
  contrast: number;
  brightnessMin: number;
  brightnessMax: number;
  opacity: number;
}> = {
  "carto-tracker": {
    saturation: -0.72,
    contrast: -0.08,
    brightnessMin: 0.16,
    brightnessMax: 0.98,
    opacity: 0.92,
  },
  "carto-light": {
    saturation: -0.48,
    contrast: 0.02,
    brightnessMin: 0.12,
    brightnessMax: 0.98,
    opacity: 1,
  },
  "carto-contrast": {
    saturation: -0.28,
    contrast: 0.18,
    brightnessMin: 0.08,
    brightnessMax: 0.95,
    opacity: 1,
  },
};

function makeBasemapStyle(tileUrl: string, attribution: string): StyleSpecification {
  const paint = BASEMAP_PAINT["carto-tracker"];
  return {
    version: 8,
    sources: {
      basemap: {
        type: "raster",
        tiles: [tileUrl],
        tileSize: 256,
        attribution,
      },
    },
    layers: [
      {
        id: "panda-map-background",
        type: "background",
        paint: { "background-color": "#e7ece6" },
      },
      {
        id: "panda-map-basemap",
        type: "raster",
        source: "basemap",
        paint: {
          "raster-saturation": paint.saturation,
          "raster-contrast": paint.contrast,
          "raster-brightness-min": paint.brightnessMin,
          "raster-brightness-max": paint.brightnessMax,
          "raster-opacity": paint.opacity,
        },
      },
    ],
  };
}

function applyBasemapPaint(map: MapLibreMap, id: PandaBasemapId): void {
  if (!map.getLayer("panda-map-basemap")) return;
  const paint = BASEMAP_PAINT[id];
  map.setPaintProperty("panda-map-basemap", "raster-saturation", paint.saturation);
  map.setPaintProperty("panda-map-basemap", "raster-contrast", paint.contrast);
  map.setPaintProperty("panda-map-basemap", "raster-brightness-min", paint.brightnessMin);
  map.setPaintProperty("panda-map-basemap", "raster-brightness-max", paint.brightnessMax);
  map.setPaintProperty("panda-map-basemap", "raster-opacity", paint.opacity);
}

function PeopleStack({ people }: { people: PandaMapWorkspacePerson[] }) {
  if (!people.length) return <span className={styles.fallbackMark} aria-hidden="true"><MapPin /></span>;
  return (
    <span className={styles.peopleStack} aria-hidden="true">
      {people.slice(0, 3).map((person) => (
        person.imageUrl
          ? <img key={person.id} src={person.imageUrl} alt="" />
          : <span key={person.id}>{person.name.slice(0, 1)}</span>
      ))}
    </span>
  );
}

function LayerToggle({
  label,
  detail,
  count,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  detail: string;
  count?: number;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={styles.layerToggle}
      data-active={checked ? "true" : undefined}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.layerToggleCopy}>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <span className={styles.layerToggleMeta}>
        {typeof count === "number" ? <em>{count}</em> : null}
        <span className={styles.switchTrack} aria-hidden="true"><span /></span>
      </span>
    </button>
  );
}

export function PandaMapWorkspace({
  locale,
  mode,
  focus,
  selectedId,
  snapshot,
  routeBase,
  items,
  tileUrl,
  attribution,
}: PandaMapWorkspaceProps) {
  const zh = locale === "zh";
  const router = useRouter();
  const copy = modeCopy[locale][mode];
  const [query, setQuery] = useState(focus);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "degraded">("loading");
  const [basemapId, setBasemapId] = useState<PandaBasemapId>("carto-tracker");
  const [layersOpen, setLayersOpen] = useState(false);
  const [browseKind, setBrowseKind] = useState<"pandas" | "places">(mode === "individual" ? "pandas" : "places");
  const [resultFilter, setResultFilter] = useState<"all" | "current" | "historical">("all");
  const [placesVisible, setPlacesVisible] = useState(true);
  const [labelsVisible, setLabelsVisible] = useState(false);
  const [historicalVisible, setHistoricalVisible] = useState(true);
  const [journeyVisible, setJourneyVisible] = useState(true);
  const [habitatVisible, setHabitatVisible] = useState(true);
  const [habitatOpacity, setHabitatOpacity] = useState(32);
  const [timelineYear, setTimelineYear] = useState<number | null>(null);
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const [hoveredPandaId, setHoveredPandaId] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState(mode === "wild" ? 5.2 : 2.4);
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const deckOverlayRef = useRef<MapboxOverlay | null>(null);
  const markerEntriesRef = useRef<Array<{
    element: HTMLDivElement;
    label: HTMLSpanElement;
    item: PandaMapWorkspaceItem;
  }>>([]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );
  const selectedCurrentPeople = useMemo(
    () => selected?.people.filter((person) => person.relationship === "current") ?? [],
    [selected],
  );
  const selectedHistoricalPeople = useMemo(
    () => selected?.people.filter((person) => person.relationship === "historical") ?? [],
    [selected],
  );

  const filteredItems = useMemo(
    () => resultFilter === "all" ? items : items.filter((item) => item.status === resultFilter),
    [items, resultFilter],
  );

  const pandaBrowseItems = useMemo(() => {
    const byPanda = new Map<string, {
      person: PandaMapWorkspacePerson;
      places: Set<string>;
      currentPlace: string | null;
      current: boolean;
      historical: boolean;
    }>();
    items.forEach((item) => {
      item.people.forEach((person) => {
        const entry = byPanda.get(person.id) ?? {
          person,
          places: new Set<string>(),
          currentPlace: null,
          current: false,
          historical: false,
        };
        if (item.placeLabel) entry.places.add(item.placeLabel);
        if (person.relationship === "current") {
          entry.current = true;
          entry.currentPlace ??= item.placeLabel || null;
        }
        if (person.relationship === "historical") entry.historical = true;
        byPanda.set(person.id, entry);
      });
    });
    return [...byPanda.values()].sort((a, b) => a.person.name.localeCompare(b.person.name, locale));
  }, [items, locale]);

  const timelineResidencies = useMemo(() => {
    if (mode !== "individual" || !focus) return [] as PandaMapWorkspaceItem[];
    return items
      .filter((item) => item.kind === "residency" && item.startDate)
      .sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
  }, [focus, items, mode]);

  const timelineBounds = useMemo(() => {
    if (!timelineResidencies.length) return null;
    const currentYear = new Date().getUTCFullYear();
    const starts = timelineResidencies.flatMap((item) => {
      const year = yearFromIsoDate(item.startDate);
      return year === null ? [] : [year];
    });
    const ends = timelineResidencies.flatMap((item) => {
      const year = yearFromIsoDate(item.endDate);
      return [year ?? currentYear];
    });
    if (!starts.length || !ends.length) return null;
    return { min: Math.min(...starts), max: Math.max(...ends) };
  }, [timelineResidencies]);

  const timelineVisibleIds = useMemo(() => {
    if (mode !== "individual" || !focus || timelineYear === null) return null;
    return new Set(timelineResidencies
      .filter((item) => {
        const startYear = yearFromIsoDate(item.startDate);
        return startYear === null || startYear <= timelineYear;
      })
      .map((item) => item.id));
  }, [focus, mode, timelineResidencies, timelineYear]);

  const journeyCoordinates = useMemo(() => {
    if (mode !== "individual" || !focus) return [] as [number, number][];
    const matching = timelineResidencies.filter((item) => {
      if (!item.coordinate) return false;
      if (!timelineVisibleIds) return true;
      return timelineVisibleIds.has(item.id);
    });
    if (matching.length < 2) return [] as [number, number][];
    return matching.flatMap((item) => item.coordinate ? [item.coordinate] : []);
  }, [focus, mode, timelineResidencies, timelineVisibleIds]);

  const polygonFeatures = useMemo(() => items
    .filter((item) => item.geometry && item.geometry.type !== "Point")
    .map((item) => ({
      type: "Feature" as const,
      id: item.id,
      geometry: item.geometry!,
      properties: { id: item.id, title: item.title },
    })), [items]);
  const mappedPlaceCount = useMemo(() => items.filter((item) => item.coordinate).length, [items]);
  const currentItemCount = useMemo(() => items.filter((item) => item.status === "current").length, [items]);
  const historicalItemCount = useMemo(() => items.filter((item) => item.status === "historical").length, [items]);
  const journeyStopCount = useMemo(() => timelineResidencies.filter((item) => item.coordinate).length, [timelineResidencies]);
  const historicalPlaceCount = useMemo(
    () => items.filter((item) => item.coordinate && item.status === "historical").length,
    [items],
  );
  const visibleMapItems = useMemo(() => items.filter((item) => {
    if (!placesVisible || !item.coordinate) return false;
    if (browseKind === "places" && resultFilter !== "all" && item.status !== resultFilter) return false;
    if (!historicalVisible && item.status === "historical") return false;
    if (timelineVisibleIds && !timelineVisibleIds.has(item.id)) return false;
    return true;
  }), [browseKind, historicalVisible, items, placesVisible, resultFilter, timelineVisibleIds]);
  const visibleMapIds = useMemo(() => new Set(visibleMapItems.map((item) => item.id)), [visibleMapItems]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousOverscroll = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.documentElement.style.overscrollBehavior = previousOverscroll;
    };
  }, []);

  useEffect(() => {
    setTimelinePlaying(false);
    setTimelineYear(timelineBounds?.max ?? null);
  }, [timelineBounds]);

  useEffect(() => {
    if (!timelinePlaying || !timelineBounds || timelineYear === null) return;
    const timer = window.setInterval(() => {
      setTimelineYear((current) => {
        if (current === null) return timelineBounds.min;
        if (current >= timelineBounds.max) {
          setTimelinePlaying(false);
          return timelineBounds.max;
        }
        return current + 1;
      });
    }, 850);
    return () => window.clearInterval(timer);
  }, [timelineBounds, timelinePlaying, timelineYear]);

  useEffect(() => {
    if (!mapNodeRef.current) return;

    setWorkerUrl(maplibreWorkerUrl);
    setMapStatus("loading");

    const map = new MapLibreMapClass({
      container: mapNodeRef.current,
      center: mode === "wild" ? [103.7, 30.7] : [104.5, 31],
      zoom: mode === "wild" ? 5.2 : 2.4,
      minZoom: 2,
      maxZoom: 12,
      renderWorldCopies: false,
      attributionControl: { compact: true },
      cooperativeGestures: false,
    });
    mapRef.current = map;
    const updateZoom = () => setMapZoom(map.getZoom());
    map.on("zoomend", updateZoom);

    const markers: Marker[] = [];
    let hoverPopup: Popup | null = null;

    markerEntriesRef.current = [];

    const cleanupMarkers = () => {
      markers.forEach((marker) => marker.remove());
      markers.length = 0;
      markerEntriesRef.current = [];
    };

    let overlaysReady = false;
    const setupOverlays = () => {
      if (overlaysReady) return;
      overlaysReady = true;
      setMapStatus("ready");

      const deckOverlay = new MapboxOverlay({ interleaved: false, layers: [] });
      map.addControl(deckOverlay as never);
      deckOverlayRef.current = deckOverlay;

      map.addSource("panda-cluster-points", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 5,
        clusterRadius: 64,
      });
      map.addLayer({
        id: "panda-clusters",
        type: "circle",
        source: "panda-cluster-points",
        maxzoom: 5.6,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#214e39",
          "circle-radius": ["step", ["get", "point_count"], 18, 5, 22, 12, 27],
          "circle-stroke-color": "#fffdf8",
          "circle-stroke-width": 3,
        },
      });
      map.addLayer({
        id: "panda-cluster-count",
        type: "symbol",
        source: "panda-cluster-points",
        maxzoom: 5.6,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
        },
        paint: { "text-color": "#ffffff" },
      });
      map.addLayer({
        id: "panda-unclustered-points",
        type: "circle",
        source: "panda-cluster-points",
        maxzoom: 5.6,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#3d7452",
          "circle-radius": 8,
          "circle-stroke-color": "#fffdf8",
          "circle-stroke-width": 3,
        },
      });
      map.addSource("panda-hover-points", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "panda-hover-rings",
        type: "circle",
        source: "panda-hover-points",
        paint: {
          "circle-radius": 19,
          "circle-color": "rgba(255,255,255,0)",
          "circle-stroke-color": "#d4a932",
          "circle-stroke-width": 4,
          "circle-stroke-opacity": 0.95,
        },
      });
      hoverPopup = new Popup({ closeButton: false, closeOnClick: false, offset: 14, className: styles.clusterPopup });
      map.on("click", "panda-clusters", async (event) => {
        const feature = event.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;
        const [lng, lat] = feature.geometry.coordinates;
        const clusterId = Number(feature.properties?.cluster_id);
        const source = map.getSource("panda-cluster-points") as GeoJSONSource | undefined;
        const expansionZoom = Number.isFinite(clusterId) && source
          ? await source.getClusterExpansionZoom(clusterId).catch(() => null)
          : null;
        map.easeTo({
          center: [lng, lat],
          zoom: expansionZoom ?? Math.min(map.getZoom() + 2.25, 7),
          duration: 420,
        });
      });
      map.on("mouseenter", "panda-clusters", (event) => {
        map.getCanvas().style.cursor = "zoom-in";
        const feature = event.features?.[0];
        const count = Number(feature?.properties?.point_count ?? 0);
        if (feature?.geometry.type === "Point" && hoverPopup) {
          hoverPopup
            .setLngLat(feature.geometry.coordinates as [number, number])
            .setText(zh ? `${count} 个公开地点 · 点击展开` : `${count} published places · click to expand`)
            .addTo(map);
        }
      });
      map.on("mouseleave", "panda-clusters", () => {
        map.getCanvas().style.cursor = "";
        hoverPopup?.remove();
      });
      map.on("click", "panda-unclustered-points", (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === "string") {
          router.push(workspaceHref(routeBase, snapshot, mode, { focus, selected: id }) as Route, { scroll: false });
        }
      });
      map.on("mouseenter", "panda-unclustered-points", (event) => {
        map.getCanvas().style.cursor = "pointer";
        const feature = event.features?.[0];
        const title = feature?.properties?.title;
        if (feature?.geometry.type === "Point" && typeof title === "string" && hoverPopup) {
          hoverPopup
            .setLngLat(feature.geometry.coordinates as [number, number])
            .setText(title)
            .addTo(map);
        }
      });
      map.on("mouseleave", "panda-unclustered-points", () => {
        map.getCanvas().style.cursor = "";
        hoverPopup?.remove();
      });

      for (const item of items) {
        if (!item.coordinate) continue;
        const element = document.createElement("div");
        element.className = styles.markerShell;
        element.style.zIndex = "7";
        element.style.pointerEvents = "auto";
        element.innerHTML = "";
        const root = document.createElement("div");
        element.appendChild(root);

        const person = item.people[0] ?? null;
        const button = document.createElement("button");
        button.type = "button";
        button.className = styles.markerButton;
        button.setAttribute("aria-label", item.title);
        if (selectedId === item.id) button.dataset.selected = "true";

        if (person?.imageUrl) {
          const image = document.createElement("img");
          image.src = person.imageUrl;
          image.alt = "";
          button.appendChild(image);
        } else {
          const dot = document.createElement("span");
          dot.className = styles.markerDot;
          dot.textContent = item.people.length > 0 ? String(item.people.length) : "•";
          button.appendChild(dot);
        }

        if (item.people.length > 1) {
          const count = document.createElement("span");
          count.className = styles.markerCount;
          count.textContent = String(item.people.length);
          button.appendChild(count);
        }

        button.addEventListener("click", () => {
          router.push(workspaceHref(routeBase, snapshot, mode, { focus, selected: item.id }) as Route, { scroll: false });
        });
        root.appendChild(button);

        const label = document.createElement("span");
        label.className = styles.markerLabel;
        label.textContent = item.title;
        label.hidden = true;
        root.appendChild(label);

        const hover = document.createElement("span");
        hover.className = styles.markerHoverCard;
        const hoverTitle = document.createElement("strong");
        hoverTitle.textContent = item.title;
        const hoverPlace = document.createElement("small");
        hoverPlace.textContent = item.placeLabel;
        const hoverStatus = document.createElement("em");
        hoverStatus.textContent = item.status === "current"
          ? (zh ? "当前公开地点" : "Current published place")
          : (zh ? "历史居住记录" : "Historical residency");
        hover.append(hoverTitle, hoverPlace, hoverStatus);
        root.appendChild(hover);

        markerEntriesRef.current.push({ element, label, item });
        markers.push(new Marker({ element, anchor: "center" }).setLngLat(item.coordinate).addTo(map));
      }

      const bounds = new LngLatBounds();
      let hasBounds = false;
      items.forEach((item) => {
        if (item.coordinate) {
          bounds.extend(item.coordinate);
          hasBounds = true;
        }
        visitGeometryCoordinates(item.geometry, (coordinate) => {
          bounds.extend(coordinate);
          hasBounds = true;
        });
      });

      const coordinateItems = items.filter((item) => item.coordinate);
      if (selected?.coordinate) {
        map.jumpTo({ center: selected.coordinate, zoom: Math.max(map.getZoom(), 6.1) });
      } else if (mode !== "wild" && coordinateItems.length === 1 && coordinateItems[0]?.coordinate) {
        map.jumpTo({ center: coordinateItems[0].coordinate, zoom: 6.1 });
      } else if (hasBounds) {
        const padding = window.innerWidth > 864
          ? { top: 150, right: 96, bottom: 88, left: 390 }
          : { top: 190, right: 48, bottom: 300, left: 48 };
        map.fitBounds(bounds, { padding, maxZoom: mode === "wild" ? 7 : 6.5, duration: 0 });
      }

      window.setTimeout(() => {
        map.resize();
        markers.forEach((marker) => marker.setLngLat(marker.getLngLat()));
      }, 40);
    };

    map.on("style.load", setupOverlays);
    map.setStyle(makeBasemapStyle(tileUrl, attribution));

    map.on("error", () => setMapStatus((current) => current === "ready" ? "degraded" : current));

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(mapNodeRef.current);

    return () => {
      observer.disconnect();
      map.off("zoomend", updateZoom);
      hoverPopup?.remove();
      cleanupMarkers();
      deckOverlayRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [attribution, focus, items, mode, routeBase, router, selected, selectedId, snapshot, tileUrl]);

  useEffect(() => {
    markerEntriesRef.current.forEach(({ element, label, item }) => {
      const visible = visibleMapIds.has(item.id) && mapZoom > 5.45;
      const highlighted = hoveredPandaId
        ? item.people.some((person) => person.id === hoveredPandaId)
        : false;
      element.hidden = !visible;
      label.hidden = !visible || !labelsVisible;
      if (highlighted) element.dataset.highlighted = "true";
      else delete element.dataset.highlighted;
    });
  }, [hoveredPandaId, labelsVisible, mapStatus, mapZoom, visibleMapIds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapStatus !== "ready") return;
    const source = map.getSource("panda-cluster-points") as GeoJSONSource | undefined;
    if (!source) return;
    source.setData({
      type: "FeatureCollection",
      features: visibleMapItems.map((item) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: item.coordinate! },
        properties: { id: item.id, title: item.title, status: item.status },
      })),
    });
  }, [mapStatus, visibleMapItems]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapStatus !== "ready") return;
    const source = map.getSource("panda-hover-points") as GeoJSONSource | undefined;
    if (!source) return;
    const related = hoveredPandaId
      ? visibleMapItems.filter((item) => item.people.some((person) => person.id === hoveredPandaId))
      : [];
    source.setData({
      type: "FeatureCollection",
      features: related.map((item) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: item.coordinate! },
        properties: { id: item.id },
      })),
    });
  }, [hoveredPandaId, mapStatus, visibleMapItems]);

  useEffect(() => {
    const overlay = deckOverlayRef.current;
    if (!overlay || mapStatus !== "ready") return;

    const deckLayers = [];
    if (habitatVisible && polygonFeatures.length) {
      deckLayers.push(new GeoJsonLayer({
        id: "zhipanda-habitat",
        data: { type: "FeatureCollection", features: polygonFeatures },
        filled: true,
        stroked: true,
        pickable: true,
        opacity: habitatOpacity / 100,
        getFillColor: [69, 105, 77, 190],
        getLineColor: [41, 76, 51, 235],
        getLineWidth: 2,
        lineWidthMinPixels: 1.4,
        onClick: (info) => {
          const id = info.object?.properties?.id;
          if (typeof id === "string") {
            router.push(workspaceHref(routeBase, snapshot, mode, { focus, selected: id }) as Route, { scroll: false });
          }
        },
      }));
    }

    if (journeyVisible && journeyCoordinates.length >= 2) {
      deckLayers.push(new PathLayer<{ path: [number, number][] }>({
        id: "zhipanda-journey",
        data: [{ path: journeyCoordinates }],
        getPath: (entry) => entry.path,
        getColor: [47, 111, 79, 224],
        getWidth: 4,
        widthUnits: "pixels",
        widthMinPixels: 3,
        capRounded: true,
        jointRounded: true,
      }));
    }

    overlay.setProps({ layers: deckLayers });
  }, [focus, habitatOpacity, habitatVisible, journeyCoordinates, journeyVisible, mapStatus, mode, polygonFeatures, routeBase, router, snapshot]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push(workspaceHref(routeBase, snapshot, mode, { focus: query.trim() }) as Route, { scroll: false });
  };

  const clearSearch = () => {
    setQuery("");
    router.push(workspaceHref(routeBase, snapshot, mode) as Route, { scroll: false });
  };

  const resetView = () => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = new LngLatBounds();
    let hasBounds = false;
    items.forEach((item) => {
      if (item.coordinate) {
        bounds.extend(item.coordinate);
        hasBounds = true;
      }
      visitGeometryCoordinates(item.geometry, (coordinate) => {
        bounds.extend(coordinate);
        hasBounds = true;
      });
    });
    const coordinateItems = items.filter((item) => item.coordinate);
    if (mode !== "wild" && coordinateItems.length === 1 && coordinateItems[0]?.coordinate) {
      map.jumpTo({ center: coordinateItems[0].coordinate, zoom: 6.1 });
    } else if (hasBounds) {
      const padding = window.innerWidth > 864
        ? { top: 150, right: 96, bottom: 88, left: 390 }
        : { top: 190, right: 48, bottom: 300, left: 48 };
      map.fitBounds(bounds, { padding, maxZoom: mode === "wild" ? 7 : 6.5, duration: 360 });
    }
  };

  const switchBasemap = (nextId: PandaBasemapId) => {
    if (nextId === basemapId) return;
    const map = mapRef.current;
    if (map) applyBasemapPaint(map, nextId);
    setBasemapId(nextId);
  };

  const stepTimeline = (delta: number) => {
    if (!timelineBounds) return;
    setTimelinePlaying(false);
    setTimelineYear((current) => Math.min(
      timelineBounds.max,
      Math.max(timelineBounds.min, (current ?? timelineBounds.max) + delta),
    ));
  };

  const toggleTimelinePlayback = () => {
    if (!timelineBounds) return;
    if (timelinePlaying) {
      setTimelinePlaying(false);
      return;
    }
    if (timelineYear === null || timelineYear >= timelineBounds.max) {
      setTimelineYear(timelineBounds.min);
    }
    setTimelinePlaying(true);
  };

  const modeOptions = [
    { id: "institutions" as const, icon: MapPin },
    { id: "individual" as const, icon: RouteIcon },
    { id: "wild" as const, icon: Trees },
  ];
  const basemapOptions: Array<{ id: PandaBasemapId; label: string; provider: string; note: string }> = [
    { id: "carto-tracker", label: zh ? "Tracker 柔和" : "Tracker Soft", provider: "CARTO / OSM", note: zh ? "最低干扰 · 推荐" : "Lowest-noise · recommended" },
    { id: "carto-light", label: "CARTO Light", provider: "CARTO / OSM", note: zh ? "标准浅色" : "Standard light" },
    { id: "carto-contrast", label: zh ? "清晰对比" : "Clear Contrast", provider: "CARTO / OSM", note: zh ? "道路和边界更清楚" : "Clearer roads and boundaries" },
  ];

  return (
    <section className={styles.workspace} aria-label={zh ? "熊猫地图工作区" : "Panda map workspace"}>
      <header className={styles.workspaceHeader}>
        <div className={styles.titleBlock}>
          <p>{zh ? "Places · 从熊猫看世界" : "Places · See the world through pandas"}</p>
          <div>
            <h1>{zh ? "熊猫地图" : "Panda map"}</h1>
            <span>{copy.description}</span>
          </div>
        </div>

        <nav className={styles.modeSwitch} aria-label={zh ? "地图模式" : "Map modes"}>
          {modeOptions.map(({ id, icon: Icon }) => (
            <Link
              key={id}
              href={workspaceHref(routeBase, snapshot, id) as Route}
              aria-current={mode === id ? "page" : undefined}
            >
              <Icon aria-hidden="true" />
              <span>{modeCopy[locale][id].label}</span>
            </Link>
          ))}
        </nav>

        <form className={styles.searchForm} onSubmit={submitSearch} role="search">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.search}
            aria-label={copy.search}
          />
          {query ? <button type="button" onClick={clearSearch} aria-label={zh ? "清除搜索" : "Clear search"}><X /></button> : null}
        </form>
      </header>

      <aside className={styles.resultsPanel} data-layout={mode === "wild" ? "wild" : browseKind === "places" ? "places" : "pandas"}>
        <div className={styles.resultsHead}>
          <div>
            <strong>{mode === "wild" ? copy.label : browseKind === "pandas" ? (zh ? "熊猫" : "Pandas") : copy.label}</strong>
            <span>{mode !== "wild" && browseKind === "pandas"
              ? (zh ? `${pandaBrowseItems.length} 只关联熊猫` : `${pandaBrowseItems.length} related pandas`)
              : (zh ? `${filteredItems.length} / ${items.length} 条公开记录` : `${filteredItems.length} / ${items.length} published records`)}</span>
          </div>
          {focus ? <button type="button" onClick={clearSearch}>{zh ? "全部" : "All"}</button> : null}
        </div>

        {mode !== "wild" ? (
          <div className={styles.browseTabs} aria-label={zh ? "浏览熊猫或地点" : "Browse pandas or places"}>
            <button type="button" data-active={browseKind === "pandas" ? "true" : undefined} onClick={() => setBrowseKind("pandas")}>{zh ? "熊猫" : "Pandas"}</button>
            <button type="button" data-active={browseKind === "places" ? "true" : undefined} onClick={() => setBrowseKind("places")}>{zh ? "地点" : "Places"}</button>
          </div>
        ) : null}

        {mode !== "wild" && browseKind === "places" ? (
          <div className={styles.resultFilters} aria-label={zh ? "记录筛选" : "Record filters"}>
            <button type="button" data-active={resultFilter === "all" ? "true" : undefined} onClick={() => setResultFilter("all")}>
              <span>{zh ? "全部" : "All"}</span><em>{items.length}</em>
            </button>
            <button type="button" data-active={resultFilter === "current" ? "true" : undefined} onClick={() => setResultFilter("current")}>
              <span>{zh ? "现在" : "Now"}</span><em>{currentItemCount}</em>
            </button>
            <button type="button" data-active={resultFilter === "historical" ? "true" : undefined} onClick={() => setResultFilter("historical")}>
              <span>{zh ? "历史" : "Past"}</span><em>{historicalItemCount}</em>
            </button>
          </div>
        ) : null}

        <div className={styles.resultList}>
          {mode !== "wild" && browseKind === "pandas" ? (
            pandaBrowseItems.length ? pandaBrowseItems.map((entry) => (
              <Link
                key={entry.person.id}
                href={workspaceHref(routeBase, snapshot, "individual", { focus: entry.person.name }) as Route}
                className={styles.pandaBrowseRow}
                data-highlighted={hoveredPandaId === entry.person.id ? "true" : undefined}
                onMouseEnter={() => setHoveredPandaId(entry.person.id)}
                onMouseLeave={() => setHoveredPandaId(null)}
                onFocus={() => setHoveredPandaId(entry.person.id)}
                onBlur={() => setHoveredPandaId(null)}
              >
                <PeopleStack people={[entry.person]} />
                <span>
                  <strong>{entry.person.name}</strong>
                  <small>{entry.currentPlace
                    ? (zh ? `现在 · ${entry.currentPlace}` : `Now · ${entry.currentPlace}`)
                    : (zh ? `${entry.places.size} 个历史地点` : `${entry.places.size} historical place${entry.places.size === 1 ? "" : "s"}`)}</small>
                </span>
                <em data-current={entry.current ? "true" : undefined}>{entry.current ? (zh ? "现在" : "Now") : (zh ? "历史" : "Past")}</em>
              </Link>
            )) : <p className={styles.emptyState}>{zh ? "暂无关联熊猫。" : "No related pandas."}</p>
          ) : filteredItems.length ? filteredItems.map((item) => (
            <Link
              key={item.id}
              href={workspaceHref(routeBase, snapshot, mode, { focus, selected: item.id }) as Route}
              className={styles.resultRow}
              data-selected={selectedId === item.id ? "true" : undefined}
            >
              <PeopleStack people={item.people} />
              <span className={styles.resultCopy}>
                <span className={styles.resultTitleLine}>
                  <strong>{item.title}</strong>
                  <em data-status={item.status}>{item.status === "current" ? (zh ? "现在" : "Now") : (zh ? "历史" : "Past")}</em>
                </span>
                <small>{item.placeLabel}</small>
                <span>{item.statusDetail}</span>
              </span>
            </Link>
          )) : <p className={styles.emptyState}>{copy.empty}</p>}
        </div>
      </aside>

      <div className={styles.mapPanel}>
        <div ref={mapNodeRef} className={styles.mapCanvas} />

        <div className={styles.mapControls} aria-label={zh ? "地图控制" : "Map controls"}>
          <button type="button" onClick={() => mapRef.current?.zoomIn({ duration: 180 })} aria-label={zh ? "放大" : "Zoom in"}><Plus /></button>
          <button type="button" onClick={() => mapRef.current?.zoomOut({ duration: 180 })} aria-label={zh ? "缩小" : "Zoom out"}><Minus /></button>
          <button type="button" onClick={resetView} aria-label={zh ? "显示全部地点" : "Show all places"}><LocateFixed /></button>
          <button
            type="button"
            onClick={() => setLayersOpen((open) => !open)}
            aria-label={zh ? "地图图层" : "Map layers"}
            aria-expanded={layersOpen}
          >
            <Layers3 />
          </button>
        </div>

        {layersOpen ? (
          <aside className={styles.layersPanel} aria-label={zh ? "地图图层" : "Map layers"}>
            <div className={styles.layersPanelHead}>
              <span>
                <strong>MAP LAYERS</strong>
                <small>{zh ? "选择你想在熊猫世界里看到的内容" : "Choose what appears in the panda world"}</small>
              </span>
              <button type="button" onClick={() => setLayersOpen(false)} aria-label={zh ? "关闭图层面板" : "Close layers panel"}><X /></button>
            </div>

            <section className={styles.layerSection}>
              <p>{zh ? "熊猫世界" : "PANDA WORLD"}</p>
              <LayerToggle
                label={zh ? "熊猫地点" : "Panda places"}
                detail={zh ? "公开机构与居住地点" : "Published institutions and residencies"}
                count={mappedPlaceCount}
                checked={placesVisible}
                onChange={setPlacesVisible}
              />
              <LayerToggle
                label={zh ? "地点名称" : "Place labels"}
                detail={zh ? "在 Marker 旁显示地点名称" : "Show names beside markers"}
                checked={labelsVisible}
                disabled={!placesVisible}
                onChange={setLabelsVisible}
              />
              <LayerToggle
                label={zh ? "历史地点" : "Historical places"}
                detail={zh ? "显示曾经生活过的公开地点" : "Show published past residencies"}
                count={historicalPlaceCount}
                checked={historicalVisible}
                disabled={!placesVisible || historicalPlaceCount === 0}
                onChange={setHistoricalVisible}
              />
              <LayerToggle
                label={zh ? "熊猫旅程" : "Panda journey"}
                detail={journeyStopCount >= 2 ? (zh ? "按公开居住记录连接旅程" : "Connect published residency records") : (zh ? "在旅行记中选择一只熊猫后可用" : "Available after choosing a panda journey")}
                count={journeyStopCount >= 2 ? journeyStopCount : undefined}
                checked={journeyVisible}
                disabled={journeyStopCount < 2}
                onChange={setJourneyVisible}
              />
            </section>

            <section className={styles.layerSection}>
              <p>{zh ? "野生大熊猫" : "WILD PANDA"}</p>
              <LayerToggle
                label={zh ? "栖息地 / 保护范围" : "Habitat / protected range"}
                detail={polygonFeatures.length ? (zh ? "当前公开的空间范围" : "Published spatial ranges") : (zh ? "当前模式没有可用范围" : "No ranges in this mode")}
                count={polygonFeatures.length || undefined}
                checked={habitatVisible}
                disabled={polygonFeatures.length === 0}
                onChange={setHabitatVisible}
              />
              {polygonFeatures.length && habitatVisible ? (
                <label className={styles.opacityControl}>
                  <span><strong>{zh ? "范围透明度" : "Range opacity"}</strong><em>{habitatOpacity}%</em></span>
                  <input
                    type="range"
                    min="10"
                    max="80"
                    step="5"
                    value={habitatOpacity}
                    onChange={(event) => setHabitatOpacity(Number(event.target.value))}
                  />
                </label>
              ) : null}
            </section>

            <section className={styles.layerSection}>
              <p>{zh ? "底图" : "BASE MAP"}</p>
              <div className={styles.basemapList}>
                {basemapOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={styles.basemapOption}
                    data-active={basemapId === option.id ? "true" : undefined}
                    data-basemap={option.id}
                    onClick={() => switchBasemap(option.id)}
                  >
                    <span className={styles.basemapSwatch} aria-hidden="true" />
                    <span className={styles.basemapCopy}>
                      <strong>{option.label}</strong>
                      <small>{option.note}</small>
                    </span>
                    {basemapId === option.id ? <Check aria-hidden="true" /> : null}
                  </button>
                ))}
              </div>
            </section>
            <p className={styles.layersFoot}>{zh ? "公开地点不代表实时定位。空间图层由 ZhiPanda 数据驱动，底图由 CARTO / OpenStreetMap 提供。" : "Published places are not live tracking. Spatial layers are driven by ZhiPanda data; the basemap is CARTO / OpenStreetMap."}</p>
          </aside>
        ) : null}

        {!(mode === "individual" && focus && !selected && timelineBounds) ? (
          <div className={styles.mapLegend}>
            <span data-state={mapStatus}>{mapStatus === "loading" ? (zh ? "地图加载中" : "Loading map") : mapStatus === "degraded" ? (zh ? "底图部分不可用" : "Basemap partially unavailable") : (zh ? "公开地点" : "Published places")}</span>
            <small>{zh ? "CARTO · 非实时定位" : "CARTO · not live tracking"}</small>
          </div>
        ) : null}

        {mode === "individual" && !focus ? (
          <div className={styles.journeyHint}>
            <RouteIcon aria-hidden="true" />
            <span><strong>{zh ? "先找一只熊猫" : "Find a panda first"}</strong><small>{zh ? "输入名字后，地图会把公开居住地点串成旅程。" : "Search a name and the map will connect its published residencies."}</small></span>
          </div>
        ) : null}

        {mode === "individual" && focus && !selected && timelineBounds && timelineYear !== null ? (
          <section className={styles.timelinePanel} aria-label={zh ? "熊猫旅程时间轴" : "Panda journey timeline"}>
            <div className={styles.timelineHead}>
              <span>
                <strong>{timelineResidencies[0]?.people[0]?.name ?? focus}</strong>
                <small>{zh ? `截至 ${timelineYear} 年的公开居住记录` : `Published residencies through ${timelineYear}`}</small>
              </span>
              <em>{timelineYear}</em>
            </div>
            <div className={styles.timelineBody}>
              <div className={styles.timelineTransport}>
                <button type="button" onClick={() => stepTimeline(-1)} disabled={timelineYear <= timelineBounds.min} aria-label={zh ? "上一年" : "Previous year"}><ChevronLeft /></button>
                <button type="button" className={styles.timelinePlay} onClick={toggleTimelinePlayback} aria-label={timelinePlaying ? (zh ? "暂停时间轴" : "Pause timeline") : (zh ? "播放时间轴" : "Play timeline")}>
                  {timelinePlaying ? <Pause /> : <Play />}
                </button>
                <button type="button" onClick={() => stepTimeline(1)} disabled={timelineYear >= timelineBounds.max} aria-label={zh ? "下一年" : "Next year"}><ChevronRight /></button>
              </div>
              <div className={styles.timelineRail}>
                <div className={styles.timelineStopMarks}>
                  {timelineResidencies.map((item) => {
                    const startYear = yearFromIsoDate(item.startDate);
                    if (startYear === null) return null;
                    const width = Math.max(1, timelineBounds.max - timelineBounds.min);
                    const left = ((startYear - timelineBounds.min) / width) * 100;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-active={startYear <= timelineYear ? "true" : undefined}
                        style={{ left: `${left}%` }}
                        title={`${startYear} · ${item.placeLabel}`}
                        aria-label={zh ? `${startYear} 年迁居记录：${item.placeLabel}` : `${startYear} residency event: ${item.placeLabel}`}
                        onClick={() => {
                          setTimelinePlaying(false);
                          setTimelineYear(startYear);
                          if (item.coordinate) {
                            mapRef.current?.easeTo({ center: item.coordinate, zoom: Math.max(mapRef.current.getZoom(), 6), duration: 420 });
                          }
                        }}
                      />
                    );
                  })}
                </div>
                <input
                  type="range"
                  min={timelineBounds.min}
                  max={timelineBounds.max}
                  step="1"
                  value={timelineYear}
                  aria-label={zh ? "旅程年份" : "Journey year"}
                  onChange={(event) => {
                    setTimelinePlaying(false);
                    setTimelineYear(Number(event.target.value));
                  }}
                />
                <div className={styles.timelineYears}><span>{timelineBounds.min}</span><span>{timelineBounds.max}</span></div>
              </div>
            </div>
          </section>
        ) : null}

        {selected ? (
          <article className={styles.selectionCard}>
            <div className={styles.selectionTop}>
              <PeopleStack people={selected.people} />
              <button
                type="button"
                onClick={() => router.push(workspaceHref(routeBase, snapshot, mode, { focus }) as Route, { scroll: false })}
                aria-label={zh ? "关闭详情" : "Close details"}
              >
                <X />
              </button>
            </div>
            <p>{selected.status === "current" ? (zh ? "当前公开" : "Current") : (zh ? "历史记录" : "Historical")}</p>
            <h2>{selected.title}</h2>
            <span>{selected.placeLabel}</span>
            <strong>{selected.statusDetail}</strong>
            {selected.dateRange ? <small>{selected.dateRange}</small> : null}
            {selected.kind === "institution" && selected.people.length ? (
              <div className={styles.selectionPeopleGroups}>
                {selectedCurrentPeople.length ? (
                  <section>
                    <div className={styles.selectionPeopleGroupHead}>
                      <strong>{zh ? "现在生活在这里" : "Living here now"}</strong>
                      <span>{selectedCurrentPeople.length}</span>
                    </div>
                    <div className={styles.selectionPeople}>
                      {selectedCurrentPeople.map((person) => (
                        <Link key={person.id} href={`/${locale}/prototype/fan-v07/panda/${person.slug}` as Route}>
                          {person.imageUrl ? <img src={person.imageUrl} alt="" /> : <span className={styles.personFallback}>{person.name.slice(0, 1)}</span>}
                          <span>{person.name}</span>
                        </Link>
                      ))}
                    </div>
                  </section>
                ) : null}
                {selectedHistoricalPeople.length ? (
                  <section>
                    <div className={styles.selectionPeopleGroupHead}>
                      <strong>{zh ? "曾经生活在这里" : "Lived here before"}</strong>
                      <span>{selectedHistoricalPeople.length}</span>
                    </div>
                    <div className={styles.selectionPeople}>
                      {selectedHistoricalPeople.map((person) => (
                        <Link key={person.id} href={`/${locale}/prototype/fan-v07/panda/${person.slug}` as Route}>
                          {person.imageUrl ? <img src={person.imageUrl} alt="" /> : <span className={styles.personFallback}>{person.name.slice(0, 1)}</span>}
                          <span>{person.name}</span>
                        </Link>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : null}
            {selected.primaryHref ? <Link className={styles.primaryAction} href={selected.primaryHref as Route}>{zh ? "继续探索" : "Keep exploring"}<span aria-hidden="true">→</span></Link> : null}
          </article>
        ) : null}
      </div>
    </section>
  );
}
