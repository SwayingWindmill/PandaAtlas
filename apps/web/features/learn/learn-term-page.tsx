import type { Route } from "next";
import Link from "next/link";

import { alternateLocale, publicLanguageTag, type PublicLocale } from "@/lib/locales";

import { articleLocale, articlesUsingTerm, learningText, termLocale, type LearningCatalog, type LearningTerm } from "./learning";

const copy = {
  zh: { learn: "科普", terms: "词条", related: "相关词条", articles: "出现在这些文章里", sources: "出处" },
  en: { learn: "Learn", terms: "Terms", related: "Related terms", articles: "Used in these articles", sources: "Sources" },
} as const;

export function LearnTermPage({ locale, term, catalog }: { locale: PublicLocale; term: LearningTerm; catalog: LearningCatalog }) {
  const t = copy[locale];
  const otherLocale = alternateLocale(locale);
  const otherName = term.term[otherLocale];
  const related = term.relatedSlugs
    .map((slug) => catalog.terms.find((item) => item.slug === slug))
    .filter((item): item is LearningTerm => Boolean(item));
  const articles = articlesUsingTerm(catalog, term.slug);

  return (
    <main id="main-content" className="pa-shell py-10 text-[var(--pa-color-ink)] sm:py-14">
      <article className="mx-auto grid max-w-[42rem] gap-6">
        <nav aria-label={locale === "zh" ? "位置" : "Breadcrumb"} className="flex gap-2 text-xs text-[var(--pa-color-ink-muted)]">
          <Link href={`/${locale}/learn` as Route} className="hover:underline">{t.learn}</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/${locale}/learn#terms` as Route} className="hover:underline">{t.terms}</Link>
        </nav>
        <header className="grid gap-1">
          <h1>{learningText(term.term, locale)}</h1>
          {otherName && otherName !== learningText(term.term, locale) ? (
            <p lang={publicLanguageTag(otherLocale)} className="text-sm text-[var(--pa-color-ink-muted)]">{otherName}</p>
          ) : null}
        </header>
        <p>{learningText(term.definition, locale)}</p>

        {related.length ? (
          <section aria-labelledby="related-terms" className="grid gap-3">
            <h2 id="related-terms">{t.related}</h2>
            <ul className="flex flex-wrap gap-x-6">
              {related.map((item) => (
                <li key={item.slug} lang={publicLanguageTag(termLocale(item, locale))}>
                  <Link href={`/${termLocale(item, locale)}/learn/terms/${item.slug}` as Route} className="inline-flex min-h-10 items-center underline decoration-[var(--pa-color-highlight)] decoration-[1.5px] underline-offset-4">
                    {learningText(item.term, termLocale(item, locale))}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {articles.length ? (
          <section aria-labelledby="term-articles" className="grid gap-3">
            <h2 id="term-articles">{t.articles}</h2>
            <ul className="grid border-t-[0.5px] border-[var(--pa-color-line)]">
              {articles.map((article) => {
                const pageLocale = articleLocale(article, locale);
                return (
                  <li key={article.slug} lang={publicLanguageTag(pageLocale)} className="border-b-[0.5px] border-[var(--pa-color-line)]">
                    <Link href={`/${pageLocale}/learn/articles/${article.slug}` as Route} className="flex min-h-12 items-center font-bold hover:underline">
                      {learningText(article.title, pageLocale)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {term.sources.length ? (
          <section aria-labelledby="term-sources" className="grid gap-3">
            <h2 id="term-sources">{t.sources}</h2>
            <ul className="grid gap-2 text-sm">
              {term.sources.map((source) => (
                <li key={source.url}>
                  <a href={source.url} rel="noreferrer" className="hover:underline">{learningText(source.title, locale)}</a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </main>
  );
}
