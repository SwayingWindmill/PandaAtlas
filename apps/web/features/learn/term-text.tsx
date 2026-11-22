import type { Route } from "next";
import Link from "next/link";

import type { PublicLocale } from "@/lib/locales";

import { learningText, parseTermMarkup, termLocale, type LearningTerm } from "./learning";
import styles from "./learn.module.css";

/** Renders `[[term|label]]` marks as links to the term page, with its definition on hover or focus. */
export function TermText({
  source,
  locale,
  terms,
  idPrefix,
}: {
  source: string;
  locale: PublicLocale;
  terms: ReadonlyMap<string, LearningTerm>;
  /** Unique per paragraph on the page, so every tooltip id is unique. */
  idPrefix: string;
}) {
  return parseTermMarkup(source).map((piece, index) => {
    if (piece.kind === "text") return piece.value;
    const term = terms.get(piece.slug);
    if (!term) return piece.value;
    const tooltipId = `${idPrefix}-${piece.slug}-${index}`;
    return (
      <Link
        key={tooltipId}
        href={`/${termLocale(term, locale)}/learn/terms/${term.slug}` as Route}
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
