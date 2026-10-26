import { authedApi } from "@/lib/api";

// 见过: the day a signed-in fan saw a panda in person. One record per panda; marking again replaces the day.

export interface Seen {
  seenOn: string | null;
}

export async function loadSeen(pandaId: string): Promise<Seen | null> {
  const { data, response } = await authedApi.GET("/api/v2/me/seen-pandas/{pandaId}", { params: { path: { pandaId } } });
  if (data) return { seenOn: data.seenOn ?? null };
  if (response.status === 404) return null;
  throw new Error(`Seen record unavailable (${response.status})`);
}

/** Today in the fan's own time zone, as the API's date. */
export function localToday(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export async function markSeen(pandaId: string, seenOn: string): Promise<boolean> {
  const { response } = await authedApi.PUT("/api/v2/me/seen-pandas/{pandaId}", { params: { path: { pandaId } }, body: { seenOn } });
  return response.ok;
}

export async function unmarkSeen(pandaId: string): Promise<boolean> {
  const { response } = await authedApi.DELETE("/api/v2/me/seen-pandas/{pandaId}", { params: { path: { pandaId } } });
  return response.ok;
}

/** "2026-10-26" → "10月26日". */
export function shortDay(day: string): string {
  const [, month, date] = day.split("-");
  return `${Number(month)}月${Number(date)}日`;
}
