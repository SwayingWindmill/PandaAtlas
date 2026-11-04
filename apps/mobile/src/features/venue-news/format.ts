import type { VenueNewsItem } from "./venue-news";

export function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** "10月1日", or "2025年10月1日" outside the current year. */
export function newsDate(day: string, now = new Date()): string {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number);
  return y === now.getFullYear() ? `${m}月${d}日` : `${y}年${m}月${d}日`;
}

/** Two short lines under the headline: who and when it was published, then where and when it was checked. */
export function newsDetail(item: VenueNewsItem, now = new Date()): string {
  return `${item.sourcePublisher} · ${newsDate(item.publishedOn, now)}\n${sourceHost(item.sourceUrl)} · 更新于 ${newsDate(updatedDay(item.updatedAt), now)}`;
}

/** The updated-at day in Asia/Shanghai, where every institution's notice is dated. */
export function updatedDay(instant: string): string {
  const t = Date.parse(instant);
  if (Number.isNaN(t)) return instant.slice(0, 10);
  return new Date(t + 8 * 3600_000).toISOString().slice(0, 10);
}
