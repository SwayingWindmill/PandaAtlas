/* eslint-disable @next/next/no-img-element -- prototype renders published external panda media directly. */

import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Building2, MapPin, Search, UserRoundSearch } from "lucide-react";

import { loadPublishedAtlasDataset } from "@/features/public-content/public-release";
import { buildPublicSearchViewModel, type PublicSearchResultType, type PublicSearchType } from "@/features/search/public-search-view-model";
import { parsePublicLocale } from "@/foundation/content/locales";

import { PrototypeShell } from "../prototype-kit";
import styles from "../subpages.module.css";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = {
  title: "ZhiPanda search prototype V0.7",
  robots: { index: false, follow: false },
};

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function parseType(value: string): PublicSearchType {
  return value === "pandas" || value === "institutions" || value === "places" ? value : "all";
}

function href(locale: string, query: string, type: PublicSearchType): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (type !== "all") params.set("type", type);
  return `/${locale}/prototype/fan-v07/search${params.size ? `?${params}` : ""}`;
}

function ResultIcon({ type }: { type: PublicSearchResultType }) {
  if (type === "pandas") return <UserRoundSearch aria-hidden="true" />;
  if (type === "institutions") return <Building2 aria-hidden="true" />;
  return <MapPin aria-hidden="true" />;
}

export default async function FanV07Search({ params, searchParams }: Props) {
  const [{ locale: rawLocale }, rawSearch] = await Promise.all([params, searchParams]);
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const zh = locale === "zh";
  const query = one(rawSearch.q).trim().slice(0, 120);
  const type = parseType(one(rawSearch.type));
  const envelope = loadPublishedAtlasDataset(locale);
  const view = buildPublicSearchViewModel(envelope.data, query, type, locale);
  const other = locale === "zh" ? "en" : "zh";

  const labels: Record<PublicSearchType, string> = {
    all: zh ? "全部" : "All",
    pandas: zh ? "熊猫" : "Pandas",
    institutions: zh ? "机构" : "Institutions",
    places: zh ? "地点" : "Places",
  };
  const tabs: Array<{ type: PublicSearchType; count: number }> = [
    { type: "all", count: view.counts.pandas + view.counts.institutions + view.counts.places },
    { type: "pandas", count: view.counts.pandas },
    { type: "institutions", count: view.counts.institutions },
    { type: "places", count: view.counts.places },
  ];
  const examples = zh ? ["美香", "福宝", "卧龙", "Smithsonian"] : ["Mei Xiang", "Fu Bao", "Wolong", "Smithsonian"];

  return (
    <PrototypeShell locale={locale} alternatePath={href(other, view.query, view.type)}>
      <main className={styles.subPage}>
        <div className={styles.subShell}>
          <section className={styles.searchPrototypeHero}>
            <p className={styles.sectionLabel}>{zh ? "Search · 全站搜索" : "Search"}</p>
            <h1>{zh ? "找一只熊猫，也可以找它生活过的地方。" : "Find a panda — or the places connected to its life."}</h1>
            <p>{zh ? "搜索直接读当前公开版本，熊猫、机构和地点共用一个入口。结果强调“这是什么”和“为什么匹配”，而不是只列一串链接。" : "Search reads the current public release directly. Pandas, institutions, and places share one entry point, with results explaining what each item is and why it matters."}</p>
            <form className={styles.searchPrototypeForm} action={`/${locale}/prototype/fan-v07/search`} method="get" role="search">
              <Search aria-hidden="true" />
              <input name="q" type="search" defaultValue={view.query} placeholder={zh ? "美香、福宝、卧龙、Smithsonian…" : "Mei Xiang, Fu Bao, Wolong, Smithsonian…"} autoComplete="off" />
              {view.type !== "all" ? <input type="hidden" name="type" value={view.type} /> : null}
              <button type="submit">{zh ? "搜索" : "Search"}</button>
            </form>
            {!view.query ? <div className={styles.searchExamples}>{examples.map((example) => <Link key={example} href={href(locale, example, "all") as Route}>{example}</Link>)}</div> : null}
          </section>

          {view.query ? (
            <nav className={styles.searchTabs} aria-label={zh ? "搜索结果类型" : "Search result types"}>
              {tabs.map((tab) => <Link key={tab.type} href={href(locale, view.query, tab.type) as Route} aria-current={view.type === tab.type ? "page" : undefined}><span>{labels[tab.type]}</span><strong>{tab.count}</strong></Link>)}
            </nav>
          ) : null}

          <section className={styles.searchResultsSection}>
            {view.query ? (
              <div className={styles.searchResultsHeading}>
                <div><p className={styles.sectionLabel}>{zh ? "Results · 结果" : "Results"}</p><h2>{zh ? `${view.totalMatched} 个结果` : `${view.totalMatched} results`}</h2></div>
                <p>“{view.query}” · {labels[view.type]}</p>
              </div>
            ) : null}

            {!view.query ? (
              <div className={styles.searchStartState}>{zh ? "输入熊猫名字、别名、机构或地点开始。" : "Enter a panda name, alias, institution, or place to begin."}</div>
            ) : view.results.length ? (
              <div className={styles.searchResultList}>
                {view.results.map((result) => {
                  const targetHref = result.type === "pandas"
                    ? `/${locale}/prototype/fan-v07/panda/${result.href.split("/").pop() ?? ""}`
                    : result.href;
                  return (
                    <Link key={`${result.type}:${result.id}`} className={styles.searchResultRow} href={targetHref as Route}>
                      {result.imageUrl ? <span className={styles.searchResultMedia}><img src={result.imageUrl} alt="" loading="lazy" /></span> : <span className={styles.searchResultIcon}><ResultIcon type={result.type} /></span>}
                      <span className={styles.searchResultCopy}><small>{labels[result.type]}</small><strong>{result.name}</strong>{result.alternateName ? <em>{result.alternateName}</em> : null}<p>{result.detail}</p></span>
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  );
                })}
              </div>
            ) : <div className={styles.searchStartState}>{zh ? "当前公开版本里没有匹配结果。可以试试另一种语言、别名或更短关键词。" : "No matches in the current public release. Try another language, alias, or a shorter keyword."}</div>}
          </section>
        </div>
      </main>
    </PrototypeShell>
  );
}
