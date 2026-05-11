"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import type { GeoJSONSource, LngLatBoundsLike, Map as MapLibreMap } from "maplibre-gl";
import { Button } from "@/components/ui/button";
import { getDistribution, getOverviewStats } from "@/lib/api-client";
import type {
  DistributionFeatureProperties,
  DistributionLayer,
  GeoJsonFeatureCollection,
  HabitatFeatureProperties,
  OverviewStats
} from "@/lib/types";

interface MapShellProps {
  initialDistribution: GeoJsonFeatureCollection<DistributionFeatureProperties>;
  initialHabitats: GeoJsonFeatureCollection<HabitatFeatureProperties>;
  initialStats: OverviewStats;
  initialLayer: DistributionLayer;
  defaultBBox: string;
  initialSnapshotDate: string;
  availableSnapshotDates: string[];
}

interface HoverCellData {
  cellCode: string;
  density: number | null;
  snapshotDate: string | null;
}

const LAYER_OPTIONS: Array<{
  value: DistributionLayer;
  label: string;
  color: string;
  description: string;
}> = [
  {
    value: "wild",
    label: "野外分布",
    color: "#335c3a",
    description: "展示自然栖息地中的网格密度。"
  },
  {
    value: "captive",
    label: "圈养观察",
    color: "#9a6236",
    description: "展示圈养机构与人工繁育相关网格。"
  },
  {
    value: "protected_area",
    label: "保护地",
    color: "#28595a",
    description: "展示保护地管理范围与重点覆盖单元。"
  },
  {
    value: "corridor",
    label: "生态廊道",
    color: "#635a8a",
    description: "展示潜在迁徙廊道与连通区域。"
  }
];

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function tileUrl(): string {
  return process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
}

function asGeoJsonData<TProperties extends Record<string, unknown>>(
  featureCollection: GeoJsonFeatureCollection<TProperties>
): FeatureCollection<Geometry, GeoJsonProperties> {
  return featureCollection as unknown as FeatureCollection<Geometry, GeoJsonProperties>;
}

function parseDensity(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function parseBbox(bbox: string): LngLatBoundsLike | null {
  const parts = bbox.split(",").map((item) => Number(item.trim()));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }
  return [
    [parts[0], parts[1]],
    [parts[2], parts[3]]
  ];
}

function formatDateLabel(value: string | null | undefined): string {
  if (!value) {
    return "未知";
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return dateFormatter.format(date);
}

export function MapShell({
  initialDistribution,
  initialHabitats,
  initialStats,
  initialLayer,
  defaultBBox,
  initialSnapshotDate,
  availableSnapshotDates
}: MapShellProps) {
  const timelineDates = useMemo(() => {
    const values = new Set<string>(availableSnapshotDates.filter((item) => item.length > 0));
    if (initialSnapshotDate) {
      values.add(initialSnapshotDate);
    }
    if (initialStats.latest_snapshot_date) {
      values.add(initialStats.latest_snapshot_date);
    }
    const sorted = [...values].sort((a, b) => a.localeCompare(b));
    return sorted.length > 0 ? sorted : [new Date().toISOString().slice(0, 10)];
  }, [availableSnapshotDates, initialSnapshotDate, initialStats.latest_snapshot_date]);

  const [activeLayer, setActiveLayer] = useState<DistributionLayer>(initialLayer);
  const [timelineIndex, setTimelineIndex] = useState(() => {
    const index = timelineDates.indexOf(initialSnapshotDate);
    return index >= 0 ? index : Math.max(timelineDates.length - 1, 0);
  });
  const [distribution, setDistribution] = useState(initialDistribution);
  const [stats, setStats] = useState(initialStats);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<HoverCellData | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const skipInitialSyncRef = useRef(true);
  const selectedSnapshotDateRef = useRef(initialSnapshotDate);

  const selectedSnapshotDate = timelineDates[timelineIndex] ?? initialSnapshotDate;
  const selectedLayerMeta =
    LAYER_OPTIONS.find((option) => option.value === activeLayer) ?? LAYER_OPTIONS[0];

  const visibleCellCount = distribution.features.length;
  const averageDensity = useMemo(() => {
    const densities = distribution.features
      .map((feature) => parseDensity(feature.properties.density))
      .filter((density): density is number => density !== null);
    if (densities.length === 0) {
      return null;
    }
    const total = densities.reduce((sum, value) => sum + value, 0);
    return total / densities.length;
  }, [distribution]);

  useEffect(() => {
    selectedSnapshotDateRef.current = selectedSnapshotDate;
  }, [selectedSnapshotDate]);

  useEffect(() => {
    setTimelineIndex((currentIndex) => {
      const maxIndex = Math.max(timelineDates.length - 1, 0);
      return Math.min(currentIndex, maxIndex);
    });
  }, [timelineDates.length]);

  useEffect(() => {
    let disposed = false;

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
        style: {
          version: 8,
          glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
          sources: {
            osm: {
              type: "raster",
              tiles: [tileUrl()],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors"
            },
            habitats: {
              type: "geojson",
              data: asGeoJsonData(initialHabitats)
            },
            distribution: {
              type: "geojson",
              data: asGeoJsonData(initialDistribution)
            }
          },
          layers: [
            {
              id: "osm",
              type: "raster",
              source: "osm"
            },
            {
              id: "habitats-fill",
              type: "fill",
              source: "habitats",
              paint: {
                "fill-color": "#9bb49a",
                "fill-opacity": 0.12
              }
            },
            {
              id: "habitats-outline",
              type: "line",
              source: "habitats",
              paint: {
                "line-color": "#4c6a4a",
                "line-width": 1,
                "line-dasharray": [4, 2]
              }
            },
            {
              id: "distribution-fill",
              type: "fill",
              source: "distribution",
              paint: {
                "fill-color": [
                  "interpolate",
                  ["linear"],
                  ["coalesce", ["to-number", ["get", "density"]], 0],
                  0,
                  "#f3ead5",
                  6,
                  "#d5c193",
                  12,
                  "#9a7a43",
                  20,
                  "#5e4626"
                ],
                "fill-opacity": 0.5
              }
            },
            {
              id: "distribution-outline",
              type: "line",
              source: "distribution",
              paint: {
                "line-color": "#45371f",
                "line-width": 1.2
              }
            }
          ]
        },
        center: [104.5, 31.2],
        zoom: 5.6,
        minZoom: 4.2,
        maxZoom: 12
      });

      mapRef.current = map;

      map.on("load", () => {
        const bounds = parseBbox(defaultBBox);
        if (bounds) {
          map.fitBounds(bounds, { padding: 36, duration: 0 });
        }
      });

      map.on("mouseenter", "distribution-fill", () => {
        map.getCanvas().style.cursor = "crosshair";
      });

      map.on("mouseleave", "distribution-fill", () => {
        map.getCanvas().style.cursor = "";
        setHoveredCell(null);
      });

      map.on("mousemove", "distribution-fill", (event) => {
        const feature = event.features?.[0];
        if (!feature?.properties) {
          setHoveredCell(null);
          return;
        }

        const properties = feature.properties as Record<string, unknown>;
        setHoveredCell({
          cellCode: typeof properties.cell_code === "string" ? properties.cell_code : "未知网格",
          density: parseDensity(properties.density),
          snapshotDate:
            typeof properties.snapshot_date === "string"
              ? properties.snapshot_date
              : selectedSnapshotDateRef.current
        });
      });
    }

    void bootstrap();

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [defaultBBox, initialDistribution, initialHabitats]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }
    const source = map.getSource("distribution") as GeoJSONSource | undefined;
    source?.setData(asGeoJsonData(distribution));
  }, [distribution]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }
    const source = map.getSource("habitats") as GeoJSONSource | undefined;
    source?.setData(asGeoJsonData(initialHabitats));
  }, [initialHabitats]);

  useEffect(() => {
    if (skipInitialSyncRef.current) {
      skipInitialSyncRef.current = false;
      return;
    }

    let cancelled = false;

    async function syncMapData() {
      setIsLoading(true);
      setErrorMessage(null);
      setHoveredCell(null);

      try {
        const [nextDistribution, nextStats] = await Promise.all([
          getDistribution({
            bbox: defaultBBox,
            layer: activeLayer,
            snapshot_date: selectedSnapshotDate,
            zoom: 6
          }),
          getOverviewStats()
        ]);

        if (cancelled) {
          return;
        }

        setDistribution(nextDistribution);
        setStats(nextStats);
      } catch {
        if (!cancelled) {
          setErrorMessage("地图数据加载失败，请稍后重试。");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void syncMapData();

    return () => {
      cancelled = true;
    };
  }, [activeLayer, defaultBBox, selectedSnapshotDate]);

  return (
    <div className="map-workbench">
      <header className="map-toolbar">
        <div className="map-control-group">
          <p className="map-label">图层切换</p>
          <div className="map-layer-row">
            {LAYER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`map-layer-chip ${activeLayer === option.value ? "is-active" : ""}`}
                onClick={() => setActiveLayer(option.value)}
                disabled={isLoading && activeLayer !== option.value}
              >
                <span className="map-layer-dot" style={{ backgroundColor: option.color }} />
                {option.label}
              </button>
            ))}
          </div>
          <p className="map-hint">{selectedLayerMeta.description}</p>
        </div>

        <div className="map-control-group">
          <div className="map-timeline-head">
            <p className="map-label">快照时间轴</p>
            <span>{formatDateLabel(selectedSnapshotDate)}</span>
          </div>
          <div className="map-timeline-row">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTimelineIndex((current) => Math.max(0, current - 1))}
              disabled={timelineDates.length <= 1 || timelineIndex <= 0 || isLoading}
            >
              上一档
            </Button>
            <input
              type="range"
              min={0}
              max={Math.max(timelineDates.length - 1, 0)}
              value={timelineIndex}
              onChange={(event) => setTimelineIndex(Number(event.target.value))}
              className="map-range"
              disabled={timelineDates.length <= 1 || isLoading}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setTimelineIndex((current) => Math.min(timelineDates.length - 1, current + 1))
              }
              disabled={timelineDates.length <= 1 || timelineIndex >= timelineDates.length - 1 || isLoading}
            >
              下一档
            </Button>
          </div>
          <div className="map-timeline-ticks">
            {timelineDates.map((date, index) => (
              <span key={date} className={index === timelineIndex ? "is-active" : ""}>
                {formatDateLabel(date)}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div className="map-grid">
        <div className="map-stage">
          <div ref={mapContainerRef} className="map-canvas map-canvas--stage" />
          <div className="map-stage-pill">
            {selectedLayerMeta.label} · 当前网格 {visibleCellCount}
          </div>
          {isLoading ? <div className="map-loading-mask">正在更新地图数据...</div> : null}
          {!isLoading && !errorMessage && visibleCellCount === 0 ? (
            <div className="map-inline-alert">该时间片暂无网格数据，请切换时间或图层。</div>
          ) : null}
          {errorMessage ? <div className="map-inline-alert">{errorMessage}</div> : null}
        </div>

        <aside className="map-sidebar">
          <article className="map-stat-card">
            <h3>总览统计</h3>
            <dl>
              <div>
                <dt>记录个体</dt>
                <dd>{stats.total_pandas}</dd>
              </div>
              <div>
                <dt>活跃栖息地</dt>
                <dd>{stats.active_habitats}</dd>
              </div>
              <div>
                <dt>野外网格</dt>
                <dd>{stats.wild_distribution_cells}</dd>
              </div>
              <div>
                <dt>精选个体</dt>
                <dd>{stats.featured_pandas}</dd>
              </div>
            </dl>
            <p className="map-hint">最新快照：{formatDateLabel(stats.latest_snapshot_date)}</p>
          </article>

          <article className="map-stat-card">
            <h3>当前视图</h3>
            <dl>
              <div>
                <dt>选中图层</dt>
                <dd>{selectedLayerMeta.label}</dd>
              </div>
              <div>
                <dt>快照日期</dt>
                <dd>{formatDateLabel(selectedSnapshotDate)}</dd>
              </div>
              <div>
                <dt>显示网格</dt>
                <dd>{visibleCellCount}</dd>
              </div>
              <div>
                <dt>平均密度</dt>
                <dd>{averageDensity === null ? "-" : averageDensity.toFixed(1)}</dd>
              </div>
            </dl>
          </article>

          <article className="map-stat-card">
            <h3>网格悬浮信息</h3>
            {hoveredCell ? (
              <dl>
                <div>
                  <dt>网格编码</dt>
                  <dd>{hoveredCell.cellCode}</dd>
                </div>
                <div>
                  <dt>密度</dt>
                  <dd>{hoveredCell.density === null ? "-" : hoveredCell.density.toFixed(1)}</dd>
                </div>
                <div>
                  <dt>快照</dt>
                  <dd>{formatDateLabel(hoveredCell.snapshotDate)}</dd>
                </div>
              </dl>
            ) : (
              <p className="map-hint">移动鼠标到网格上可查看单元明细。</p>
            )}
            <div className="map-legend">
              <span>密度图例</span>
              <div className="map-legend-scale" />
              <div className="map-legend-labels">
                <span>低</span>
                <span>高</span>
              </div>
            </div>
          </article>
        </aside>
      </div>
    </div>
  );
}
