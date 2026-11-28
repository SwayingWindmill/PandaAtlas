import { queryOptions } from "@tanstack/react-query";

import { authedApi } from "@/lib/api";

// 见过: the day a signed-in fan saw a panda in person. One record per panda; marking again replaces the day.

export interface Seen {
  seenOn: string | null;
}

export interface SeenEntry {
  pandaId: string;
  seenOn: string | null;
  placeId: string | null;
  note: string | null;
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

export async function loadSeenEntries(): Promise<SeenEntry[]> {
  const { data } = await authedApi.GET("/api/v2/me/seen-pandas");
  if (!data) throw new Error("Seen pandas unavailable");
  return data.items.map((item) => ({
    pandaId: item.pandaId,
    seenOn: item.seenOn ?? null,
    placeId: item.placeId ?? null,
    note: item.note ?? null,
  }));
}

export function seenEntriesQueryKey(accountId: string) {
  return ["private", accountId, "seen-entries"] as const;
}

export function seenEntriesQueryOptions(accountId: string) {
  return queryOptions({
    queryKey: seenEntriesQueryKey(accountId),
    staleTime: 60_000,
    queryFn: loadSeenEntries,
  });
}

/** Every panda the signed-in fan has marked 见过, by ID. */
export async function loadSeenIds(): Promise<Set<string>> {
  const entries = await loadSeenEntries();
  return new Set(entries.map((item) => item.pandaId));
}

export function seenIdsQueryKey(accountId: string) {
  return ["private", accountId, "seen-ids"] as const;
}

export function seenIdsQueryOptions(accountId: string) {
  return queryOptions({
    queryKey: seenIdsQueryKey(accountId),
    staleTime: 60_000,
    queryFn: loadSeenIds,
  });
}

export async function markSeen(pandaId: string, seenOn: string, placeId?: string | null): Promise<boolean> {
  const { response } = await authedApi.PUT("/api/v2/me/seen-pandas/{pandaId}", {
    params: { path: { pandaId } },
    body: { seenOn, ...(placeId ? { placeId } : {}) },
  });
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
