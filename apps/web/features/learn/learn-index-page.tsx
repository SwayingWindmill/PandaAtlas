/* eslint-disable @next/next/no-img-element -- licensed article photos are served from their source URL. */
import type { Route } from "next";
import Link from "next/link";

import type { PublicLocale } from "@/lib/locales";
import { publicLanguageTag } from "@/lib/locales";

import {
  articleHero,
  articleLocale,
  categoryLabel,
  LEARNING_CATEGORIES,
  learningText,
  plainText,
  termLocale,
  type LearningCatalog,
} from "./learning";

export const learnIndexCopy = {
  zh: {
    title: "熊猫科普",
    description: (articles: number, terms: number) => `${articles} 篇文章，${terms} 个词条。每篇都附原始出处。`,
    sections: "分类",
    terms: "词条",
    chineseOnly: "中文",
  },
  en: {
    title: "Learn about pandas",
    description: (articles: number, terms: number) => `${articles} articles and ${terms} terms, each with its original sources.`,
    sections: "Categories",
    terms: "Terms",
    chineseOnly: "In Chinese",
  },
} as const;

export function LearnIndexPage({ locale, catalog }: { locale: PublicLocale; catalog: LearningCatalog }) {
  const copy = learnIndexCopy[locale];
  const categories = LEARNING_CATEGORIES.filter((category) => catalog.articles.some((article) => article.category === category));
  return (
    <main id="main-content" className="pa-shell grid gap-10 py-10 text-[var(--pa-color-ink)] sm:py-14">
      <header className="grid gap-2">
        <h1>{copy.title}</h1>
        <p className="text-[var(--pa-color-ink-muted)]">{copy.description(catalog.articles.length, catalog.terms.length)}</p>
      </header>

      <nav aria-label={copy.sections} className="flex flex-wrap gap-x-5 border-b-[0.5px] border-[var(--pa-color-line)] text-sm">
        {categories.map((category) => (
          <a key={category} href={`#${category}`} className="inline-flex min-h-10 items-center text-[var(--pa-color-ink-muted)] hover:text-[var(--pa-color-ink)]">
            {categoryLabel(category, locale)}
          </a>
        ))}
        <a href="#terms" className="inline-flex min-h-10 items-center text-[var(--pa-color-ink-muted)] hover:text-[var(--pa-color-ink)]">
          {copy.terms}
        </a>
      </nav>

      {categories.map((category) => (
        <section key={category} aria-labelledby={category} className="grid gap-5">
          <h2 id={category} className="scroll-mt-6">{categoryLabel(category, locale)}</h2>
          <ul className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.articles.filter((article) => article.category === category).map((article) => {
              const pageLocale = articleLocale(article, locale);
              const hero = articleHero(article);
              return (
                <li key={article.slug} lang={publicLanguageTag(pageLocale)}>
                  <Link href={`/${pageLocale}/learn/articles/${article.slug}` as Route} className="group grid gap-2">
                    {hero?.asset ? (
                      <img
                        src={hero.asset}
                        alt=""
                        loading="lazy"
                        className="aspect-[3/2] w-full rounded-[var(--pa-radius-lg)] bg-[var(--pa-color-surface-subtle)] object-cover"
                      />
                    ) : (
                      <span aria-hidden="true" className="aspect-[3/2] w-full rounded-[var(--pa-radius-lg)] bg-[var(--pa-color-surface-subtle)]" />
                    )}
                    {pageLocale !== locale ? (
                      <span lang={publicLanguageTag(locale)} className="text-xs font-bold text-[var(--pa-color-highlight-text)]">{copy.chineseOnly}</span>
                    ) : null}
                    <span className="font-bold group-hover:underline group-hover:underline-offset-[3px]">{learningText(article.title, pageLocale)}</span>
                    <span className="text-sm text-[var(--pa-color-ink-muted)]">{plainText(learningText(article.dek, pageLocale))}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section aria-labelledby="terms" className="grid gap-4">
        <h2 id="terms" className="scroll-mt-6">{copy.terms}</h2>
        <ul className="flex flex-wrap gap-x-6 gap-y-1">
          {catalog.terms.map((term) => {
            const pageLocale = termLocale(term, locale);
            return (
              <li key={term.slug} lang={publicLanguageTag(pageLocale)}>
                <Link
                  href={`/${pageLocale}/learn/terms/${term.slug}` as Route}
                  className="inline-flex min-h-10 items-center underline decoration-[var(--pa-color-highlight)] decoration-[1.5px] underline-offset-4"
                >
                  {learningText(term.term, pageLocale)}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
