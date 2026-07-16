import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpenCheck, Search, ShieldCheck } from "lucide-react";
import { GlobalNavigation, publicShellClassName } from "@/components/patterns/global-navigation";
import { PublicDeliveryNotice } from "@/components/patterns/public-delivery-notice";
import { searchPublishedPandas } from "@/features/public-content/public-release";
import { parsePublicLocale } from "@/foundation/content/locales";

interface LocalizedHomePageProps {
  params: Promise<{ locale: string }>;
}

const copy = {
  zh: {
    title: "可信的大熊猫公开档案",
    description: "按已审核名称、别名或公开标识搜索。每条关键事实都保留来源、核实时间、精度与发布状态。",
    searchLabel: "搜索公开档案",
    inputLabel: "熊猫名称或公开标识",
    placeholder: "例如：美香、Mei Xiang、meixiang",
    search: "搜索",
    atlas: "浏览熊猫档案",
    trustTitle: "先说明证据，再展示结论",
    trustBody: "PandaAtlas 不用生成式故事、来源不明图片或静默示例数据补齐页面。没有足够证据时，页面会明确显示未知、部分可用或不可用。",
    bilingualTitle: "同一身份，双语查证",
    bilingualBody: "中文名、英文名、拼音、历史拼写与外部公开标识都解析到同一个稳定身份。切换语言不会切换事实版本。",
    noMediaTitle: "无授权媒体也能完成任务",
    noMediaBody: "身份、关键事实、来源与修订不依赖英雄图片。没有明确许可的媒体时，档案使用设计化空状态。",
  },
  en: {
    title: "Trusted public giant panda profiles",
    description: "Search reviewed names, aliases or public identifiers. Every key fact retains its source, verification date, precision and release status.",
    searchLabel: "Search public profiles",
    inputLabel: "Panda name or public identifier",
    placeholder: "For example: Mei Xiang, 美香, meixiang",
    search: "Search",
    atlas: "Browse panda profiles",
    trustTitle: "Evidence before conclusions",
    trustBody: "PandaAtlas does not complete pages with generated stories, unverified imagery or silent demo data. When evidence is insufficient, the page says unknown, partial or unavailable.",
    bilingualTitle: "One identity, bilingual verification",
    bilingualBody: "Chinese names, English names, pinyin, historic spellings and external public identifiers resolve to the same stable identity. Changing language does not change the fact release.",
    noMediaTitle: "The task works without licensed media",
    noMediaBody: "Identity, key facts, sources and revisions do not depend on a hero image. Profiles use a designed empty state when licensed media is unavailable.",
  },
} as const;

export async function generateMetadata({ params }: LocalizedHomePageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return {};
  const t = copy[locale];
  return {
    title: t.title,
    description: t.description,
    alternates: {
      canonical: `/${locale}`,
      languages: { "zh-CN": "/zh", en: "/en", "x-default": "/zh" },
    },
  };
}

export default async function LocalizedHomePage({ params }: LocalizedHomePageProps) {
  const { locale: rawLocale } = await params;
  const locale = parsePublicLocale(rawLocale);
  if (!locale) notFound();
  const t = copy[locale];
  const envelope = searchPublishedPandas("", locale);

  return (
    <>
      <GlobalNavigation locale={locale} active="home" />
      <main id="main-content" className="pa-public-main">
        <section className={`${publicShellClassName} pa-entry-hero`}>
          <div className="pa-entry-copy">
            <p className="pa-eyebrow"><ShieldCheck aria-hidden="true" />PandaAtlas public release</p>
            <h1>{t.title}</h1>
            <p className="pa-lede">{t.description}</p>
            <form role="search" aria-label={t.searchLabel} action={`/${locale}/atlas`} method="get" className="pa-search-form">
              <label htmlFor="public-profile-query">{t.inputLabel}</label>
              <div className="pa-search-row">
                <span className="pa-search-icon" aria-hidden="true"><Search /></span>
                <input id="public-profile-query" name="q" type="search" placeholder={t.placeholder} autoComplete="off" />
                <button type="submit">{t.search}</button>
              </div>
            </form>
            <Link href={`/${locale}/atlas` as Route} className="pa-text-link">
              {t.atlas}<ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <aside className="pa-no-media-identity" aria-label={locale === "zh" ? "无媒体安全的档案入口" : "No-media-safe archive entry"}>
            <BookOpenCheck aria-hidden="true" />
            <strong>{locale === "zh" ? "公开档案不以图片作为身份依据" : "Public profiles do not use imagery as identity evidence"}</strong>
            <p>{locale === "zh" ? "当前入口只展示已审核身份发布集。" : "This entry only exposes the reviewed identity release."}</p>
          </aside>
        </section>

        <section className={`${publicShellClassName} pa-section`}>
          <PublicDeliveryNotice locale={locale} release={envelope.release} delivery={envelope.delivery} coverage={envelope.coverage} localeDelivery={envelope.locale} />
          <div className="pa-principle-grid">
            {[
              [t.trustTitle, t.trustBody],
              [t.bilingualTitle, t.bilingualBody],
              [t.noMediaTitle, t.noMediaBody],
            ].map(([title, body]) => (
              <article key={title} className="pa-principle-card">
                <h2>{title}</h2>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
