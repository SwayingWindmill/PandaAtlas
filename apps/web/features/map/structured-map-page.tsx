import type { Route } from "next";
import Link from "next/link";
import { GlobalNavigation, publicShellClassName } from "@/components/patterns/global-navigation";
import { PublicDeliveryNotice } from "@/components/patterns/public-delivery-notice";
import { ACTIVE_STRUCTURED_MAP_PROVIDER } from "@/features/map/map-provider-registry";
import { MapVisualizationEnhancement } from "@/features/map/visualization/map-visualization-enhancement";
import type { MapVisualizationModel } from "@/features/map/visualization/map-visual-model";
import {
  structuredMapHref,
  type StructuredMapMode,
  type StructuredMapQueryState,
} from "@/features/map/map-query";
import type {
  StructuredMapPrecision,
  StructuredMapResult,
  StructuredMapViewModel,
} from "@/features/map/map-view-model";
import type {
  PublicCoverage,
  PublicDelivery,
  PublicLocaleDelivery,
  PublicReleaseIdentity,
} from "@/features/public-content/public-release";
import type { PublicLocale } from "@/foundation/content/locales";

interface StructuredMapPageProps {
  locale: PublicLocale;
  state: StructuredMapQueryState;
  view: StructuredMapViewModel;
  visualization: MapVisualizationModel;
  release: PublicReleaseIdentity;
  delivery: PublicDelivery;
  coverage: PublicCoverage;
  localeDelivery: PublicLocaleDelivery;
}

const copy = {
  zh: {
    eyebrow: "熊猫地图",
    title: "看看大熊猫生活在哪里",
    intro: "探索大熊猫现在或曾经生活过的机构与地点，也可以查看公开的野生家园范围。地点精度、来源和最后核实时间都会明确说明。",
    modes: {
      institutions: { label: "熊猫在哪里", description: "查看现在或曾经有大熊猫生活的机构与地点" },
      individual: { label: "熊猫旅行记", description: "按时间查看一只熊猫生活过的地点" },
      wild: { label: "野生家园", description: "查看公开的保护范围、地区和栖息地快照" },
    },
    scope: "当前探索范围",
    snapshot: "数据快照",
    provider: "地图状态",
    providerOff: "真实地图尚未加载",
    filters: "寻找地图里的熊猫和地点",
    focus: "熊猫、动物园、基地或地区",
    focusPlaceholder: "例如：美香、Wolong、Smithsonian、四川",
    country: "国家或地区",
    allCountries: "全部国家",
    status: "现在或曾经",
    allStatuses: "全部状态",
    current: "当前",
    historical: "历史",
    apply: "查看结果",
    reset: "清除当前条件",
    results: "探索结果",
    resultCount: "条结果",
    empty: "当前条件下没有找到熊猫或地点。可以调整名字、地区或时间状态继续探索。",
    selected: "正在查看",
    clearSelection: "清除选择",
    place: "公开地点",
    precision: "公开精度",
    dateRange: "时间或快照",
    lastVerified: "最后核实",
    source: "来源",
    sourceUnavailable: "当前发布未提供可点击的外部来源；来源状态已在记录中明确标注。",
    openResult: "查看此结果",
    openProfile: "查看熊猫资料",
    openEntity: "了解这个机构或地点",
    providerContract: "地图与数据说明",
    providerName: "地图底图",
    attribution: "署名",
    styleLicense: "地图样式许可",
    exportPolicy: "截图和分享限制",
    privacy: "隐私",
    providerSnapshot: "地图快照说明",
    failure: "地图不可用时",
    noCanvas: "真实地图暂时不可用时，探索列表、地点精度、来源和普通链接仍可继续使用。",
  },
  en: {
    eyebrow: "PANDA MAP",
    title: "See where giant pandas live",
    intro: "Explore institutions and places where giant pandas live or have lived, plus published wild homes. Location precision, sources, and last-verified dates remain clearly stated.",
    modes: {
      institutions: { label: "Where pandas live", description: "Places and institutions with current or historical giant panda residents" },
      individual: { label: "Panda journeys", description: "Places where one panda has lived, arranged in time order" },
      wild: { label: "Wild homes", description: "Published conservation ranges, regions, and habitat snapshots" },
    },
    scope: "Current exploration area",
    snapshot: "Data snapshot",
    provider: "Map status",
    providerOff: "The live map has not been loaded yet",
    filters: "Find pandas and places on the map",
    focus: "Panda, zoo, base, or region",
    focusPlaceholder: "For example: Mei Xiang, Wolong, Smithsonian, Sichuan",
    country: "Country or region",
    allCountries: "All countries",
    status: "Now or before",
    allStatuses: "All statuses",
    current: "Current",
    historical: "Historical",
    apply: "Show results",
    reset: "Clear these filters",
    results: "Explore results",
    resultCount: "results",
    empty: "No pandas or places match these filters. Adjust the name, region, or time status to keep exploring.",
    selected: "Now viewing",
    clearSelection: "Clear selection",
    place: "Published place",
    precision: "Published precision",
    dateRange: "Time or snapshot",
    lastVerified: "Last verified",
    source: "Source",
    sourceUnavailable: "This release provides no clickable external source for this record; the source state is stated explicitly.",
    openResult: "View this result",
    openProfile: "View panda profile",
    openEntity: "Explore this institution or place",
    providerContract: "Map and data information",
    providerName: "Basemap",
    attribution: "Attribution",
    styleLicense: "Map style licence",
    exportPolicy: "Screenshot and sharing limits",
    privacy: "Privacy",
    providerSnapshot: "Map snapshot information",
    failure: "When the map is unavailable",
    noCanvas: "If the live map is unavailable, the explore list, location precision, sources, and ordinary links remain usable.",
  },
} as const;

const modes: StructuredMapMode[] = ["institutions", "individual", "wild"];

function precisionLabel(precision: StructuredMapPrecision, locale: PublicLocale): string {
  const labels = {
    facility: { zh: "机构级", en: "Facility level" },
    locality: { zh: "城市/地区级", en: "Locality level" },
    province: { zh: "省级", en: "Province level" },
    country: { zh: "国家级", en: "Country level" },
  } as const;
  return labels[precision][locale];
}

function statusLabel(result: StructuredMapResult, locale: PublicLocale): string {
  if (result.status === "current") return locale === "zh" ? "当前" : "Current";
  return locale === "zh" ? "历史" : "Historical";
}

function resultCard(
  result: StructuredMapResult,
  locale: PublicLocale,
  state: StructuredMapQueryState,
  selected: boolean,
) {
  const t = copy[locale];
  const selectedState = { ...state, selected: result.id };
  return (
    <article
      key={result.id}
      className="pa-structured-map-result"
      data-selected={selected ? "true" : "false"}
      data-status={result.status}
      data-testid={`structured-map-result-${result.id}`}
    >
      <header>
        <div>
          <p className="pa-structured-map-result-kind">{result.statusDetail}</p>
          <h3>{result.title}</h3>
          <p>{result.subtitle}</p>
        </div>
        <div className="pa-structured-map-badges">
          <span>{statusLabel(result, locale)}</span>
          <span>{precisionLabel(result.precision, locale)}</span>
        </div>
      </header>
      <dl>
        <div><dt>{t.place}</dt><dd>{result.placeLabel}</dd></div>
        <div><dt>{t.dateRange}</dt><dd>{result.dateRange}</dd></div>
        <div><dt>{t.lastVerified}</dt><dd>{result.lastVerified ?? "—"}</dd></div>
      </dl>
      <section aria-label={t.source} className="pa-structured-map-sources">
        <strong>{t.source}</strong>
        <p>{result.sourceLabel}</p>
        {result.sources.length ? (
          <ul>
            {result.sources.map((source) => (
              <li key={source.id}>
                <a href={source.url} target="_blank" rel="noreferrer">{source.publisher}: {source.title}</a>
                <small>{t.lastVerified}: {source.last_verified_at}</small>
              </li>
            ))}
          </ul>
        ) : <p>{t.sourceUnavailable}</p>}
      </section>
      <footer>
        <Link href={structuredMapHref(locale, selectedState) as Route}>{t.openResult}</Link>
        {result.profileHref ? <Link href={result.profileHref as Route}>{t.openProfile}</Link> : null}
        {result.entityHref ? <Link href={result.entityHref as Route}>{t.openEntity}</Link> : null}
      </footer>
    </article>
  );
}

export function StructuredMapPage({
  locale,
  state,
  view,
  visualization,
  release,
  delivery,
  coverage,
  localeDelivery,
}: StructuredMapPageProps) {
  const t = copy[locale];
  const otherLocale = locale === "zh" ? "en" : "zh";
  const alternatePath = structuredMapHref(otherLocale, state);
  const modeCopy = t.modes[state.mode];
  const resetState: StructuredMapQueryState = {
    mode: state.mode,
    focus: "",
    country: "all",
    status: "all",
    snapshot: state.snapshot,
    selected: "",
    view: state.view,
  };

  return (
    <>
      <GlobalNavigation locale={locale} active="map" alternatePath={alternatePath} />
      <main id="main-content" className="pa-structured-map-page" data-testid="structured-map-page">
        <div className={publicShellClassName}>
          <header className="pa-structured-map-hero">
            <p className="pa-eyebrow">{t.eyebrow}</p>
            <h1>{t.title}</h1>
            <p>{t.intro}</p>
            <p className="pa-structured-map-no-canvas">{t.noCanvas}</p>
          </header>

          <PublicDeliveryNotice
            locale={locale}
            release={release}
            delivery={delivery}
            coverage={coverage}
            localeDelivery={localeDelivery}
          />

          <nav className="pa-structured-map-modes" aria-label={locale === "zh" ? "地图模式" : "Map modes"}>
            {modes.map((mode) => {
              const nextState: StructuredMapQueryState = {
                mode,
                focus: "",
                country: "all",
                status: "all",
                snapshot: state.snapshot,
                selected: "",
                view: "",
              };
              return (
                <Link
                  key={mode}
                  href={structuredMapHref(locale, nextState) as Route}
                  aria-current={state.mode === mode ? "page" : undefined}
                >
                  <strong>{t.modes[mode].label}</strong>
                  <span>{view.counts[mode]}</span>
                  <small>{t.modes[mode].description}</small>
                </Link>
              );
            })}
          </nav>

          <section className="pa-structured-map-scope" aria-labelledby="structured-map-scope-heading">
            <div>
              <p className="pa-eyebrow">{t.scope}</p>
              <h2 id="structured-map-scope-heading">{modeCopy.label}</h2>
              <p>{modeCopy.description}</p>
            </div>
            <dl>
              <div><dt>{t.snapshot}</dt><dd>{state.snapshot}</dd></div>
              <div><dt>{t.provider}</dt><dd>{t.providerOff}</dd></div>
            </dl>
          </section>

          <form className="pa-structured-map-filters" action={`/${locale}/map`} method="get" aria-label={t.filters}>
            <input type="hidden" name="mode" value={state.mode} />
            <input type="hidden" name="snapshot" value={state.snapshot} />
            <label>
              <span>{t.focus}</span>
              <input name="focus" defaultValue={state.focus} placeholder={t.focusPlaceholder} />
            </label>
            <label>
              <span>{t.country}</span>
              <select name="country" defaultValue={state.country}>
                <option value="all">{t.allCountries}</option>
                {view.countries.map((country) => (
                  <option key={country.code} value={country.code}>{country.label} ({country.count})</option>
                ))}
              </select>
            </label>
            <label>
              <span>{t.status}</span>
              <select name="status" defaultValue={state.status}>
                <option value="all">{t.allStatuses}</option>
                <option value="current">{t.current}</option>
                <option value="historical">{t.historical}</option>
              </select>
            </label>
            <div className="pa-structured-map-filter-actions">
              <button type="submit">{t.apply}</button>
              <Link href={structuredMapHref(locale, resetState) as Route}>{t.reset}</Link>
            </div>
          </form>

          <MapVisualizationEnhancement locale={locale} state={state} model={visualization} />

          {view.selected ? (
            <section className="pa-structured-map-selected" data-testid="selected-structured-map-result" aria-labelledby="selected-map-heading">
              <div>
                <p className="pa-eyebrow">{t.selected}</p>
                <h2 id="selected-map-heading">{view.selected.title}</h2>
                <p>{view.selected.placeLabel} · {precisionLabel(view.selected.precision, locale)}</p>
              </div>
              <Link href={structuredMapHref(locale, { ...state, selected: "" }) as Route}>{t.clearSelection}</Link>
            </section>
          ) : null}

          <section className="pa-structured-map-results" aria-labelledby="structured-map-results-heading">
            <header>
              <div>
                <p className="pa-eyebrow">{t.results}</p>
                <h2 id="structured-map-results-heading">{view.results.length} {t.resultCount}</h2>
              </div>
            </header>
            {view.results.length ? (
              <div className="pa-structured-map-result-list">
                {view.results.map((result) => resultCard(result, locale, state, view.selected?.id === result.id))}
              </div>
            ) : <p className="pa-structured-map-empty">{t.empty}</p>}
          </section>

          <details className="pa-structured-map-provider">
            <summary>{t.providerContract}</summary>
            <dl>
              <div><dt>{t.providerName}</dt><dd>{ACTIVE_STRUCTURED_MAP_PROVIDER.baseMapProvider}</dd></div>
              <div><dt>{t.attribution}</dt><dd>{ACTIVE_STRUCTURED_MAP_PROVIDER.attribution}</dd></div>
              <div><dt>{t.styleLicense}</dt><dd>{ACTIVE_STRUCTURED_MAP_PROVIDER.styleLicense}</dd></div>
              <div><dt>{t.exportPolicy}</dt><dd>{ACTIVE_STRUCTURED_MAP_PROVIDER.screenshotExportPolicy}</dd></div>
              <div><dt>{t.privacy}</dt><dd>{ACTIVE_STRUCTURED_MAP_PROVIDER.privacy}</dd></div>
              <div><dt>{t.providerSnapshot}</dt><dd>{ACTIVE_STRUCTURED_MAP_PROVIDER.snapshotPolicy}</dd></div>
              <div><dt>{t.failure}</dt><dd>{ACTIVE_STRUCTURED_MAP_PROVIDER.failureBehavior}</dd></div>
            </dl>
          </details>
        </div>
      </main>
    </>
  );
}
