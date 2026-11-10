import type { Href } from "expo-router";

export type TopicId = "returning" | "look-alikes" | "venue-news" | "map";

export interface Topic {
  id: TopicId;
  title: string;
  /** The full name read aloud, when the card shows a short one. */
  spoken?: string;
  /** One line under the title on the 本期专题 photo. */
  dek: string;
  href: Href;
  /** Whether the topic can lead the page as 本期专题. 熊猫在哪里 is a tool, not a story. */
  featured: boolean;
}

/** 发现's 专题, in rail order. Each opens a page of its own; the page decides which have content. */
export const TOPICS: readonly Topic[] = [
  { id: "returning", title: "归国熊猫", dek: "从海外回家的熊猫们", href: "/returning", featured: true },
  { id: "look-alikes", title: "双胞胎", spoken: "双胞胎和像的熊猫", dek: "长得像，怎么分", href: "/look-alikes", featured: true },
  { id: "venue-news", title: "场馆动态", dek: "基地和动物园的新消息", href: "/venue-news", featured: true },
  { id: "map", title: "熊猫在哪里", dek: "每只熊猫现在住在哪", href: "/map", featured: false },
];

/** Whole days since 1970-01-01 for a "YYYY-MM-DD" day, so the featured topic turns over at local midnight. */
function dayNumber(day: string): number {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
}

/**
 * The 本期专题 and the rail under it. Only topics that have something to show appear; the featured one
 * turns over each day among those that can lead, and the rail keeps the rest in order.
 */
export function arrangeTopics(
  hasContent: (id: TopicId) => boolean,
  day: string,
  topics: readonly Topic[] = TOPICS,
): { hero: Topic | null; rail: Topic[] } {
  const shown = topics.filter((topic) => hasContent(topic.id));
  const leads = shown.filter((topic) => topic.featured);
  const hero = leads.length > 0 ? leads[dayNumber(day) % leads.length]! : null;
  return { hero, rail: shown.filter((topic) => topic !== hero) };
}
