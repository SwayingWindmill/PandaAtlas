import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import { GlobalNavigation, publicShellClassName } from "@/components/patterns/global-navigation";
import { PublicDeliveryNotice } from "@/components/patterns/public-delivery-notice";
import { atlasHref, parseAtlasQuery, type AtlasQueryState } from "@/features/atlas/atlas-query";
import { buildAtlasSearchViewModel } from "@/features/atlas/atlas-search";
import { loadPublishedAtlasDataset } from "@/features/public-content/public-release";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";

interface LocalizedPandasPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const copy = {
  zh: {
    title: "熊猫图鉴 | 吱熊猫",
    description: "按名字、状态、性别和生活地点寻找大熊猫，继续探索它们的资料、家族和生活足迹。",
    searchLabel: "寻找熊猫",
    inputLabel: "熊猫名字或公开标识",
    placeholder: "例如：美香、Mei Xiang、meixiang",
    filters: "筛选条件",
    status: "生命状态",
    sex: "性别",
    facility: "当前机构",
    completeness: "资料完整度",
    sort: "排序",
    all: "全部",
    alive: "存活",
    deceased: "已死亡",
    unknown: "未知",
    male: "雄性",
    female: "雌性",
    complete: "资料较完整",
    partial: "部分资料",
    relevance: "相关度",
    name: "名称",
    birth: "出生日期（新到旧）",
    submit: "应用搜索与筛选",
    reset: "清除全部条件",
    resultSummary: (first: number, last: number, matched: number, total: number) =>
      matched ? `显示第 ${first}–${last} 项，共找到 ${matched} 只；当前收录 ${total} 只熊猫。` : `没有找到匹配的熊猫；当前收录 ${total} 只。`,
    querySummary: (query: string) => `搜索“${query}”`,
    activeFilters: (count: number) => `${count} 个筛选条件生效`,
    noResults: "当前公开资料中没有同时满足这些条件的熊猫。可以调整名字或筛选条件继续寻找。",
    currentLocation: "当前公开地点",
    birthDate: "出生日期",
    recordState: "资料状态",
    mediaState: "媒体状态",
    open: "查看熊猫资料",
    noLicensedMedia: "无可展示授权媒体",
    sourceLinkOnly: "仅提供来源链接",
    licensedMedia: "有授权媒体",
    mediaUnavailable: "媒体状态未发布",
    previous: "上一页",
    next: "下一页",
    page: (current: number, total: number) => `第 ${current} 页，共 ${total} 页`,
    facilityCount: (count: number) => `${count} 只`,
    id: "稳定标识",
    relatedEntities: "匹配的机构与场所",
    institutionEntity: "机构",
    placeEntity: "场所",
    noEntityConflation: "机构和物理场所是独立实体，结果不会把两者合并。",
  },
  en: {
    title: "Panda guide | ZhiPanda",
    description: "Find giant pandas by name, life status, sex, and current place, then continue to their profiles, families, and life journeys.",
    searchLabel: "Find a panda",
    inputLabel: "Panda name or public identifier",
    placeholder: "For example: Mei Xiang, 美香, meixiang",
    filters: "Filters",
    status: "Life status",
    sex: "Sex",
    facility: "Current facility",
    completeness: "Profile completeness",
    sort: "Sort",
    all: "All",
    alive: "Alive",
    deceased: "Deceased",
    unknown: "Unknown",
    male: "Male",
    female: "Female",
    complete: "More complete information",
    partial: "Partial information",
    relevance: "Relevance",
    name: "Name",
    birth: "Birth date (newest first)",
    submit: "Apply search and filters",
    reset: "Clear all conditions",
    resultSummary: (first: number, last: number, matched: number, total: number) =>
      matched ? `Showing ${first}–${last} of ${matched} pandas found; ${total} pandas are currently included.` : `No pandas matched; ${total} are currently included.`,
    querySummary: (query: string) => `Search: “${query}”`,
    activeFilters: (count: number) => `${count} active ${count === 1 ? "filter" : "filters"}`,
    noResults: "No panda in the current public information matches all of these conditions. Adjust the name or filters to keep exploring.",
    currentLocation: "Current published place",
    birthDate: "Birth date",
    recordState: "Information state",
    mediaState: "Media state",
    open: "View panda profile",
    noLicensedMedia: "No licensed display media",
    sourceLinkOnly: "Source link only",
    licensedMedia: "Licensed media available",
    mediaUnavailable: "Media state unavailable",
    previous: "Previous",
    next: "Next",
    page: (current: number, total: number) => `Page ${current} of ${total}`,
    facilityCount: (count: number) => `${count} ${count === 1 ? "panda" : "pandas"}`,
    id: "Stable identifier",
    relatedEntities: "Matching institutions and places",
    institutionEntity: "Institution",
    placeEntity: "Place",
    noEntityConflation: "Institutions and physical places are separate entities and are not merged in these results.",
  },
} as const;

function localizedStatus(value: string, locale: "zh" | "en") {
  const t = copy[locale];
  if (value === "alive") return t.alive;
  if (value === "deceased") return t.deceased;
  return t.unknown;
}

function localizedSex(value: string, locale: "zh" | "en") {
  const t = copy[locale];
  if (value === "male") return t.male;
  if (value === "female") return t.female;
  return t.unknown;
}

function normalizedEntityTerm(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/[\s_\-:,.()'’]+/g, "")
    .trim();
}

function localizedEntityName(
  names: Array<{ language: string; value: string }>,
  locale: "zh" | "en",
  fallback: string,
): string {
  const language = locale === "zh" ? "zh-Hans" : "en";
  return names.find((name) => name.language === language)?.value
    ?? names[0]?.value
    ?? fallback;
}

function pageState(state: AtlasQueryState, page: number): AtlasQueryState {
  return { ...state, page };
}

export async function generateMetadata({ params }: LocalizedPandasPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const t = copy[locale];
  return buildPublicMetadata({ locale, title: t.title, description: t.description, path: "/pandas" });
}

export default async function LocalizedPandasPage({ params, searchParams }: LocalizedPandasPageProps) {
  const [{ locale: rawLocale }, rawQuery] = await Promise.all([params, searchParams]);
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();

  const envelope = loadPublishedAtlasDataset(locale);
  const parsed = parseAtlasQuery(rawQuery, envelope.data.facilities);
  const view = buildAtlasSearchViewModel(envelope.data.pandas, envelope.data.facilities, parsed.state, locale);
  const canonicalState = { ...parsed.state, page: view.page };
  const canonicalHref = atlasHref(locale, canonicalState);
  if (parsed.needsNormalization || view.page !== parsed.state.page) permanentRedirect(canonicalHref as Route);

  const t = copy[locale];
  const alternateLocale = locale === "zh" ? "en" : "zh";
  const mediaLabel = (state: string) => {
    if (state === "licensed") return t.licensedMedia;
    if (state === "source_link_only") return t.sourceLinkOnly;
    if (state === "no_licensed_media") return t.noLicensedMedia;
    return t.mediaUnavailable;
  };
  const normalizedEntityQuery = normalizedEntityTerm(canonicalState.q);
  const entityMatches = normalizedEntityQuery
    ? [
        ...envelope.data.institutions.map((institution) => ({
          id: institution.id,
          kind: "institution" as const,
          slug: institution.canonical_slug,
          name: localizedEntityName(institution.names, locale, institution.canonical_slug),
          searchText: normalizedEntityTerm([
            institution.canonical_slug,
            ...institution.legacy_slugs,
            ...institution.names.map((name) => name.value),
          ].join(" ")),
        })),
        ...envelope.data.places.map((place) => ({
          id: place.id,
          kind: "place" as const,
          slug: place.canonical_slug,
          name: localizedEntityName(place.names, locale, place.canonical_slug),
          searchText: normalizedEntityTerm([
            place.canonical_slug,
            ...place.legacy_slugs,
            ...place.names.map((name) => name.value),
            place.locality ?? "",
          ].join(" ")),
        })),
      ].filter((entity) => entity.searchText.includes(normalizedEntityQuery))
    : [];

  return (
    <>
      <GlobalNavigation locale={locale} active="atlas" alternatePath={atlasHref(alternateLocale, canonicalState)} />
      <main id="main-content" className="pa-public-main" data-testid="localized-pandas-page">
        <section className={`${publicShellClassName} pa-atlas-header`}>
          <p className="pa-eyebrow">{locale === "zh" ? "吱熊猫 / 熊猫资料" : "ZhiPanda / Panda profiles"}</p>
          <h1>{t.title}</h1>
          <p className="pa-lede">{t.description}</p>
          <div className="mt-6">
            <Link
              href={`/${locale}/pandas/discover` as Route}
              className="inline-flex min-h-12 items-center gap-3 rounded-full bg-[#173d28] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#245c3c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#173d28]/25"
            >
              {locale === "zh" ? "进入沉浸式熊猫画廊" : "Enter immersive panda gallery"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>

          <form role="search" aria-label={t.searchLabel} action={`/${locale}/pandas`} method="get" className="pa-atlas-discovery-form" data-testid="atlas-discovery-form">
            <div className="pa-search-form pa-search-form-compact">
              <label htmlFor="atlas-query">{t.inputLabel}</label>
              <div className="pa-search-row">
                <span className="pa-search-icon" aria-hidden="true"><Search /></span>
                <input id="atlas-query" name="q" type="search" defaultValue={canonicalState.q} placeholder={t.placeholder} autoComplete="off" />
                <button type="submit">{t.submit}</button>
              </div>
            </div>

            <fieldset className="pa-filter-panel">
              <legend>{t.filters}</legend>
              <div className="pa-filter-grid">
                <label>{t.status}
                  <select name="status" defaultValue={canonicalState.status}>
                    <option value="all">{t.all}</option>
                    <option value="alive">{t.alive}</option>
                    <option value="deceased">{t.deceased}</option>
                    <option value="unknown">{t.unknown}</option>
                  </select>
                </label>
                <label>{t.sex}
                  <select name="sex" defaultValue={canonicalState.sex}>
                    <option value="all">{t.all}</option>
                    <option value="male">{t.male}</option>
                    <option value="female">{t.female}</option>
                    <option value="unknown">{t.unknown}</option>
                  </select>
                </label>
                <label>{t.facility}
                  <select name="facility" defaultValue={canonicalState.facility}>
                    <option value="all">{t.all}</option>
                    {view.facilities.map((facility) => (
                      <option key={facility.id} value={facility.id}>{facility.name} · {t.facilityCount(facility.resultCount)}</option>
                    ))}
                  </select>
                </label>
                <label>{t.completeness}
                  <select name="completeness" defaultValue={canonicalState.completeness}>
                    <option value="all">{t.all}</option>
                    <option value="complete">{t.complete}</option>
                    <option value="partial">{t.partial}</option>
                  </select>
                </label>
                <label>{t.sort}
                  <select name="sort" defaultValue={canonicalState.sort}>
                    <option value="relevance">{t.relevance}</option>
                    <option value="name">{t.name}</option>
                    <option value="birth">{t.birth}</option>
                  </select>
                </label>
              </div>
              <div className="pa-filter-actions">
                <button type="submit">{t.submit}</button>
                <Link href={`/${locale}/pandas` as Route}>{t.reset}</Link>
              </div>
            </fieldset>
          </form>
        </section>

        <section className={`${publicShellClassName} pa-section`}>
          <PublicDeliveryNotice locale={locale} release={envelope.release} delivery={envelope.delivery} coverage={envelope.coverage} localeDelivery={envelope.locale} />

          {entityMatches.length ? (
            <section className="rounded-[var(--pa-radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-6" aria-labelledby="atlas-entity-results-heading" data-testid="atlas-entity-results">
              <h2 id="atlas-entity-results-heading" className="text-2xl font-semibold">{t.relatedEntities}</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">{t.noEntityConflation}</p>
              <ul className="mt-5 grid gap-3 md:grid-cols-2">
                {entityMatches.map((entity) => (
                  <li key={entity.id}>
                    <Link
                      href={`/${locale}/${entity.kind === "institution" ? "institutions" : "places"}/${entity.slug}` as Route}
                      className="block rounded-2xl bg-[var(--surface-muted)] p-4 hover:underline"
                    >
                      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                        {entity.kind === "institution" ? t.institutionEntity : t.placeEntity}
                      </span>
                      <strong className="mt-1 block">{entity.name}</strong>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="pa-results-heading" aria-live="polite" data-testid="atlas-result-summary">
            <h2>{t.resultSummary(view.firstResult, view.lastResult, view.totalMatched, view.totalPublished)}</h2>
            <div className="pa-active-query-summary">
              {canonicalState.q ? <span>{t.querySummary(canonicalState.q)}</span> : null}
              {view.activeFilterCount ? <span>{t.activeFilters(view.activeFilterCount)}</span> : null}
              <span>{t.page(view.page, view.pageCount)}</span>
            </div>
            {!view.totalMatched ? <p>{t.noResults}</p> : null}
          </div>

          {view.results.length ? (
            <ol className="pa-result-list" data-testid="atlas-result-list">
              {view.results.map((result) => (
                <li key={result.id}>
                  <Link href={`/${locale}/pandas/${result.slug}` as Route} className="pa-result-card">
                    <div>
                      <p className="pa-result-kicker">{t.id}: {result.id}</p>
                      <h2 lang={result.nameLanguage}>{result.name}</h2>
                      {result.alternateName ? <p className="pa-result-alternate">{result.alternateName}</p> : null}
                    </div>
                    <dl>
                      <div><dt>{t.status}</dt><dd>{localizedStatus(result.status, locale)}</dd></div>
                      <div><dt>{t.sex}</dt><dd>{localizedSex(result.sex, locale)}</dd></div>
                      <div><dt>{t.birthDate}</dt><dd>{result.birthDate ?? t.unknown}</dd></div>
                      <div><dt>{t.currentLocation}</dt><dd>{result.facilityName ?? t.unknown}</dd></div>
                      <div><dt>{t.recordState}</dt><dd>{result.completeness === "complete" ? t.complete : t.partial}</dd></div>
                      <div><dt>{t.mediaState}</dt><dd>{mediaLabel(result.mediaState)}</dd></div>
                    </dl>
                    <span className="pa-result-action">{t.open}<ArrowRight aria-hidden="true" /></span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : null}

          {view.pageCount > 1 ? (
            <nav className="pa-pagination" aria-label={t.page(view.page, view.pageCount)} data-testid="atlas-pagination">
              {view.hasPreviousPage ? (
                <Link href={atlasHref(locale, pageState(canonicalState, view.page - 1)) as Route} rel="prev">
                  <ArrowLeft aria-hidden="true" />{t.previous}
                </Link>
              ) : <span aria-disabled="true"><ArrowLeft aria-hidden="true" />{t.previous}</span>}
              <strong>{t.page(view.page, view.pageCount)}</strong>
              {view.hasNextPage ? (
                <Link href={atlasHref(locale, pageState(canonicalState, view.page + 1)) as Route} rel="next">
                  {t.next}<ArrowRight aria-hidden="true" />
                </Link>
              ) : <span aria-disabled="true">{t.next}<ArrowRight aria-hidden="true" /></span>}
            </nav>
          ) : null}
        </section>
      </main>
    </>
  );
}
