/* eslint-disable @next/next/no-img-element -- licensed article photos are served from their source URL. */
import type { Route } from "next";
import Link from "next/link";

import type { PublicLocale } from "@/lib/locales";

import {
  articleHero,
  articleLocale,
  categoryLabel,
  learningText,
  plainText,
  type LearningArticle,
  type LearningCatalog,
  type LearningTerm,
} from "./learning";
import { TermText } from "./term-text";

const copy = {
  zh: {
    learn: "科普",
    keyFacts: "要点",
    pandas: "文中提到的熊猫",
    references: "参考资料",
    citedOn: "引用于",
    related: "接着读",
  },
  en: {
    learn: "Learn",
    keyFacts: "Key facts",
    pandas: "Pandas in this article",
    references: "References",
    citedOn: "cited",
    related: "Read next",
  },
} as const;

function RefMarks({ refs, numbers }: { refs: string[]; numbers: ReadonlyMap<string, number> }) {
  const marks = refs.flatMap((id) => {
    const number = numbers.get(id);
    return number === undefined ? [] : [number];
  });
  if (!marks.length) return null;
  return (
    <sup className="text-xs tabular-nums text-[var(--pa-color-ink-muted)]">
      {marks.map((number, index) => (
        <span key={number}>
          {index ? "," : "["}
          <a href={`#ref-${number}`}>{number}</a>
        </span>
      ))}
      ]
    </sup>
  );
}

export function LearnArticlePage({
  locale,
  article,
  catalog,
  pandas,
}: {
  locale: PublicLocale;
  article: LearningArticle;
  catalog: LearningCatalog;
  pandas: Array<{ slug: string; name: string }>;
}) {
  const t = copy[locale];
  const terms = new Map<string, LearningTerm>(catalog.terms.map((term) => [term.slug, term]));
  const numbers = new Map(article.references.map((reference, index) => [reference.id, index + 1]));
  const hero = articleHero(article);
  const related = article.relatedArticles
    .map((slug) => catalog.articles.find((item) => item.slug === slug))
    .filter((item): item is LearningArticle => Boolean(item));

  return (
    <main id="main-content" className="pa-shell py-10 text-[var(--pa-color-ink)] sm:py-14">
      <article className="mx-auto grid max-w-[42rem] gap-6">
        <nav aria-label={locale === "zh" ? "位置" : "Breadcrumb"} className="flex gap-2 text-xs text-[var(--pa-color-ink-muted)]">
          <Link href={`/${locale}/learn` as Route} className="hover:underline">{t.learn}</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/${locale}/learn#${article.category}` as Route} className="hover:underline">{categoryLabel(article.category, locale)}</Link>
        </nav>
        <header className="grid gap-3">
          <h1>{learningText(article.title, locale)}</h1>
          <p className="text-[var(--pa-color-ink-muted)]">{plainText(learningText(article.dek, locale))}</p>
        </header>

        {hero?.asset ? (
          <figure className="grid gap-2">
            <img
              src={hero.asset}
              alt={learningText(hero.caption, locale)}
              decoding="async"
              className="aspect-video w-full rounded-[var(--pa-radius-lg)] bg-[var(--pa-color-surface-subtle)] object-cover"
            />
            <figcaption className="text-xs text-[var(--pa-color-ink-muted)]">
              {learningText(hero.caption, locale)}
              {hero.credit ? <span className="ml-3">{hero.credit}</span> : null}
            </figcaption>
          </figure>
        ) : null}

        {article.keyFacts.length ? (
          <aside aria-labelledby="key-facts" className="grid gap-3 rounded-[var(--pa-radius-lg)] bg-[var(--pa-color-surface-subtle)] p-5 text-sm">
            <h2 id="key-facts">{t.keyFacts}</h2>
            <ul className="grid list-disc gap-2 pl-5">
              {article.keyFacts.map((fact) => (
                <li key={fact.text.zh}>
                  {plainText(learningText(fact.text, locale))}
                  <RefMarks refs={fact.refs} numbers={numbers} />
                </li>
              ))}
            </ul>
          </aside>
        ) : null}

        {article.body.sections.map((section, sectionIndex) => (
          <section key={section.heading.zh} className="grid gap-4">
            <h2>{learningText(section.heading, locale)}</h2>
            {section.paragraphs.map((paragraph, paragraphIndex) => (
              <p key={paragraph.text.zh}>
                <TermText
                  source={learningText(paragraph.text, locale)}
                  locale={locale}
                  terms={terms}
                  idPrefix={`term-${sectionIndex}-${paragraphIndex}`}
                />
                <RefMarks refs={paragraph.refs} numbers={numbers} />
              </p>
            ))}
          </section>
        ))}

        {pandas.length ? (
          <section aria-labelledby="article-pandas" className="grid gap-3">
            <h2 id="article-pandas">{t.pandas}</h2>
            <ul className="grid border-t-[0.5px] border-[var(--pa-color-line)]">
              {pandas.map((panda) => (
                <li key={panda.slug} className="border-b-[0.5px] border-[var(--pa-color-line)]">
                  <Link href={`/${locale}/pandas/${panda.slug}` as Route} className="flex min-h-12 items-center font-bold hover:underline">
                    {panda.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="references" className="grid gap-3">
          <h2 id="references">{t.references}</h2>
          <ol className="grid list-decimal gap-2 pl-5 text-sm text-[var(--pa-color-ink-muted)]">
            {article.references.map((reference, index) => (
              <li key={reference.id} id={`ref-${index + 1}`}>
                <a href={reference.url} rel="noreferrer" className="text-[var(--pa-color-ink)] hover:underline">{reference.title}</a>
                <span className="ml-2">{reference.publisher}</span>
                <span className="ml-2">{t.citedOn} {reference.citedOn}</span>
              </li>
            ))}
          </ol>
        </section>

        {related.length ? (
          <section aria-labelledby="related" className="grid gap-3">
            <h2 id="related">{t.related}</h2>
            <ul className="grid border-t-[0.5px] border-[var(--pa-color-line)]">
              {related.map((item) => (
                <li key={item.slug} className="border-b-[0.5px] border-[var(--pa-color-line)]">
                  <Link href={`/${articleLocale(item, locale)}/learn/articles/${item.slug}` as Route} className="flex min-h-12 items-center hover:underline">
                    {learningText(item.title, articleLocale(item, locale))}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </main>
  );
}
