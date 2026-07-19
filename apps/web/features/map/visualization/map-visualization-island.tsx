"use client";

import "@/styles/third-party/maplibre.css";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { Map as MapLibreMapClass, setWorkerUrl } from "@/features/map/visualization/maplibre-source-runtime.js";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-csp-worker.js?maplibre-worker";
import { structuredMapHref, type StructuredMapQueryState } from "@/features/map/map-query";
import { applyMapViewport, prefersReducedMapMotion } from "@/features/map/visualization/map-camera-preferences";
import {
  installMapResultLayers,
  MAP_INTERACTIVE_LAYER_IDS,
  synchronizeSelectedMapLayers,
} from "@/features/map/visualization/map-layer-model";
import { createMapProviderStyle, mapProviderAttribution, MAP_VISUAL_SOURCE_ID } from "@/features/map/visualization/map-provider-adapter";
import { createMapQueryScheduler, percentile95 } from "@/features/map/visualization/map-query-scheduler";
import type { MapVisualFeature, MapVisualizationModel } from "@/features/map/visualization/map-visual-model";
import {
  defaultMapViewport,
  parseMapViewport,
  serializeMapViewport,
  type MapViewportState,
} from "@/features/map/visualization/map-viewport-domain";
import type { PublicLocale } from "@/foundation/content/locales";

interface MapVisualizationIslandProps {
  locale: PublicLocale;
  state: StructuredMapQueryState;
  model: MapVisualizationModel;
  loadingLabel: string;
  onMount: () => void;
}

type ProviderStatus = "loading" | "ready" | "degraded" | "offline" | "recovering";

const copy = {
  zh: {
    regionLabel: "交互式地图可视增强",
    providerReady: "地图服务已连接",
    providerDegraded: "部分地图资源不可用；结构化列表保持完整。",
    providerOffline: "当前离线；结构化列表保持完整。",
    providerRecovering: "网络已恢复，正在重新请求地图资源。",
    choose: "非拖拽选择",
    choosePlaceholder: "选择一个地图对象",
    select: "选择并同步详情",
    zoomIn: "放大",
    zoomOut: "缩小",
    reset: "重置视野",
    selected: "地图已同步选择",
    hovered: "地图对象",
    scheduler: "视野同步 p95",
  },
  en: {
    regionLabel: "Interactive map visualization enhancement",
    providerReady: "Map provider connected",
    providerDegraded: "Some map resources are unavailable; the structured list remains complete.",
    providerOffline: "Offline; the structured list remains complete.",
    providerRecovering: "Network restored; requesting map resources again.",
    choose: "Non-drag selection",
    choosePlaceholder: "Choose a map object",
    select: "Select and synchronize details",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    reset: "Reset view",
    selected: "Map selection synchronized",
    hovered: "Map object",
    scheduler: "Viewport synchronization p95",
  },
} as const;

function geometryBounds(feature: MapVisualFeature): [[number, number], [number, number]] | null {
  if (feature.geometry.type === "Point") {
    const [longitude, latitude] = feature.geometry.coordinates;
    return [[longitude, latitude], [longitude, latitude]];
  }
  const coordinates: number[][] = [];
  const visit = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      coordinates.push([value[0], value[1]]);
      return;
    }
    for (const item of value) visit(item);
  };
  if (feature.geometry.type === "GeometryCollection") {
    for (const geometry of feature.geometry.geometries) {
      if (geometry.type === "GeometryCollection") {
        for (const child of geometry.geometries) {
          if (child.type !== "GeometryCollection") visit(child.coordinates);
        }
      } else {
        visit(geometry.coordinates);
      }
    }
  } else {
    visit(feature.geometry.coordinates);
  }
  if (!coordinates.length) return null;
  const longitudes = coordinates.map(([longitude]) => longitude);
  const latitudes = coordinates.map(([, latitude]) => latitude);
  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ];
}

function currentViewport(map: MapLibreMap): MapViewportState {
  const center = map.getCenter();
  return { longitude: center.lng, latitude: center.lat, zoom: map.getZoom() };
}

export function MapVisualizationIsland({ locale, state, model, loadingLabel, onMount }: MapVisualizationIslandProps) {
  const t = copy[locale];
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const initialStateRef = useRef(state);
  const initialModelRef = useRef(model);
  const stateRef = useRef(state);
  const modelRef = useRef(model);
  const suppressViewportRef = useRef(false);
  const viewportCommitRef = useRef(false);
  const schedulerRef = useRef(createMapQueryScheduler());
  const synchronizeButtonRef = useRef<HTMLButtonElement | null>(null);
  const pendingAlternativeFocusRef = useRef(false);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>("loading");
  const [hovered, setHovered] = useState<string | null>(null);
  const [draftChoice, setDraftChoice] = useState("");
  const [queryP95, setQueryP95] = useState<number | null>(null);

  useEffect(() => onMount(), [onMount]);

  const featureById = useMemo(
    () => new Map(model.collection.features.map((feature) => [feature.properties.id, feature])),
    [model.collection.features],
  );

  useEffect(() => {
    stateRef.current = state;
    schedulerRef.current.cancel();
  }, [state]);

  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  useEffect(() => {
    if (!pendingAlternativeFocusRef.current || !state.selected) return;
    const frame = window.requestAnimationFrame(() => {
      synchronizeButtonRef.current?.focus();
      pendingAlternativeFocusRef.current = false;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [state.selected]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let disposed = false;
    const scheduler = schedulerRef.current;
    const initialState = initialStateRef.current;
    const initialModel = initialModelRef.current;
    const initialViewport = initialState.view
      ? parseMapViewport(initialState.view, initialState.mode)
      : defaultMapViewport(initialState.mode);

    setWorkerUrl(maplibreWorkerUrl);
    const map = new MapLibreMapClass({
      container: containerRef.current,
      style: createMapProviderStyle(initialModel),
      center: [initialViewport.longitude, initialViewport.latitude],
      zoom: initialViewport.zoom,
      minZoom: 2,
      maxZoom: 12,
      attributionControl: {
        compact: false,
        customAttribution: mapProviderAttribution(),
      },
      cooperativeGestures: true,
    });
    mapRef.current = map;

      const updateOnlineState = () => {
        if (!navigator.onLine) {
          setProviderStatus("offline");
          return;
        }
        setProviderStatus((current) => current === "offline" ? "recovering" : current);
        map.triggerRepaint();
      };
      window.addEventListener("online", updateOnlineState);
      window.addEventListener("offline", updateOnlineState);

      map.on("load", () => {
        if (disposed) return;
        installMapResultLayers(map);
        const source = map.getSource(MAP_VISUAL_SOURCE_ID) as GeoJSONSource | undefined;
        source?.setData(modelRef.current.collection);
        synchronizeSelectedMapLayers(map, stateRef.current.selected);
        map.getCanvas().setAttribute("role", "region");
        map.getCanvas().setAttribute("aria-label", t.regionLabel);
        setProviderStatus(navigator.onLine ? "ready" : "offline");
        map.resize();
      });

      map.on("error", () => {
        if (!disposed) setProviderStatus(navigator.onLine ? "degraded" : "offline");
      });

      map.on("movestart", (event) => {
        const originalEvent = (event as { originalEvent?: unknown }).originalEvent;
        if (originalEvent) viewportCommitRef.current = true;
      });

      map.on("moveend", () => {
        if (disposed || suppressViewportRef.current) {
          suppressViewportRef.current = false;
          viewportCommitRef.current = false;
          return;
        }
        if (!viewportCommitRef.current) return;
        viewportCommitRef.current = false;
        scheduler.schedule(() => {
          const view = serializeMapViewport(currentViewport(map));
          if (view === stateRef.current.view) return;
          setQueryP95(percentile95(scheduler.samples()));
          router.replace(
            structuredMapHref(locale, { ...stateRef.current, view }) as Route,
            { scroll: false },
          );
        });
      });

      for (const layerId of MAP_INTERACTIVE_LAYER_IDS) {
        map.on("mouseenter", layerId, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layerId, () => {
          map.getCanvas().style.cursor = "";
          setHovered(null);
        });
        map.on("mousemove", layerId, (event) => {
          const title = event.features?.[0]?.properties?.title;
          setHovered(typeof title === "string" ? title : null);
        });
        map.on("click", layerId, (event) => {
          const features = map.queryRenderedFeatures(event.point, { layers: [...MAP_INTERACTIVE_LAYER_IDS] });
          const ids = [...new Set(features.flatMap((feature) => {
            const id = feature.properties?.id;
            return typeof id === "string" ? [id] : [];
          }))];
          if (!ids.length) return;
          const selectedIndex = ids.indexOf(stateRef.current.selected);
          const nextId = ids[(selectedIndex + 1) % ids.length];
          const nextFeature = modelRef.current.collection.features.find((feature) => feature.properties.id === nextId);
          if (nextFeature) router.push(nextFeature.properties.href as Route, { scroll: false });
        });
      }

      const resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(containerRef.current);

    return () => {
      disposed = true;
      scheduler.cancel();
      resizeObserver.disconnect();
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
      map.remove();
      mapRef.current = null;
    };
  }, [locale, router, t.regionLabel]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource(MAP_VISUAL_SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(model.collection);
  }, [model.collection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    synchronizeSelectedMapLayers(map, state.selected);
    if (!state.selected) return;
    const selected = featureById.get(state.selected);
    if (!selected) return;
    const bounds = geometryBounds(selected);
    if (!bounds) return;
    suppressViewportRef.current = true;
    if (selected.geometry.type === "Point") {
      const [longitude, latitude] = selected.geometry.coordinates;
      applyMapViewport(map, {
        longitude,
        latitude,
        zoom: Math.max(map.getZoom(), state.mode === "wild" ? 6.2 : 7),
      });
      return;
    }
    map.fitBounds(bounds, {
      padding: 64,
      maxZoom: 8,
      duration: prefersReducedMapMotion() ? 0 : 480,
      essential: false,
    });
  }, [featureById, state.mode, state.selected]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const target = state.view
      ? parseMapViewport(state.view, state.mode)
      : defaultMapViewport(state.mode);
    const targetValue = serializeMapViewport(target);
    const current = serializeMapViewport(currentViewport(map));
    if (current === targetValue) return;
    suppressViewportRef.current = true;
    applyMapViewport(map, target, { animate: false });
  }, [state.mode, state.view]);

  const providerMessage = providerStatus === "ready"
    ? t.providerReady
    : providerStatus === "offline"
      ? t.providerOffline
      : providerStatus === "recovering"
        ? t.providerRecovering
        : providerStatus === "degraded"
          ? t.providerDegraded
          : loadingLabel;

  const choice = draftChoice || state.selected;
  const selectChoice = () => {
    const feature = featureById.get(choice);
    if (!feature) return;
    pendingAlternativeFocusRef.current = true;
    setDraftChoice("");
    router.push(feature.properties.href as Route, { scroll: false });
  };

  return (
    <div
      className="pa-map-visualization-island"
      data-testid="map-visualization-island"
      data-provider-status={providerStatus}
      data-reduced-motion={prefersReducedMapMotion() ? "true" : "false"}
    >
      <div className="pa-map-visualization-status" role="status">
        <span>{providerMessage}</span>
        {hovered ? <span>{t.hovered}: {hovered}</span> : null}
        {state.selected ? <span>{t.selected}: {featureById.get(state.selected)?.properties.title ?? state.selected}</span> : null}
        {queryP95 !== null ? <span data-testid="map-query-p95">{t.scheduler}: {Math.round(queryP95)} ms</span> : null}
      </div>

      <div className="pa-map-visualization-canvas-wrap">
        <div ref={containerRef} className="pa-map-visualization-canvas" aria-label={t.regionLabel} />
        <div className="pa-map-visualization-controls" aria-label={t.regionLabel}>
          <button
            type="button"
            onClick={() => {
              const map = mapRef.current;
              if (!map) return;
              viewportCommitRef.current = true;
              map.zoomIn({ duration: prefersReducedMapMotion() ? 0 : 220 });
            }}
          >
            {t.zoomIn}
          </button>
          <button
            type="button"
            onClick={() => {
              const map = mapRef.current;
              if (!map) return;
              viewportCommitRef.current = true;
              map.zoomOut({ duration: prefersReducedMapMotion() ? 0 : 220 });
            }}
          >
            {t.zoomOut}
          </button>
          <button
            type="button"
            onClick={() => {
              const map = mapRef.current;
              if (!map) return;
              suppressViewportRef.current = true;
              applyMapViewport(map, defaultMapViewport(state.mode));
              router.replace(
                structuredMapHref(locale, { ...stateRef.current, view: "" }) as Route,
                { scroll: false },
              );
            }}
          >
            {t.reset}
          </button>
        </div>
      </div>

      <p className="pa-map-visualization-attribution">
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
        <span aria-hidden="true"> · </span>
        <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">© CARTO</a>
      </p>

      <div className="pa-map-visualization-alternative">
        <label>
          <span>{t.choose}</span>
          <select value={choice} onChange={(event) => setDraftChoice(event.target.value)}>
            <option value="">{t.choosePlaceholder}</option>
            {model.collection.features.map((feature) => (
              <option key={feature.properties.id} value={feature.properties.id}>
                {feature.properties.title} · {feature.properties.subtitle}
              </option>
            ))}
          </select>
        </label>
        <button ref={synchronizeButtonRef} type="button" onClick={selectChoice} disabled={!choice}>{t.select}</button>
      </div>
    </div>
  );
}
