"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap, PaddingOptions } from "maplibre-gl";
import type { AtlasItem, AtlasModeMeta } from "@/lib/panda-atlas";
import type {
  DistributionFeatureProperties,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  HabitatFeatureProperties
} from "@/lib/types";
import {
  atlasViewLabel,
  buildNetworkFeatureCollection,
  buildPointFeatureCollection,
  buildSelectedPointCollection,
  buildSelectedRegionCollection,
  formatDateLabel,
  geometryToBounds,
  modeSurfaceHint,
  type SummaryBarItem
} from "./helpers";
import { createMapViewport, type MapViewport } from "./map-viewport";
import { MapOverlay } from "./map-overlay";
import { MapSummaryBar } from "./map-summary-bar";

interface MapStageProps {
  modeMeta: AtlasModeMeta;
  distribution: GeoJsonFeatureCollection<DistributionFeatureProperties>;
  habitats: GeoJsonFeatureCollection<HabitatFeatureProperties & { atlas_id: string }>;
  wildRegionItems: AtlasItem[];
  domesticItems: AtlasItem[];
  overseasItems: AtlasItem[];
  selectedItem: AtlasItem | null;
  selectedSnapshotDate: string;
  summaryItems: SummaryBarItem[];
  isUpdating: boolean;
  focusSignal: number;
  resetSignal: number;
  detailOpen: boolean;
  sheetOpen: boolean;
  onSelectItem: (item: AtlasItem | null) => void;
  onViewportChange: (viewport: MapViewport) => void;
  onRequestResetView: () => void;
}

interface HoverCardState {
  x: number;
  y: number;
  title: string;
  subtitle: string;
}

const EMPTY_COLLECTION: GeoJsonFeatureCollection<Record<string, unknown>> = {
  type: "FeatureCollection",
  features: []
};

function tileUrl(): string {
  return process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png";
}

function asGeoJsonData<TProperties extends Record<string, unknown>>(
  featureCollection: GeoJsonFeatureCollection<TProperties>
): FeatureCollection<Geometry, GeoJsonProperties> {
  return featureCollection as unknown as FeatureCollection<Geometry, GeoJsonProperties>;
}

function readAtlasId(feature: { id?: string | number; properties?: Record<string, unknown> } | undefined): string | null {
  if (!feature) {
    return null;
  }

  if (typeof feature.properties?.atlas_id === "string") {
    return feature.properties.atlas_id;
  }

  return typeof feature.id === "string" ? feature.id : null;
}

function resolveCameraPadding(detailOpen: boolean, sheetOpen: boolean): PaddingOptions {
  const desktop = typeof window === "undefined" ? true : window.innerWidth >= 1024;

  return {
    top: 96,
    right: desktop && detailOpen ? 420 : 72,
    bottom: desktop ? (sheetOpen ? 300 : 132) : detailOpen || sheetOpen ? 272 : 124,
    left: desktop ? 72 : 40
  };
}

function readMapViewport(map: MapLibreMap): MapViewport {
  const bounds = map.getBounds();
  return createMapViewport(
    {
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth()
    },
    map.getZoom()
  );
}

export function MapStage({
  modeMeta,
  distribution,
  habitats,
  wildRegionItems,
  domesticItems,
  overseasItems,
  selectedItem,
  selectedSnapshotDate,
  summaryItems,
  isUpdating,
  focusSignal,
  resetSignal,
  detailOpen,
  sheetOpen,
  onSelectItem,
  onViewportChange,
  onRequestResetView
}: MapStageProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const styleReadyRef = useRef(false);
  const viewportTimeoutRef = useRef<number | null>(null);
  const [hoverCard, setHoverCard] = useState<HoverCardState | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const showWildBackdrop = modeMeta.distributionLayer === "wild";

  const visibleDistribution = showWildBackdrop ? distribution : EMPTY_COLLECTION;
  const visibleHabitats = modeMeta.showHabitats ? habitats : EMPTY_COLLECTION;
  const domesticFeatureCollection = useMemo(() => buildPointFeatureCollection(domesticItems), [domesticItems]);
  const overseasFeatureCollection = useMemo(() => buildPointFeatureCollection(overseasItems), [overseasItems]);
  const networkFeatureCollection = useMemo(
    () => buildNetworkFeatureCollection(modeMeta.value, domesticItems, overseasItems),
    [domesticItems, modeMeta.value, overseasItems]
  );
  const selectedPointCollection = useMemo(() => buildSelectedPointCollection(selectedItem), [selectedItem]);
  const habitatById = useMemo(
    () =>
      new Map(
        habitats.features.map((feature) => [
          feature.properties.atlas_id,
          feature as GeoJsonFeature<HabitatFeatureProperties & { atlas_id: string }>
        ])
      ),
    [habitats]
  );
  const selectedRegionCollection = useMemo(
    () => buildSelectedRegionCollection(selectedItem, habitatById),
    [selectedItem, habitatById]
  );
  const fallbackItems = useMemo(
    () => [...wildRegionItems, ...domesticItems, ...overseasItems],
    [domesticItems, overseasItems, wildRegionItems]
  );
  const itemById = useMemo(
    () => new Map([...wildRegionItems, ...domesticItems, ...overseasItems].map((item) => [item.id, item])),
    [wildRegionItems, domesticItems, overseasItems]
  );

  const initialSourcesRef = useRef({
    distribution: visibleDistribution,
    habitats: visibleHabitats,
    domestic: domesticFeatureCollection,
    overseas: overseasFeatureCollection,
    network: networkFeatureCollection,
    selectedPoint: selectedPointCollection,
    selectedRegion: selectedRegionCollection
  });
  const itemByIdRef = useRef(itemById);
  const habitatByIdRef = useRef(habitatById);
  const onSelectItemRef = useRef(onSelectItem);
  const onViewportChangeRef = useRef(onViewportChange);
  const modeMetaRef = useRef(modeMeta);

  useEffect(() => {
    itemByIdRef.current = itemById;
  }, [itemById]);

  useEffect(() => {
    habitatByIdRef.current = habitatById;
  }, [habitatById]);

  useEffect(() => {
    onSelectItemRef.current = onSelectItem;
  }, [onSelectItem]);

  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  useEffect(() => {
    modeMetaRef.current = modeMeta;
  }, [modeMeta]);

  useEffect(() => {
    if (!mapContainerRef.current) {
      return;
    }

    const map = mapRef.current;
    const container = mapContainerRef.current;
    const resize = () => map?.resize();

    const resizeObserver = new ResizeObserver(() => {
      resize();
    });

    resizeObserver.observe(container);
    window.addEventListener("resize", resize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let startupTimeoutId: number | null = null;

    function scheduleViewportChange(map: MapLibreMap) {
      if (viewportTimeoutRef.current !== null) {
        window.clearTimeout(viewportTimeoutRef.current);
      }
      viewportTimeoutRef.current = window.setTimeout(() => {
        viewportTimeoutRef.current = null;
        if (!disposed) {
          try {
            onViewportChangeRef.current(readMapViewport(map));
          } catch {
            // Ignore transient invalid bounds while MapLibre settles a camera transition.
          }
        }
      }, 250);
    }

    async function bootstrap() {

      if (!mapContainerRef.current || mapRef.current) {
        return;
      }

      const maplibregl = await import("maplibre-gl");
      if (!mapContainerRef.current || disposed) {
        return;
      }

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        attributionControl: false,
        style: {
          version: 8,
          sources: {
            basemap: {
              type: "raster",
              tiles: [tileUrl()],
              tileSize: 256
            },
            "wild-distribution": {
              type: "geojson",
              data: asGeoJsonData(initialSourcesRef.current.distribution)
            },
            habitats: {
              type: "geojson",
              data: asGeoJsonData(initialSourcesRef.current.habitats)
            },
            domestic: {
              type: "geojson",
              data: asGeoJsonData(initialSourcesRef.current.domestic)
            },
            overseas: {
              type: "geojson",
              data: asGeoJsonData(initialSourcesRef.current.overseas)
            },
            network: {
              type: "geojson",
              data: asGeoJsonData(initialSourcesRef.current.network)
            },
            "selected-point": {
              type: "geojson",
              data: asGeoJsonData(initialSourcesRef.current.selectedPoint)
            },
            "selected-region": {
              type: "geojson",
              data: asGeoJsonData(initialSourcesRef.current.selectedRegion)
            }
          },
          layers: [
            {
              id: "basemap",
              type: "raster",
              source: "basemap",
              paint: {
                "raster-saturation": -0.42,
                "raster-contrast": 0.06,
                "raster-brightness-min": 0.1,
                "raster-brightness-max": 0.97
              }
            },
            {
              id: "wild-distribution-fill",
              type: "fill",
              source: "wild-distribution",
              paint: {
                "fill-color": [
                  "interpolate",
                  ["linear"],
                  ["coalesce", ["to-number", ["get", "density"]], 0],
                  0,
                  "#E6EFE2",
                  4,
                  "#C7DABD",
                  8,
                  "#8EAF86",
                  14,
                  "#4F7657"
                ],
                "fill-opacity": 0.52
              }
            },
            {
              id: "wild-distribution-outline",
              type: "line",
              source: "wild-distribution",
              paint: {
                "line-color": "#59735E",
                "line-width": 1,
                "line-opacity": 0.22
              }
            },
            {
              id: "habitats-fill",
              type: "fill",
              source: "habitats",
              paint: {
                "fill-color": "#58725C",
                "fill-opacity": 0.1
              }
            },
            {
              id: "habitats-outline",
              type: "line",
              source: "habitats",
              paint: {
                "line-color": "#57705A",
                "line-width": 1.1,
                "line-opacity": 0.42,
                "line-dasharray": [3, 2]
              }
            },
            {
              id: "network-lines",
              type: "line",
              source: "network",
              paint: {
                "line-color": [
                  "case",
                  ["==", ["get", "tone"], "overseas"],
                  "#7EA6E3",
                  "#D09D63"
                ],
                "line-width": [
                  "case",
                  ["==", ["get", "tone"], "overseas"],
                  1.8,
                  1.5
                ],
                "line-opacity": 0.4,
                "line-dasharray": [3, 3]
              }
            },
            {
              id: "domestic-points",
              type: "circle",
              source: "domestic",
              paint: {
                "circle-radius": ["case", ["==", ["get", "featured"], 1], 7.5, 6],
                "circle-color": "#C98A45",
                "circle-stroke-color": "#FFF8EE",
                "circle-stroke-width": 1.8,
                "circle-opacity": 0.98
              }
            },
            {
              id: "overseas-points",
              type: "circle",
              source: "overseas",
              paint: {
                "circle-radius": ["case", ["==", ["get", "featured"], 1], 7.5, 6],
                "circle-color": "#4E86D8",
                "circle-stroke-color": "#F7FBFF",
                "circle-stroke-width": 1.8,
                "circle-opacity": 0.98
              }
            },
            {
              id: "selected-region-fill",
              type: "fill",
              source: "selected-region",
              paint: {
                "fill-color": "#D2A366",
                "fill-opacity": 0.2
              }
            },
            {
              id: "selected-region-outline",
              type: "line",
              source: "selected-region",
              paint: {
                "line-color": "#866033",
                "line-width": 2.8,
                "line-opacity": 0.95
              }
            },
            {
              id: "selected-point-glow",
              type: "circle",
              source: "selected-point",
              paint: {
                "circle-radius": 18,
                "circle-color": "rgba(210, 163, 102, 0.16)"
              }
            },
            {
              id: "selected-point-ring",
              type: "circle",
              source: "selected-point",
              paint: {
                "circle-radius": 11,
                "circle-color": "rgba(210, 163, 102, 0.12)",
                "circle-stroke-color": "#866033",
                "circle-stroke-width": 2
              }
            },
            {
              id: "selected-point-core",
              type: "circle",
              source: "selected-point",
              paint: {
                "circle-radius": 6,
                "circle-color": [
                  "case",
                  ["==", ["get", "region"], "overseas"],
                  "#4E86D8",
                  "#C98A45"
                ],
                "circle-stroke-color": "#FFF8EE",
                "circle-stroke-width": 1.5
              }
            }
          ]
        },
        center: [104.5, 31.2],
        zoom: 4.8,
        minZoom: 2.1,
        maxZoom: 9.5
      });

      mapRef.current = map;
      startupTimeoutId = window.setTimeout(() => {
        if (!disposed && !styleReadyRef.current) {
          setMapError("地图无法加载，以下文字列表仍可浏览和选择当前结果。");
        }
      }, 4000);
      map.on("moveend", () => scheduleViewportChange(map));

      map.on("load", () => {
        if (startupTimeoutId !== null) {
          window.clearTimeout(startupTimeoutId);
          startupTimeoutId = null;
        }
        styleReadyRef.current = true;
        setMapError(null);
        setIsMapReady(true);
        map.resize();

        map.fitBounds(modeMetaRef.current.bounds, {
          padding: resolveCameraPadding(false, false),
          duration: 900,
          maxZoom: modeMetaRef.current.value === "global" ? 3.9 : 6.9
        });

        for (const layerId of ["habitats-fill", "domestic-points", "overseas-points"]) {
          map.on("mouseenter", layerId, () => {
            map.getCanvas().style.cursor = "pointer";
          });

          map.on("mouseleave", layerId, () => {
            map.getCanvas().style.cursor = "";
            setHoverCard(null);
          });

          map.on("mousemove", layerId, (event) => {
            const atlasId = readAtlasId(
              event.features?.[0] as { id?: string | number; properties?: Record<string, unknown> }
            );
            if (!atlasId) {
              setHoverCard(null);
              return;
            }

            const item = itemByIdRef.current.get(atlasId);
            if (!item) {
              setHoverCard(null);
              return;
            }

            setHoverCard({
              x: event.point.x,
              y: event.point.y,
              title: item.name,
              subtitle: item.kind === "wild_region" ? "野生分布区" : item.kindLabel
            });
          });

          map.on("click", layerId, (event) => {
            const atlasId = readAtlasId(
              event.features?.[0] as { id?: string | number; properties?: Record<string, unknown> }
            );
            onSelectItemRef.current(atlasId ? itemByIdRef.current.get(atlasId) ?? null : null);
          });
        }
      });
    }

    void bootstrap().catch(() => {
      if (startupTimeoutId !== null) {
        window.clearTimeout(startupTimeoutId);
        startupTimeoutId = null;
      }
      if (!disposed) {
        setMapError("地图无法加载，以下文字列表仍可浏览和选择当前结果。");
        setIsMapReady(false);
      }
    });

    return () => {
      disposed = true;
      if (startupTimeoutId !== null) {
        window.clearTimeout(startupTimeoutId);
        startupTimeoutId = null;
      }
      if (viewportTimeoutRef.current !== null) {
        window.clearTimeout(viewportTimeoutRef.current);
        viewportTimeoutRef.current = null;
      }
      mapRef.current?.remove();
      mapRef.current = null;
      styleReadyRef.current = false;
      setIsMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) {
      return;
    }

    (map.getSource("wild-distribution") as GeoJSONSource | undefined)?.setData(asGeoJsonData(visibleDistribution));
  }, [visibleDistribution]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) {
      return;
    }

    (map.getSource("habitats") as GeoJSONSource | undefined)?.setData(asGeoJsonData(visibleHabitats));
  }, [visibleHabitats]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) {
      return;
    }

    (map.getSource("domestic") as GeoJSONSource | undefined)?.setData(asGeoJsonData(domesticFeatureCollection));
  }, [domesticFeatureCollection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) {
      return;
    }

    (map.getSource("overseas") as GeoJSONSource | undefined)?.setData(asGeoJsonData(overseasFeatureCollection));
  }, [overseasFeatureCollection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) {
      return;
    }

    (map.getSource("network") as GeoJSONSource | undefined)?.setData(asGeoJsonData(networkFeatureCollection));
  }, [networkFeatureCollection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) {
      return;
    }

    (map.getSource("selected-point") as GeoJSONSource | undefined)?.setData(asGeoJsonData(selectedPointCollection));
  }, [selectedPointCollection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) {
      return;
    }

    (map.getSource("selected-region") as GeoJSONSource | undefined)?.setData(asGeoJsonData(selectedRegionCollection));
  }, [selectedRegionCollection]);

  useEffect(() => {
    if (!isMapReady || !selectedItem) {
      return;
    }

    const map = mapRef.current;
    if (!map || !styleReadyRef.current) {
      return;
    }

    const padding = resolveCameraPadding(detailOpen, sheetOpen);

    if (selectedItem.kind === "wild_region") {
      const habitat = habitatByIdRef.current.get(selectedItem.id);
      const bounds = geometryToBounds(habitat?.geometry);

      if (bounds) {
        map.fitBounds(bounds, {
          padding,
          duration: 900,
          maxZoom: 7.2
        });
        return;
      }
    }

    map.flyTo({
      center: selectedItem.coordinates,
      zoom: selectedItem.region === "overseas" ? 5.8 : 7.1,
      padding,
      duration: 900,
      essential: true
    });
  }, [detailOpen, focusSignal, isMapReady, selectedItem, sheetOpen]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) {
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      map.resize();
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [detailOpen, isMapReady, modeMeta.value, sheetOpen]);

  useEffect(() => {
    if (!isMapReady || selectedItem) {
      return;
    }

    const map = mapRef.current;
    if (!map || !styleReadyRef.current) {
      return;
    }

    map.fitBounds(modeMeta.bounds, {
      padding: resolveCameraPadding(detailOpen, sheetOpen),
      duration: 900,
      maxZoom: modeMeta.value === "global" ? 3.9 : 6.9
    });
  }, [detailOpen, isMapReady, modeMeta, resetSignal, selectedItem, sheetOpen]);

  return (
    <section className="relative h-full min-h-0 w-full overflow-hidden bg-[#E5EBE3]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(255,255,255,0.54),transparent_26%),radial-gradient(circle_at_86%_14%,rgba(204,217,205,0.34),transparent_24%),linear-gradient(180deg,rgba(247,246,242,0.12),rgba(231,236,228,0.12))]"
      />
      <div ref={mapContainerRef} className="absolute inset-0" />

      {!isMapReady && !mapError ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="border-y border-[rgba(63,125,72,0.12)] bg-[rgba(250,248,243,0.9)] px-5 py-2 text-[14px] leading-6 text-[#5F6E61]">
            正在准备地图视图
          </div>
        </div>
      ) : null}

      {mapError ? (
        <div
          className="absolute inset-0 z-40 overflow-y-auto bg-[rgba(247,246,242,0.96)] px-6 py-8"
          data-testid="map-text-fallback"
          role="status"
        >
          <div className="mx-auto max-w-2xl">
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#2F6B3B]">文字视图</p>
            <h2 className="mt-2 text-[26px] leading-9 text-[#233126]" style={{ fontFamily: "var(--font-display)" }}>
              地图暂不可用
            </h2>
            <p className="mt-3 text-[14px] leading-7 text-[#5F6E61]">{mapError}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {fallbackItems.length > 0 ? (
                fallbackItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectItem(item)}
                    className="border border-[rgba(63,125,72,0.12)] bg-white/80 px-4 py-3 text-left transition-colors hover:bg-white"
                  >
                    <span className="block text-[14px] font-medium text-[#233126]">{item.name}</span>
                    <span className="mt-1 block text-[12px] leading-5 text-[#6D7C6E]">
                      {item.kind === "wild_region" ? "野生分布区" : item.kindLabel}
                    </span>
                  </button>
                ))
              ) : (
                <p className="text-[14px] leading-7 text-[#5F6E61]">当前筛选条件下没有可显示的对象。</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {hoverCard ? (
        <div
          className="pointer-events-none absolute z-30 max-w-[240px] rounded-[18px] border border-[rgba(63,125,72,0.12)] bg-[rgba(250,248,243,0.96)] px-4 py-3 shadow-[0_18px_28px_rgba(30,40,31,0.12)] backdrop-blur-md"
          style={{
            left: `min(calc(100% - 260px), ${hoverCard.x + 18}px)`,
            top: Math.max(hoverCard.y - 18, 24)
          }}
        >
          <p className="text-[14px] font-medium leading-6 text-[#233126]">{hoverCard.title}</p>
          <p className="text-[12px] leading-5 text-[#6D7C6E]">{hoverCard.subtitle}</p>
        </div>
      ) : null}

      <MapOverlay
        modeLabel={modeMeta.label}
        modeHint={modeSurfaceHint(modeMeta.value)}
        viewLabel={atlasViewLabel(modeMeta.value)}
        snapshotDateLabel={formatDateLabel(selectedSnapshotDate)}
        legend={modeMeta.legend}
        isUpdating={isUpdating}
        detailOpen={detailOpen}
        sheetOpen={sheetOpen}
        onZoomIn={() => mapRef.current?.zoomIn({ duration: 280 })}
        onZoomOut={() => mapRef.current?.zoomOut({ duration: 280 })}
        onResetView={onRequestResetView}
      />

      <MapSummaryBar items={summaryItems} detailOpen={detailOpen} sheetOpen={sheetOpen} />
    </section>
  );
}
