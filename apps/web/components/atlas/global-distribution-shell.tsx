"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { getDistributionWithSource } from "@/lib/api-client";
import { ATLAS_DATA_SOURCE, ATLAS_DATA_STATUS, ATLAS_INSTITUTIONS, type AtlasMode } from "@/lib/panda-atlas";
import type {
  CompleteGeoJsonFeatureCollection,
  DistributionFeatureProperties,
  HabitatFeatureProperties,
  OverviewStats
} from "@/lib/types";
import { AtlasSidebar } from "./atlas-sidebar";
import { EntityDetailDrawer } from "./entity-detail-drawer";
import {
  buildHabitatFeatureCollection,
  buildHabitatItems,
  buildModeMetrics,
  buildSummaryBarItems,
  filterVisibleHabitats,
  getModeMeta,
  matchesRegion,
  matchesSearch,
  matchesStatus,
  matchesType
} from "./helpers";
import { mapViewportEquals, mapViewportToQuery, type MapViewport } from "./map-viewport";
import { MapStage } from "./map-stage";
import { MobileMapControls } from "./mobile-map-controls";
import { TopNav } from "./top-nav";

interface GlobalDistributionShellProps {
  initialDistribution: CompleteGeoJsonFeatureCollection<DistributionFeatureProperties>;
  initialHabitats: CompleteGeoJsonFeatureCollection<HabitatFeatureProperties>;
  initialStats: OverviewStats;
  initialSnapshotDate: string;
  availableSnapshotDates: string[];
}

const EMPTY_DISTRIBUTION: CompleteGeoJsonFeatureCollection<DistributionFeatureProperties> = {
  type: "FeatureCollection",
  features: [],
  meta: {
    truncated: false,
    limit: null,
    requested_zoom: null
  }
};

export function GlobalDistributionShell({
  initialDistribution,
  initialHabitats,
  initialStats,
  initialSnapshotDate,
  availableSnapshotDates
}: GlobalDistributionShellProps) {
  const [mode, setMode] = useState<AtlasMode>("global");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredQuery = useDeferredValue(searchQuery);
  const [regionFilter, setRegionFilter] = useState<"all" | "china" | "overseas">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "wild" | "captive">("all");
  const [typeFilter, setTypeFilter] = useState<
    "all" | "reserve" | "breeding_base" | "zoo" | "research_center"
  >("all");
  const [selectedSnapshotDate, setSelectedSnapshotDate] = useState(initialSnapshotDate);
  const [distribution, setDistribution] = useState(initialDistribution);
  const [mapViewport, setMapViewport] = useState<MapViewport | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isDistributionUpdating, setIsDistributionUpdating] = useState(false);
  const [distributionError, setDistributionError] = useState<string | null>(null);
  const [distributionRefreshNonce, setDistributionRefreshNonce] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [focusSignal, setFocusSignal] = useState(0);
  const [resetSignal, setResetSignal] = useState(0);

  const modeMeta = getModeMeta(mode);
  const latestSnapshotDate =
    availableSnapshotDates[availableSnapshotDates.length - 1] ?? initialStats.latest_snapshot_date;
  const distributionTruncationMessage = distribution.meta.truncated
    ? `当前视野的数据超过返回上限，仅显示前 ${distribution.meta.limit ?? distribution.features.length} 个分布网格。请放大地图或缩小查询范围，地图会按新视野重新加载。`
    : null;
  const habitatTruncationMessage = initialHabitats.meta.truncated
    ? `栖息地边界达到返回上限，仅显示前 ${initialHabitats.meta.limit ?? initialHabitats.features.length} 条记录；可通过搜索和筛选浏览已返回记录。`
    : null;
  const distributionMessage = distributionError ?? distributionTruncationMessage ?? habitatTruncationMessage;

  const habitatFeatures = useMemo(() => buildHabitatFeatureCollection(initialHabitats), [initialHabitats]);
  const wildRegionItems = useMemo(
    () => buildHabitatItems(habitatFeatures, selectedSnapshotDate),
    [habitatFeatures, selectedSnapshotDate]
  );
  const allAtlasItems = useMemo(() => [...wildRegionItems, ...ATLAS_INSTITUTIONS], [wildRegionItems]);
  const itemById = useMemo(() => new Map(allAtlasItems.map((item) => [item.id, item])), [allAtlasItems]);

  const visibleWildItems = useMemo(
    () =>
      (modeMeta.showHabitats ? wildRegionItems : []).filter(
        (item) =>
          matchesSearch(item, deferredQuery) &&
          matchesRegion(item, regionFilter) &&
          matchesStatus(item, statusFilter) &&
          matchesType(item, typeFilter)
      ),
    [deferredQuery, modeMeta.showHabitats, regionFilter, statusFilter, typeFilter, wildRegionItems]
  );
  const visibleDomesticItems = useMemo(
    () =>
      (modeMeta.showDomesticInstitutions ? ATLAS_INSTITUTIONS.filter((item) => item.region === "china") : []).filter(
        (item) =>
          matchesSearch(item, deferredQuery) &&
          matchesRegion(item, regionFilter) &&
          matchesStatus(item, statusFilter) &&
          matchesType(item, typeFilter)
      ),
    [deferredQuery, modeMeta.showDomesticInstitutions, regionFilter, statusFilter, typeFilter]
  );
  const visibleOverseasItems = useMemo(
    () =>
      (modeMeta.showOverseasInstitutions ? ATLAS_INSTITUTIONS.filter((item) => item.region === "overseas") : []).filter(
        (item) =>
          matchesSearch(item, deferredQuery) &&
          matchesRegion(item, regionFilter) &&
          matchesStatus(item, statusFilter) &&
          matchesType(item, typeFilter)
      ),
    [deferredQuery, modeMeta.showOverseasInstitutions, regionFilter, statusFilter, typeFilter]
  );

  const visibleIds = useMemo(
    () => new Set([...visibleWildItems, ...visibleDomesticItems, ...visibleOverseasItems].map((item) => item.id)),
    [visibleDomesticItems, visibleOverseasItems, visibleWildItems]
  );
  const filteredHabitats = useMemo(
    () => filterVisibleHabitats(habitatFeatures, visibleWildItems),
    [habitatFeatures, visibleWildItems]
  );

  const selectedItem = selectedItemId ? itemById.get(selectedItemId) ?? null : null;
  const resultCount = visibleWildItems.length + visibleDomesticItems.length + visibleOverseasItems.length;
  const emptyState = resultCount === 0;

  const modeMetrics = useMemo(
    () =>
      buildModeMetrics(
        mode,
        initialStats,
        visibleWildItems.length,
        visibleDomesticItems.length,
        visibleOverseasItems.length,
        wildRegionItems.length,
        selectedSnapshotDate
      ),
    [
      initialStats,
      mode,
      selectedSnapshotDate,
      visibleDomesticItems.length,
      visibleOverseasItems.length,
      visibleWildItems.length,
      wildRegionItems.length
    ]
  );

  const summaryItems = useMemo(
    () =>
      buildSummaryBarItems(
        mode,
        visibleWildItems.length,
        visibleDomesticItems.length,
        visibleOverseasItems.length,
        selectedSnapshotDate
      ),
    [mode, selectedSnapshotDate, visibleDomesticItems.length, visibleOverseasItems.length, visibleWildItems.length]
  );

  useEffect(() => {
    if (!selectedItemId) {
      return;
    }

    if (!visibleIds.has(selectedItemId)) {
      const timeoutId = window.setTimeout(() => {
        setSelectedItemId(null);
      }, 0);
      return () => {
        window.clearTimeout(timeoutId);
      };
    }
  }, [selectedItemId, visibleIds]);

  useEffect(() => {
    if (!selectedItem) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSheetOpen(false);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [selectedItem]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(min-width: 1280px)");
    const syncViewport = (event: MediaQueryList | MediaQueryListEvent) => {
      if (event.matches) {
        setSheetOpen(false);
      }
    };

    syncViewport(mediaQuery);
    mediaQuery.addEventListener("change", syncViewport);

    return () => {
      mediaQuery.removeEventListener("change", syncViewport);
    };
  }, []);

  useEffect(() => {
    const distributionLayer = modeMeta.distributionLayer;

    if (!distributionLayer || !mapViewport) {
      return;
    }

    let cancelled = false;
    const viewportQuery = mapViewportToQuery(mapViewport);

    async function syncDistribution() {
      setIsDistributionUpdating(true);
      setDistributionError(null);

      const result = await getDistributionWithSource({
        bbox: viewportQuery.bbox,
        layer: distributionLayer ?? undefined,
        snapshot_date: selectedSnapshotDate,
        zoom: viewportQuery.zoom
      });

      if (cancelled) {
        return;
      }

      startTransition(() => {
        setDistribution(result.data);
      });

      if (result.source === "fallback") {
        setDistributionError("当前视野刷新失败，显示的是本地回退数据。可重新刷新或调整地图视野后再试。");
      }

      setIsDistributionUpdating(false);
    }

    void syncDistribution();

    return () => {
      cancelled = true;
    };
  }, [distributionRefreshNonce, mapViewport, modeMeta.distributionLayer, selectedSnapshotDate]);

  function resetFilters() {
    setSearchQuery("");
    setRegionFilter("all");
    setStatusFilter("all");
    setTypeFilter("all");
  }

  function handleViewportChange(nextViewport: MapViewport) {
    setMapViewport((currentViewport) =>
      mapViewportEquals(currentViewport, nextViewport) ? currentViewport : nextViewport
    );
  }

  function handleModeChange(nextMode: AtlasMode) {
    const nextModeMeta = getModeMeta(nextMode);
    setMapViewport(null);
    setDistributionError(null);
    setIsDistributionUpdating(false);
    startTransition(() => {
      setMode(nextMode);
      if (!nextModeMeta.distributionLayer) {
        setDistribution(EMPTY_DISTRIBUTION);
      }
    });
  }

  function handleSelectItem(nextItem: typeof selectedItem) {
    setSelectedItemId(nextItem?.id ?? null);
    setSheetOpen(false);

    if (nextItem) {
      setFocusSignal((value) => value + 1);
    }
  }

  function handleUseLatestSnapshot() {
    setSelectedSnapshotDate(latestSnapshotDate);
  }

  function handleLocateSelected() {
    if (!selectedItem) {
      return;
    }

    setFocusSignal((value) => value + 1);
  }

  function handleResetView() {
    setSelectedItemId(null);
    setResetSignal((value) => value + 1);
  }

  function handleRetryDistribution() {
    setDistributionRefreshNonce((value) => value + 1);
  }

  return (
    <main
      className="h-screen overflow-hidden bg-[#F7F6F2] text-[#233126]"
      data-testid="global-distribution-shell"
    >
      <TopNav
        activeModeLabel={modeMeta.label}
        selectedSnapshotDate={selectedSnapshotDate}
        latestSnapshotDate={latestSnapshotDate}
        sheetOpen={sheetOpen}
        onToggleControls={() => setSheetOpen((value) => !value)}
        onUseLatestSnapshot={handleUseLatestSnapshot}
      />

      <section className="relative h-[calc(100dvh-76px)] overflow-hidden">
        <div className="grid h-full min-h-0 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="hidden min-h-0 xl:block">
            <AtlasSidebar
              mode={mode}
              modeMeta={modeMeta}
              searchQuery={searchQuery}
              resultCount={resultCount}
              regionFilter={regionFilter}
              statusFilter={statusFilter}
              typeFilter={typeFilter}
              selectedItem={selectedItem}
              selectedSnapshotDate={selectedSnapshotDate}
              latestSnapshotDate={latestSnapshotDate}
              availableSnapshotDates={availableSnapshotDates}
              metrics={modeMetrics}
              dataStatus={ATLAS_DATA_STATUS}
              dataSource={ATLAS_DATA_SOURCE}
              onModeChange={handleModeChange}
              onSearchChange={setSearchQuery}
              onRegionChange={setRegionFilter}
              onStatusChange={setStatusFilter}
              onTypeChange={setTypeFilter}
              onSnapshotChange={setSelectedSnapshotDate}
              onUseLatestSnapshot={handleUseLatestSnapshot}
              onLocateSelected={handleLocateSelected}
            />
          </div>

          <div className="relative h-full min-h-0 overflow-hidden">
            <MapStage
              modeMeta={modeMeta}
              distribution={distribution}
              habitats={filteredHabitats}
              wildRegionItems={visibleWildItems}
              domesticItems={visibleDomesticItems}
              overseasItems={visibleOverseasItems}
              selectedItem={selectedItem}
              selectedSnapshotDate={selectedSnapshotDate}
              summaryItems={summaryItems}
              isUpdating={isDistributionUpdating}
              focusSignal={focusSignal}
              resetSignal={resetSignal}
              detailOpen={Boolean(selectedItem)}
              sheetOpen={sheetOpen}
              onSelectItem={handleSelectItem}
              onViewportChange={handleViewportChange}
              onRequestResetView={handleResetView}
            />

            {distributionMessage ? (
              <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-center px-4 sm:top-5">
                <div
                  className="pointer-events-auto flex max-w-[680px] flex-col gap-3 border border-[rgba(154,91,36,0.2)] bg-[rgba(255,248,240,0.94)] px-4 py-3 text-[#6F4A25] shadow-[0_14px_30px_rgba(76,53,25,0.12)] backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between"
                  role="status"
                  aria-live="polite"
                >
                  <p className="text-[13px] leading-6">{distributionMessage}</p>
                  {distributionError ? (
                    <button
                      type="button"
                      onClick={handleRetryDistribution}
                      disabled={isDistributionUpdating}
                      className="inline-flex h-9 shrink-0 items-center justify-center border-b border-[rgba(111,74,37,0.22)] px-0 text-[13px] font-medium text-[#8C5A2C] transition-colors hover:text-[#6F4A25] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isDistributionUpdating ? "重试中" : "重新刷新"}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {emptyState ? (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6">
                <div className="pointer-events-auto max-w-md border-y border-[rgba(63,125,72,0.12)] bg-[linear-gradient(180deg,rgba(247,246,242,0.94),rgba(247,246,242,0.72))] px-6 py-5 text-center backdrop-blur-sm">
                  <p
                    className="text-[22px] leading-8 text-[#233126]"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    当前筛选没有匹配对象
                  </p>
                  <p className="mt-3 text-[14px] leading-7 text-[#5F6E61]">{modeMeta.emptyHint}</p>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="pointer-events-auto mt-4 inline-flex h-10 items-center justify-center border-b border-[rgba(47,107,59,0.18)] px-0 text-[13px] text-[#2F6B3B] transition-colors hover:text-[#244F2D]"
                  >
                    重置筛选
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <MobileMapControls
          open={sheetOpen}
          mode={mode}
          modeMeta={modeMeta}
          searchQuery={searchQuery}
          resultCount={resultCount}
          regionFilter={regionFilter}
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          selectedSnapshotDate={selectedSnapshotDate}
          latestSnapshotDate={latestSnapshotDate}
          availableSnapshotDates={availableSnapshotDates}
          onOpenChange={setSheetOpen}
          onModeChange={handleModeChange}
          onSearchChange={setSearchQuery}
          onRegionChange={setRegionFilter}
          onStatusChange={setStatusFilter}
          onTypeChange={setTypeFilter}
          onSnapshotChange={setSelectedSnapshotDate}
          onUseLatestSnapshot={handleUseLatestSnapshot}
        />

        <EntityDetailDrawer
          item={selectedItem}
          open={Boolean(selectedItem)}
          snapshotDate={selectedSnapshotDate}
          onClose={() => setSelectedItemId(null)}
          onLocate={handleLocateSelected}
          onResetView={handleResetView}
        />
      </section>
    </main>
  );
}
