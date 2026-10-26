import { useEffect, useSyncExternalStore } from "react";

import { api, publicMediaUrl } from "@/lib/api";

// Rows ask for their own cover; requests made in the same frame share one call of up to 50 ids,
// the endpoint's limit. A failed call is forgotten, so the row asks again when it next mounts.
const BATCH = 50;
const photos = new Map<string, string | null>();
const requested = new Set<string>();
const queue = new Set<string>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

function notify() {
  for (const listener of listeners) listener();
}

function flush() {
  timer = null;
  const ids = [...queue];
  queue.clear();
  for (let start = 0; start < ids.length; start += BATCH) {
    const chunk = ids.slice(start, start + BATCH);
    api
      .GET("/api/v2/panda-covers", { params: { query: { ids: chunk.join(",") } } })
      .then(({ data }) => {
        if (!data) throw new Error("Covers unavailable");
        const found = new Map(data.items.map((cover) => [cover.pandaId, publicMediaUrl(cover.objectKey)]));
        for (const id of chunk) photos.set(id, found.get(id) ?? null);
        notify();
      })
      .catch(() => {
        for (const id of chunk) requested.delete(id);
      });
  }
}

function request(id: string) {
  if (requested.has(id)) return;
  requested.add(id);
  queue.add(id);
  timer ??= setTimeout(flush, 16);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The panda's cover photo URL, or null while loading and when it has none. */
export function usePandaCover(pandaId: string): string | null {
  useEffect(() => request(pandaId), [pandaId]);
  return useSyncExternalStore(subscribe, () => photos.get(pandaId) ?? null);
}
