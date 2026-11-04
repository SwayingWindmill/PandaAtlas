import type { OverseasStage, OverseasStatusItem, PartialDate } from "./overseas-status";

/** Stages nearest to home first, the order the page reads in. */
export const STAGES: { stage: OverseasStage; label: string }[] = [
  { stage: "quarantine", label: "检疫中" },
  { stage: "in_transit", label: "归国途中" },
  { stage: "return_announced", label: "已宣布归国" },
  { stage: "abroad", label: "旅居海外" },
  { stage: "returned", label: "已归国" },
];

export function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** "2027年", "2027年2月" or "2027年2月14日": only as precise as the announcement. */
export function partialDate(date: PartialDate): string {
  const [y, m, d] = date.on.split("-").map(Number);
  if (date.precision === "year") return `${y}年`;
  if (date.precision === "month") return `${y}年${m}月`;
  return `${y}年${m}月${d}日`;
}

/** The updated-at day in Asia/Shanghai, where the announcements are dated. */
export function updatedDay(instant: string): string {
  const t = Date.parse(instant);
  if (Number.isNaN(t)) return instant.slice(0, 10);
  return new Date(t + 8 * 3600_000).toISOString().slice(0, 10);
}

const day = (on: string) => partialDate({ on, precision: "day" });

/** Two short lines: where it is and when it comes home, then the source and when it was checked. */
export function statusDetail(item: OverseasStatusItem, place: string): string {
  const when = item.returnedOn
    ? `${day(item.returnedOn)}归国`
    : item.expectedReturn
      ? `预计${partialDate(item.expectedReturn)}`
      : null;
  const first = [place, when].filter(Boolean).join(" · ");
  return `${first}\n${sourceHost(item.sourceUrl)} · 更新于 ${day(updatedDay(item.updatedAt))}`;
}

/** Non-empty stages in page order, each with its pandas. */
export function byStage(items: OverseasStatusItem[]): { stage: OverseasStage; label: string; items: OverseasStatusItem[] }[] {
  return STAGES.map((s) => ({ ...s, items: items.filter((item) => item.stage === s.stage) })).filter((s) => s.items.length > 0);
}
