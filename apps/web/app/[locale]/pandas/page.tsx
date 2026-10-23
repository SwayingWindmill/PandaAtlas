/* eslint-disable @next/next/no-img-element -- licensed panda covers are served from the public media origin. */

import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown, LayoutGrid, MapPin, Search } from "lucide-react";
import { publicShellClassName } from "@/components/patterns/public-shell";
import { PublicDeliveryNotice } from "@/components/patterns/public-delivery-notice";
import { atlasHref, parseAtlasQuery, type AtlasQueryState } from "@/features/atlas/atlas-query";
import { buildAtlasSearchViewModel } from "@/features/atlas/atlas-search";
import { loadV2PandaCovers, loadV2PublicAtlasDataset, pandaCoverMedia } from "@/features/public-content/public-v2";
import { parsePublicLocale } from "@/foundation/content/locales";
import { buildPublicMetadata } from "@/foundation/metadata/public-metadata";

import styles from "./pandas-page.module.css";

interface LocalizedPandasPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const copy = {
  zh: {
    title: "熊猫图鉴 | 吱熊猫",
    description: "按名字、状态、性别和生活地点寻找大熊猫，继续探索它们的资料、家族和生活足迹。",
    heading: "全部熊猫",
    count: (total: number) => `${total} 只`,
    gallery: "画廊",
    searchLabel: "寻找熊猫",
    inputLabel: "熊猫名字",
    placeholder: "输入熊猫名字，比如 美香",
    search: "搜索",
    filters: "筛选条件",
    status: "状态",
    sex: "性别",
    facility: "所在地",
    sort: "排序",
    all: "全部",
    alive: "在世",
    deceased: "已离世",
    unknown: "未知",
    male: "雄性",
    female: "雌性",
    relevance: "默认",
    name: "名称",
    birth: "出生日期",
    submit: "应用筛选",
    reset: "清除筛选",
    resultSummary: (matched: number) => matched ? `共找到 ${matched} 只熊猫` : "没有找到熊猫",
    noResults: "换个名字，或减少筛选条件。",
    emptyTitle: "没有符合条件的熊猫",
    emptyQuery: (query: string) => `没找到「${query}」`,
    tryThese: "试试这些熊猫",
    born: (year: string) => `${year} 年出生`,
    previous: "上一页",
    next: "下一页",
    page: (current: number, total: number) => `第 ${current} 页，共 ${total} 页`,
    facilityCount: (count: number) => `（${count} 只）`,
    relatedEntities: "匹配的地点",
    institutionEntity: "机构",
    placeEntity: "场所",
  },
  en: {
    title: "Panda guide | ZhiPanda",
    description: "Find giant pandas by name, life status, sex, and current place, then continue to their profiles, families, and life journeys.",
    heading: "All pandas",
    count: (total: number) => `${total}`,
    gallery: "Gallery",
    searchLabel: "Find a panda",
    inputLabel: "Panda name",
    placeholder: "Enter a panda's name, e.g. Mei Xiang",
    search: "Search",
    filters: "Filters",
    status: "Status",
    sex: "Sex",
    facility: "Lives at",
    sort: "Sort",
    all: "All",
    alive: "Living",
    deceased: "Deceased",
    unknown: "Unknown",
    male: "Male",
    female: "Female",
    relevance: "Default",
    name: "Name",
    birth: "Birth date",
    submit: "Apply filters",
    reset: "Clear filters",
    resultSummary: (matched: number) => matched ? `${matched} ${matched === 1 ? "panda" : "pandas"} found` : "No pandas found",
    noResults: "Try another name or fewer filters.",
    emptyTitle: "No pandas match these filters",
    emptyQuery: (query: string) => `Nothing found for “${query}”`,
    tryThese: "Try these pandas",
    born: (year: string) => `Born ${year}`,
    previous: "Previous",
    next: "Next",
    page: (current: number, total: number) => `Page ${current} of ${total}`,
    facilityCount: (count: number) => ` (${count})`,
    relatedEntities: "Matching places",
    institutionEntity: "Institution",
    placeEntity: "Place",
  },
} as const;

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

  const envelope = await loadV2PublicAtlasDataset(locale);
  if (!envelope) notFound();
  const parsed = parseAtlasQuery(rawQuery, envelope.data.facilities);
  const view = buildAtlasSearchViewModel(envelope.data.pandas, envelope.data.facilities, parsed.state, locale);
  const canonicalState = { ...parsed.state, page: view.page };
  const canonicalHref = atlasHref(locale, canonicalState);
  if (parsed.needsNormalization || view.page !== parsed.state.page) permanentRedirect(canonicalHref as Route);

  const t = copy[locale];
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

  const covers = await loadV2PandaCovers(view.results.map((result) => result.id));
  const hasConditions = Boolean(canonicalState.q) || view.activeFilterCount > 0;
  const suggestions = view.totalMatched ? [] : envelope.data.pandas.slice(0, 4);
  // A stale or partial delivery is a warning the reader needs before the results; a live one is a footnote.
  const deliveryNotice = (
    <PublicDeliveryNotice locale={locale} release={envelope.release} delivery={envelope.delivery} coverage={envelope.coverage} localeDelivery={envelope.locale} />
  );
  const deliveryIsLive = envelope.delivery.state === "live";

  return (
    <main id="main-content" className={styles.page} data-testid="localized-pandas-page">
      <form role="search" aria-label={t.searchLabel} action={`/${locale}/pandas`} method="get" data-testid="atlas-discovery-form">
        <section className={`${publicShellClassName} ${styles.top}`}>
          <div className={styles.heading}>
            <h1>{t.heading}<span>{t.count(view.totalPublished)}</span></h1>
            <Link href={`/${locale}/pandas/discover` as Route} className={styles.gallery}>
              <LayoutGrid aria-hidden="true" />{t.gallery}
            </Link>
          </div>
          <div className={styles.search}>
            <Search aria-hidden="true" />
            <label htmlFor="atlas-query" className="sr-only">{t.inputLabel}</label>
            <input id="atlas-query" name="q" type="search" defaultValue={canonicalState.q} placeholder={t.placeholder} autoComplete="off" />
            <button type="submit">{t.search}</button>
          </div>
        </section>

        <fieldset className={styles.filters}>
          <legend className="sr-only">{t.filters}</legend>
          <div className={publicShellClassName}>
            <label className={styles.select}>
              <span>{t.status}</span>
              <select name="status" defaultValue={canonicalState.status}>
                <option value="all">{t.all}</option>
                <option value="alive">{t.alive}</option>
                <option value="deceased">{t.deceased}</option>
                <option value="unknown">{t.unknown}</option>
              </select>
              <ChevronDown aria-hidden="true" />
            </label>
            <label className={styles.select}>
              <span>{t.sex}</span>
              <select name="sex" defaultValue={canonicalState.sex}>
                <option value="all">{t.all}</option>
                <option value="male">{t.male}</option>
                <option value="female">{t.female}</option>
                <option value="unknown">{t.unknown}</option>
              </select>
              <ChevronDown aria-hidden="true" />
            </label>
            <label className={styles.select}>
              <span>{t.facility}</span>
              <select name="facility" defaultValue={canonicalState.facility}>
                <option value="all">{t.all}</option>
                {view.facilities.map((facility) => (
                  <option key={facility.id} value={facility.id}>{facility.name}{t.facilityCount(facility.resultCount)}</option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" />
            </label>
            <label className={styles.select}>
              <span>{t.sort}</span>
              <select name="sort" defaultValue={canonicalState.sort}>
                <option value="relevance">{t.relevance}</option>
                <option value="name">{t.name}</option>
                <option value="birth">{t.birth}</option>
              </select>
              <ChevronDown aria-hidden="true" />
            </label>
            <button type="submit" className={styles.apply}>{t.submit}</button>
            {hasConditions ? <Link href={`/${locale}/pandas` as Route} className={styles.reset}>{t.reset}</Link> : null}
          </div>
        </fieldset>
      </form>

      <section className={`${publicShellClassName} ${styles.results}`}>
        {deliveryIsLive ? null : <div className={styles.alert}>{deliveryNotice}</div>}
        {entityMatches.length ? (
          <section className={styles.entities} aria-labelledby="atlas-entity-results-heading" data-testid="atlas-entity-results">
            <h2 id="atlas-entity-results-heading">{t.relatedEntities}</h2>
            <ul>
              {entityMatches.map((entity) => (
                <li key={entity.id}>
                  <Link href={`/${locale}/${entity.kind === "institution" ? "institutions" : "places"}/${entity.slug}` as Route}>
                    <MapPin aria-hidden="true" />
                    <span>
                      <small>{entity.kind === "institution" ? t.institutionEntity : t.placeEntity}</small>
                      <strong>{entity.name}</strong>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className={styles.summary} aria-live="polite" data-testid="atlas-result-summary">
          <h2>{t.resultSummary(view.totalMatched)}</h2>
        </div>

        {view.results.length ? (
          <ol className={styles.grid} data-testid="atlas-result-list">
            {view.results.map((result) => {
              const cover = covers.get(result.id);
              const media = cover ? pandaCoverMedia(cover, result.name, locale) : null;
              const facts = [
                result.facilityName,
                result.birthDate ? t.born(result.birthDate.slice(0, 4)) : null,
                result.status === "deceased" ? t.deceased : null,
              ].filter((fact): fact is string => Boolean(fact));
              return (
                <li key={result.id}>
                  <Link href={`/${locale}/pandas/${result.slug}` as Route} className={styles.card}>
                    <span className={styles.photo}>
                      {media ? (
                        <img src={media.src} alt={media.alt} loading="lazy" decoding="async" sizes="(min-width: 1000px) 22vw, 50vw" />
                      ) : (
                        <span className={styles.noPhoto} aria-hidden="true">{Array.from(result.name)[0]}</span>
                      )}
                    </span>
                    <span className={styles.name}>
                      <h3 lang={result.nameLanguage}>{result.name}</h3>
                      {result.alternateName ? <small>{result.alternateName}</small> : null}
                    </span>
                    {facts.length ? (
                      <span className={styles.facts}>
                        {facts.map((fact) => <span key={fact}>{fact}</span>)}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className={styles.empty}>
            <span className={styles.face} aria-hidden="true" />
            <h3>{canonicalState.q ? t.emptyQuery(canonicalState.q) : t.emptyTitle}</h3>
            <p>{t.noResults}</p>
            {suggestions.length ? (
              <ul aria-label={t.tryThese}>
                {suggestions.map((panda) => (
                  <li key={panda.id}>
                    <Link href={`/${locale}/pandas/${panda.slug}` as Route} lang={locale === "en" && panda.name_en ? "en" : "zh-CN"}>
                      {locale === "zh" ? panda.name_zh : panda.name_en ?? panda.name_zh}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
            <Link href={`/${locale}/pandas` as Route} className={styles.apply}>{t.reset}</Link>
          </div>
        )}

        {view.pageCount > 1 ? (
          <nav className={styles.pagination} aria-label={t.page(view.page, view.pageCount)} data-testid="atlas-pagination">
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

        {deliveryIsLive ? <div className={styles.notice}>{deliveryNotice}</div> : null}
      </section>
    </main>
  );
}
