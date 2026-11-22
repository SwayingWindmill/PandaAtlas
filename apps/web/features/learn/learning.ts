import "server-only";

import type { components } from "@zhipanda/api-client";
import { cache } from "react";

import type { PublicLocale } from "@/lib/locales";
import { requirePublicCollection, settlePublicRead } from "@/lib/server/public-read";
import { createServerV2Client } from "@/lib/server/v2-api";

type Schemas = components["schemas"];
export type LearningCatalog = Schemas["LearningCatalogDto"];
export type LearningArticle = Schemas["LearningArticleDto"];
export type LearningTerm = Schemas["LearningTermDto"];
export type LearningText = Schemas["LearningTextDto"];

export const loadLearningCatalog = cache(async (): Promise<LearningCatalog> =>
  requirePublicCollection(await settlePublicRead(createServerV2Client().GET("/api/v2/learning"))),
);

export const LEARNING_CATEGORIES = ["外形与识别", "食性", "繁殖与成长", "保护"] as const satisfies readonly LearningArticle["category"][];

const categoryLabels: Record<LearningArticle["category"], Record<PublicLocale, string>> = {
  外形与识别: { zh: "外形与识别", en: "Looks and identification" },
  食性: { zh: "食性", en: "Diet" },
  繁殖与成长: { zh: "繁殖与成长", en: "Breeding and growing up" },
  保护: { zh: "保护", en: "Conservation" },
};

export function categoryLabel(category: LearningArticle["category"], locale: PublicLocale): string {
  return categoryLabels[category][locale];
}

// The API marks a Chinese-only item with an empty `en`.
export function learningText(text: LearningText, locale: PublicLocale): string {
  return locale === "en" && text.en ? text.en : text.zh;
}

/** An article has a page in a locale only when its title is written in that language. */
export function articleLocale(article: LearningArticle, locale: PublicLocale): PublicLocale {
  return locale === "en" && article.title.en ? "en" : "zh";
}

/** A term has its own page in a locale only when its name and definition are written in that language. */
export function termLocale(term: LearningTerm, locale: PublicLocale): PublicLocale {
  return locale === "en" && term.term.en && term.definition.en ? "en" : "zh";
}

export type TextPiece = { kind: "text"; value: string } | { kind: "term"; slug: string; value: string };

const TERM_MARK = /\[\[([a-z0-9-]+)\|([^\]]+)\]\]/gu;

export function parseTermMarkup(source: string): TextPiece[] {
  const pieces: TextPiece[] = [];
  let cursor = 0;
  for (const match of source.matchAll(TERM_MARK)) {
    const index = match.index ?? 0;
    if (index > cursor) pieces.push({ kind: "text", value: source.slice(cursor, index) });
    pieces.push({ kind: "term", slug: match[1] ?? "", value: match[2] ?? "" });
    cursor = index + match[0].length;
  }
  if (cursor < source.length) pieces.push({ kind: "text", value: source.slice(cursor) });
  return pieces;
}

export function plainText(source: string): string {
  return parseTermMarkup(source).map((piece) => piece.value).join("");
}

export function articleHero(article: LearningArticle): LearningArticle["images"][number] | undefined {
  return article.images.find((image) => image.role === "hero" && image.type === "existing" && image.asset);
}

export function articlesUsingTerm(catalog: LearningCatalog, slug: string): LearningArticle[] {
  const mark = `[[${slug}|`;
  return catalog.articles.filter((article) =>
    article.body.sections.some((section) => section.paragraphs.some((paragraph) => paragraph.text.zh.includes(mark))),
  );
}

export function articlePandaSlugs(article: LearningArticle): string[] {
  return [...new Set(article.images.flatMap((image) => (image.pandaSlug ? [image.pandaSlug] : [])))];
}
