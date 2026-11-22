import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StructuredDataScript } from "@/components/structured-data-script";
import { OpenInAppBar } from "@/features/app-download/open-in-app-bar";
import { LearnArticlePage } from "@/features/learn/learn-article-page";
import {
  articleHero,
  articleLocale,
  articlePandaSlugs,
  learningText,
  loadLearningCatalog,
  plainText,
  type LearningArticle,
} from "@/features/learn/learning";
import { loadV2PublicAtlasDataset } from "@/features/public-content/public-v2";
import { appDownloadLinks } from "@/lib/app-download";
import { parsePublicLocale, type PublicLocale } from "@/lib/locales";
import { buildPublicMetadata } from "@/lib/public-metadata";
import { readPublicMetadata } from "@/lib/server/public-read";
import { buildLearnArticleStructuredData } from "@/lib/structured-data";

interface ArticleRouteProps {
  params: Promise<{ locale: string; slug: string }>;
}

async function findArticle(rawLocale: string, slug: string) {
  const locale = parsePublicLocale(rawLocale);
  if (!locale) return null;
  const catalog = await loadLearningCatalog();
  const article = catalog.articles.find((item) => item.slug === slug);
  if (!article || articleLocale(article, locale) !== locale) return null;
  return { locale, catalog, article };
}

export async function generateMetadata({ params }: ArticleRouteProps): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const found = await readPublicMetadata(() => findArticle(rawLocale, slug));
  if (!found) return {};
  const { locale, article } = found;
  const hero = articleHero(article);
  return buildPublicMetadata({
    locale,
    title: `${learningText(article.title, locale)} | ${locale === "zh" ? "吱熊猫" : "ZhiPanda"}`,
    description: plainText(learningText(article.dek, locale)),
    path: `/learn/articles/${article.slug}`,
    image: hero?.asset ? { url: hero.asset, alt: learningText(hero.caption, locale) } : null,
    singleLocale: !article.title.en,
  });
}

async function articlePandas(article: LearningArticle, locale: PublicLocale) {
  const slugs = articlePandaSlugs(article);
  if (!slugs.length) return [];
  const { data } = await loadV2PublicAtlasDataset(locale);
  return slugs.flatMap((slug) => {
    const panda = data.pandas.find((item) => item.slug === slug);
    if (!panda) return [];
    return [{ slug, name: locale === "zh" ? panda.name_zh : panda.name_en ?? panda.name_zh }];
  });
}

export default async function ArticleRoute({ params }: ArticleRouteProps) {
  const { locale: rawLocale, slug } = await params;
  const found = await findArticle(rawLocale, slug);
  if (!found) notFound();
  const { locale, catalog, article } = found;
  const pandas = await articlePandas(article, locale);
  const hero = articleHero(article);
  return (
    <>
      <StructuredDataScript
        testId="learn-article-structured-data"
        data={buildLearnArticleStructuredData({
          locale,
          slug: article.slug,
          headline: learningText(article.title, locale),
          description: plainText(learningText(article.dek, locale)),
          imageUrl: hero?.asset ?? null,
          about: pandas,
          citations: article.references.map((reference) => ({ title: reference.title, url: reference.url })),
        })}
      />
      <LearnArticlePage locale={locale} article={article} catalog={catalog} pandas={pandas} />
      <OpenInAppBar
        locale={locale}
        links={appDownloadLinks()}
        message={locale === "zh" ? "在 App 里随时读熊猫科普" : "Read panda articles any time in the app"}
      />
    </>
  );
}
