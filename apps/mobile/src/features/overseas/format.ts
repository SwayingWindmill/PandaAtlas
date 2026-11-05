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


/** Pandas that come home together: one stage, one institution, one day (or one announced date). */
export interface ReturnGroup {
  key: string;
  stage: OverseasStage;
  institutionSlug: string;
  /** The day they came home, YYYY-MM-DD, once they have. */
  returnedOn: string | null;
  expectedReturn: PartialDate | null;
  items: OverseasStatusItem[];
}

const COMING: OverseasStage[] = ["quarantine", "in_transit", "return_announced"];

function groupsOf(items: OverseasStatusItem[]): ReturnGroup[] {
  const groups = new Map<string, ReturnGroup>();
  for (const item of items) {
    const when = item.returnedOn ?? item.expectedReturn?.on ?? "";
    const key = `${item.stage}|${item.institutionSlug}|${when}`;
    const group = groups.get(key) ?? {
      key,
      stage: item.stage,
      institutionSlug: item.institutionSlug,
      returnedOn: item.returnedOn ?? null,
      expectedReturn: item.expectedReturn ?? null,
      items: [],
    };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/**
 * The page in sections (v4 `15-overseas-return`): 即将归国 first (nearest to home first), then each year's
 * returns, newest first, then the pandas still abroad. Pandas that came home together share a row.
 */
export function returnSections(items: OverseasStatusItem[]): { title: string; groups: ReturnGroup[] }[] {
  const coming = groupsOf(items.filter((item) => COMING.includes(item.stage))).sort(
    (a, b) => COMING.indexOf(a.stage) - COMING.indexOf(b.stage) || (a.expectedReturn?.on ?? "").localeCompare(b.expectedReturn?.on ?? ""),
  );
  const returned = groupsOf(items.filter((item) => item.stage === "returned" && item.returnedOn)).sort((a, b) =>
    (b.returnedOn ?? "").localeCompare(a.returnedOn ?? ""),
  );
  const years = [...new Set(returned.map((group) => group.returnedOn!.slice(0, 4)))];
  const abroad = groupsOf(items.filter((item) => item.stage === "abroad"));
  return [
    ...(coming.length > 0 ? [{ title: "即将归国", groups: coming }] : []),
    ...years.map((year) => ({ title: year, groups: returned.filter((group) => group.returnedOn!.startsWith(year)) })),
    ...(abroad.length > 0 ? [{ title: "旅居海外", groups: abroad }] : []),
  ];
}

/** What the row says at the right: the day it came home, its stage, or when it is expected. */
export function returnMeta(group: ReturnGroup): string | null {
  if (group.returnedOn) return `${group.returnedOn.slice(5, 7)}.${group.returnedOn.slice(8, 10)}`;
  if (group.stage === "abroad") return group.expectedReturn ? `预计${partialDate(group.expectedReturn)}` : null;
  const label = STAGES.find((stage) => stage.stage === group.stage)?.label ?? null;
  return group.expectedReturn && group.stage === "return_announced" ? `预计${partialDate(group.expectedReturn)}` : label;
}
