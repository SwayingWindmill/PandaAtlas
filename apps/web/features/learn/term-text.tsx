import type { Route } from "next";
import Link from "next/link";

import type { PublicLocale } from "@/lib/locales";

import { learningText, parseTermMarkup, type LearningTerm } from "./learning";
import styles from "./learn.module.css";

/** Renders `[[term|label]]` marks as links to the term page, with its definition on hover or focus. */
export function TermText({
  source,
  locale,
  terms,
}: {
  source: string;
  locale: PublicLocale;
  terms: ReadonlyMap<string, LearningTerm>;
}) {
  return parseTermMarkup(source).map((piece, index) => {
    if (piece.kind === "text") return piece.value;
    const term = terms.get(piece.slug);
    if (!term) return piece.value;
    const tooltipId = `term-${piece.slug}-${index}`;
    return (
      <Link
        key={tooltipId}
        href={`/${locale}/learn/terms/${term.slug}` as Route}
        className={styles.term}
        aria-describedby={tooltipId}
      >
        {piece.value}
        <span id={tooltipId} aria-hidden="true" className={styles.termCard}>
          <strong>{learningText(term.term, locale)}</strong>
          <span>{learningText(term.definition, locale)}</span>
        </span>
      </Link>
    );
  });
}
