import type { Href } from "expo-router";

export type TopicId = "returning" | "look-alikes" | "venue-news";

export interface Topic {
  id: TopicId;
  title: string;
  /** The full name read aloud, when the card shows a short one. */
  spoken?: string;
  /** One line under the title when the topic leads the page. */
  dek: string;
  href: Href;
}

/** 发现's 专题: stories told across a group of pandas, in rail order. Each opens a page of its own. */
export const TOPICS: readonly Topic[] = [
  { id: "returning", title: "归国熊猫", dek: "从海外回家的熊猫们", href: "/returning" },
  { id: "look-alikes", title: "双胞胎", spoken: "双胞胎和像的熊猫", dek: "长得像，怎么分", href: "/look-alikes" },
  { id: "venue-news", title: "场馆动态", dek: "基地和动物园的新消息", href: "/venue-news" },
];

/** What leads 发现: an article with a photo of its own, or a 专题. */
export type Feature<A> = { kind: "article"; article: A } | { kind: "topic"; topic: Topic };

/** Whole days since 1970-01-01 for a "YYYY-MM-DD" day, so the lead turns over at local midnight. */
function dayNumber(day: string): number {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
}

/**
 * The 本期 lead and the 专题 rail. The lead turns over each day among the articles that have a hero photo
 * and the 专题 that have something to show, articles first. The rail keeps the other 专题 with content.
 */
export function arrangeDiscover<A>(
  articles: readonly A[],
  hasContent: (id: TopicId) => boolean,
  day: string,
  topics: readonly Topic[] = TOPICS,
): { lead: Feature<A> | null; rail: Topic[] } {
  const shown = topics.filter((topic) => hasContent(topic.id));
  const pool: Feature<A>[] = [
    ...articles.map((article) => ({ kind: "article" as const, article })),
    ...shown.map((topic) => ({ kind: "topic" as const, topic })),
  ];
  const lead = pool.length > 0 ? pool[dayNumber(day) % pool.length]! : null;
  return { lead, rail: shown.filter((topic) => lead?.kind !== "topic" || topic !== lead.topic) };
}
