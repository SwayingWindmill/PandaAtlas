"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import type { StructuredMapQueryState } from "@/features/map/map-query";
import type { MapVisualizationModel } from "@/features/map/visualization/map-visual-model";
import { MapVisualizationErrorBoundary } from "@/features/map/visualization/map-visualization-error-boundary";
import type { PublicLocale } from "@/foundation/content/locales";

const MapVisualizationIsland = dynamic(
  () => import("@/features/map/visualization/map-visualization-island").then((module) => module.MapVisualizationIsland),
  { ssr: false },
);

interface MapVisualizationEnhancementProps {
  locale: PublicLocale;
  state: StructuredMapQueryState;
  model: MapVisualizationModel;
}

const copy = {
  zh: {
    eyebrow: "真实地图",
    title: "在真实地图上看看",
    intro: "真实地图与下方探索列表使用相同的筛选、选择、地点精度和来源。打开前不会请求外部地图资源。",
    activate: "打开真实地图",
    unavailable: "当前结果没有可以安全显示在地图上的公开位置，仍可继续使用下方列表。",
    visualized: "地图中的地点",
    omitted: "仅在列表中显示",
    privacy: "仅使用公开的城市、地区或保护范围精度；不会把国家级记录伪装成机构点。",
    loading: "正在打开真实地图…",
    failed: "真实地图暂时无法打开。筛选、列表、详情、来源和普通链接仍可使用。",
    retry: "重试地图",
    offline: "当前设备离线。探索列表仍可使用，联网后可以重试地图。",
  },
  en: {
    eyebrow: "LIVE MAP",
    title: "See it on a live map",
    intro: "The live map uses the same filters, selection, published location precision, and sources as the explore list below. No external map resources are requested before opening it.",
    activate: "Open live map",
    unavailable: "These results have no public locations that can be shown safely on the map. The list below remains available.",
    visualized: "Places on the map",
    omitted: "List only",
    privacy: "Only published locality, region, or conservation-range precision is used; country-level records are never disguised as facility points.",
    loading: "Opening the live map…",
    failed: "The live map cannot be opened right now. Filters, results, details, sources, and ordinary links remain available.",
    retry: "Retry map",
    offline: "This device is offline. The explore list remains available; retry the map after reconnecting.",
  },
} as const;

const MAP_VISUALIZATION_LOAD_TIMEOUT_MS = 10_000;
type MapVisualizationLoadState = "idle" | "loading" | "mounted" | "failed";

export function MapVisualizationEnhancement({ locale, state, model }: MapVisualizationEnhancementProps) {
  const t = copy[locale];
  const [active, setActive] = useState(false);
  const [loadState, setLoadState] = useState<MapVisualizationLoadState>("idle");
  const [online, setOnline] = useState(true);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const activate = useCallback(() => {
    setLoadState("loading");
    setActive(true);
  }, []);

  const markMounted = useCallback(() => setLoadState("mounted"), []);

  useEffect(() => {
    if (!active || loadState !== "loading") return;
    const timeout = window.setTimeout(() => {
      setLoadState("failed");
      setActive(false);
    }, MAP_VISUALIZATION_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [active, loadState]);

  const retry = () => {
    setResetKey((value) => value + 1);
    setActive(false);
    setLoadState("idle");
    window.requestAnimationFrame(activate);
  };

  const failurePanel = (
    <div className="pa-map-visualization-failure" role="status" data-testid="map-visualization-failure">
      <p>{t.failed}</p>
      <button type="button" onClick={retry} disabled={!online}>{t.retry}</button>
    </div>
  );

  const renderMapContent = () => {
    if (!active) return loadState === "failed" ? failurePanel : null;
    return (
      <MapVisualizationErrorBoundary resetKey={resetKey} fallback={failurePanel}>
        {loadState === "loading" ? (
          <p role="status" data-testid="map-visualization-loading">{t.loading}</p>
        ) : null}
        <MapVisualizationIsland
          key={resetKey}
          locale={locale}
          state={state}
          model={model}
          loadingLabel={t.loading}
          onMount={markMounted}
        />
      </MapVisualizationErrorBoundary>
    );
  };

  return (
    <section className="pa-map-visualization" aria-labelledby="map-visualization-heading" data-testid="map-visualization-enhancement">
      <header className="pa-map-visualization-intro">
        <div>
          <p className="pa-eyebrow">{t.eyebrow}</p>
          <h2 id="map-visualization-heading">{t.title}</h2>
          <p>{t.intro}</p>
        </div>
        <dl>
          <div><dt>{t.visualized}</dt><dd>{model.visualizedCount}</dd></div>
          <div><dt>{t.omitted}</dt><dd>{model.omitted.length}</dd></div>
        </dl>
      </header>

      <p className="pa-map-visualization-privacy">{t.privacy}</p>

      {!active && loadState !== "failed" ? (
        <div className="pa-map-visualization-activation">
          {model.visualizedCount > 0 ? (
            <button
              type="button"
              onClick={activate}
              disabled={!online}
              data-testid="activate-map-visualization"
            >
              {t.activate}
            </button>
          ) : <p>{t.unavailable}</p>}
          {!online ? <p role="status">{t.offline}</p> : null}
        </div>
      ) : renderMapContent()}

      {model.omitted.length ? (
        <details className="pa-map-visualization-omitted">
          <summary>{t.omitted}: {model.omitted.length}</summary>
          <ul>
            {model.omitted.map((item) => <li key={item.id}><strong>{item.title}</strong>: {item.reason}</li>)}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
