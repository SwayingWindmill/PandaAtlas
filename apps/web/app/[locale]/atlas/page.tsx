import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { GlobalNavigation, publicShellClassName } from "@/components/patterns/global-navigation";
import { PublicDeliveryNotice } from "@/components/patterns/public-delivery-notice";
import { searchPublishedPandas } from "@/features/public-content/public-release";
import { parsePublicLocale } from "@/foundation/content/locales";

interface LocalizedAtlasPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const copy = {
  zh: {
    title: "搜索公开档案",
    description: "当前切片只搜索已审核个体身份。筛选、排序和混合实体结果将在后续 Atlas 切片中提供。",
    searchLabel: "搜索公开档案",
    inputLabel: "熊猫名称或公开标识",
    placeholder: "例如：美香、Mei Xiang、meixiang",
    submit: "搜索",
    emptyQuery: "输入已审核名称、别名、历史拼写或公开标识开始查证。",
    noResults: "当前已发布身份范围内没有匹配结果。这不代表现实中不存在该个体。",
    result: (count: number) => `${count} 份已发布档案`,
    status: "生命状态",
    alive: "存活",
    deceased: "已死亡",
    birth: "出生日期",
    location: "当前公开位置",
    china: "中国（国家级记录）",
    open: "打开可信档案",
    unknown: "暂无已审核记录",
    missingEnglishName: "英文名称尚未审核",
  },
  en: {
    title: "Search public profiles",
    description: "This slice searches reviewed panda identities only. Filters, sorting and mixed entity results belong to the later Atlas slice.",
    searchLabel: "Search public profiles",
    inputLabel: "Panda name or public identifier",
    placeholder: "For example: Mei Xiang, 美香, meixiang",
    submit: "Search",
    emptyQuery: "Enter a reviewed name, alias, historic spelling or public identifier to begin verification.",
    noResults: "No match exists in the currently published identity scope. This does not claim that the panda does not exist in reality.",
    result: (count: number) => `${count} published ${count === 1 ? "profile" : "profiles"}`,
    status: "Life status",
    alive: "Alive",
    deceased: "Deceased",
    birth: "Birth date",
    location: "Current public location",
    china: "China (country-level record)",
    open: "Open trusted profile",
    unknown: "No reviewed record",
    missingEnglishName: "English name not reviewed",
  },
} as const;

function firstSearchParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export async function generateMetadata({ params }: LocalizedAtlasPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const t = copy[locale];
  return {
    title: t.title,
    description: t.description,
    alternates: {
      canonical: `/${locale}/atlas`,
      languages: { "zh-CN": "/zh/atlas", en: "/en/atlas", "x-default": "/zh/atlas" },
    },
  };
}

export default async function LocalizedAtlasPage({ params, searchParams }: LocalizedAtlasPageProps) {
  const [{ locale: rawLocale }, queryParameters] = await Promise.all([params, searchParams]);
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const query = firstSearchParam(queryParameters.q).trim();
  const envelope = searchPublishedPandas(query, locale);
  const t = copy[locale];

  return (
    <>
      <GlobalNavigation locale={locale} active="atlas" alternatePath={`/${locale === "zh" ? "en" : "zh"}/atlas${query ? `?q=${encodeURIComponent(query)}` : ""}`} />
      <main id="main-content" className="pa-public-main" data-testid="localized-atlas-page">
        <section className={`${publicShellClassName} pa-atlas-header`}>
          <p className="pa-eyebrow">PandaAtlas / Public identities</p>
          <h1>{t.title}</h1>
          <p className="pa-lede">{t.description}</p>
          <form role="search" aria-label={t.searchLabel} action={`/${locale}/atlas`} method="get" className="pa-search-form pa-search-form-compact">
            <label htmlFor="atlas-query">{t.inputLabel}</label>
            <div className="pa-search-row">
              <span className="pa-search-icon" aria-hidden="true"><Search /></span>
              <input id="atlas-query" name="q" type="search" defaultValue={query} placeholder={t.placeholder} autoComplete="off" />
              <button type="submit">{t.submit}</button>
            </div>
          </form>
        </section>

        <section className={`${publicShellClassName} pa-section`}>
          <PublicDeliveryNotice locale={locale} release={envelope.release} delivery={envelope.delivery} coverage={envelope.coverage} localeDelivery={envelope.locale} />
          <div className="pa-results-heading">
            <h2>{query ? t.result(envelope.data.results.length) : t.emptyQuery}</h2>
            {query && envelope.data.results.length === 0 ? <p>{t.noResults}</p> : null}
          </div>

          {envelope.data.results.length ? (
            <ol className="pa-result-list">
              {envelope.data.results.map((result) => (
                <li key={result.id}>
                  <a href={`/${locale}/atlas/${result.slug}`} className="pa-result-card">
                    <div>
                      <p className="pa-result-kicker">{result.id}</p>
                      <h2 lang={locale === "en" && result.nameEnTranslation === "missing" ? "zh-CN" : undefined}>
                        {locale === "zh" ? result.nameZh : result.nameEn ?? result.nameZh}
                      </h2>
                      <p className="pa-result-alternate">
                        {locale === "zh" ? result.nameEn : result.nameZh}
                        {locale === "en" && result.nameEnTranslation === "missing" ? ` · ${t.missingEnglishName}` : null}
                      </p>
                    </div>
                    <dl>
                      <div><dt>{t.status}</dt><dd>{result.status === "alive" ? t.alive : result.status === "deceased" ? t.deceased : t.unknown}</dd></div>
                      <div><dt>{t.birth}</dt><dd>{result.birthDate ?? t.unknown}</dd></div>
                      <div><dt>{t.location}</dt><dd>{result.currentLocation === "China" ? t.china : result.currentLocation ?? t.unknown}</dd></div>
                    </dl>
                    <span className="pa-result-action">{t.open}<ArrowRight aria-hidden="true" /></span>
                  </a>
                </li>
              ))}
            </ol>
          ) : null}
        </section>
      </main>
    </>
  );
}
