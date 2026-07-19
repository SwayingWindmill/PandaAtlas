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
    eyebrow: "OPTIONAL VISUAL LAYER",
    title: "启用地图可视增强",
    intro: "地图与下方结构化列表共享相同筛选、稳定 ID、选择、公开精度和来源。未启用前不会请求地图服务。",
    activate: "加载地图",
    unavailable: "当前筛选没有可安全显示的公开几何。结构化列表仍保持完整。",
    visualized: "可视对象",
    omitted: "未可视化",
    privacy: "仅使用公开的城市、地区或保护范围精度；不会把国家级记录伪装成机构点。",
    loading: "正在按需加载地图组件…",
    failed: "地图可视增强暂不可用。筛选、列表、详情、来源和普通链接不受影响。",
    retry: "重试地图",
    offline: "设备当前离线。结构化任务保持可用，联网后可重试地图。",
  },
  en: {
    eyebrow: "OPTIONAL VISUAL LAYER",
    title: "Activate map visualization",
    intro: "The map shares the same filters, stable IDs, selection, published precision, and source state as the structured list below. No map provider is requested before activation.",
    activate: "Load map",
    unavailable: "The current filters provide no public geometry that can be visualized safely. The structured list remains complete.",
    visualized: "Visual objects",
    omitted: "Not visualized",
    privacy: "Only published locality, region, or conservation-range precision is used; country-level records are never disguised as facility points.",
    loading: "Loading the map component on demand…",
    failed: "The optional map visualization is unavailable. Filters, results, details, sources, and ordinary links remain unaffected.",
    retry: "Retry map",
    offline: "This device is offline. The structured task remains available; retry the map after reconnecting.",
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
