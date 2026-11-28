import { useQuery } from "@tanstack/react-query";

import { api, publicMediaUrl } from "@/lib/api";

// Queries started in the same frame share one API request, up to the endpoint's limit.
const BATCH = 50;
const queue = new Map<string, { resolve: (value: string | null) => void; reject: (reason: Error) => void }>();
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  const entries = [...queue.entries()];
  queue.clear();
  for (let start = 0; start < entries.length; start += BATCH) {
    const chunk = entries.slice(start, start + BATCH);
    const ids = chunk.map(([id]) => id);
    void api.GET("/api/v2/panda-covers", { params: { query: { ids: ids.join(",") } } })
      .then(({ data }) => {
        if (!data) throw new Error("Covers unavailable");
        const found = new Map(data.items.map((cover) => [cover.pandaId, publicMediaUrl(cover.objectKey)]));
        for (const [id, pending] of chunk) pending.resolve(found.get(id) ?? null);
      })
      .catch((error: unknown) => {
        const failure = error instanceof Error ? error : new Error("Covers unavailable");
        for (const [, pending] of chunk) pending.reject(failure);
      });
  }
}

function loadCover(id: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    queue.set(id, { resolve, reject });
    timer ??= setTimeout(flush, 16);
  });
}

/**
 * The panda's cover photo URL, or null while loading and when it has none. With no panda yet (a screen
 * still loading which one to show) it asks for nothing.
 */
export function usePandaCover(pandaId: string | undefined): string | null {
  const { data } = useQuery({
    queryKey: ["public", "panda-cover", pandaId],
    queryFn: () => loadCover(pandaId!),
    enabled: Boolean(pandaId),
    staleTime: 300_000,
    networkMode: "always",
  });
  return data ?? null;
}
