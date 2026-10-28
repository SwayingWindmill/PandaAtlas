// Public reads are identical for every caller until a delivery change. The result
// lives in isolate memory, keyed by a generation. Publishing, rollback, suspension,
// and resource takedown bump it as soon as the write commits, and the purge cycle
// bumps it again before clearing the Web edge cache. HTTP isolates in this region
// (the API Worker is pinned to one) see the new generation on their next read.

const GENERATION_URL = "https://public-read.internal/generation";

interface SharedCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

interface Cached<T> {
  value: T;
}

let localGeneration = "0";

function sharedCache(): SharedCache | undefined {
  const caches = (globalThis as { caches?: { default?: SharedCache } }).caches;
  return caches?.default;
}

function generationRequest(): Request {
  return new Request(GENERATION_URL);
}

async function readSharedGeneration(): Promise<string> {
  const cache = sharedCache();
  if (cache === undefined) return localGeneration;
  try {
    const hit = await cache.match(generationRequest());
    if (hit == null) return "0";
    return await hit.text();
  } catch {
    return localGeneration;
  }
}

async function bumpSharedGeneration(): Promise<string> {
  const next = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const cache = sharedCache();
  if (cache !== undefined) {
    try {
      await cache.put(
        generationRequest(),
        new Response(next, { headers: { "Cache-Control": "public, max-age=31536000" } }),
      );
      return next;
    } catch {
      // The Cache API is unavailable outside a Worker request. The local
      // generation still drops this process's memory on the next read.
    }
  }
  localGeneration = next;
  return next;
}

export class PublicReadCache {
  private generation = "0";
  private readonly values = new Map<string, Cached<unknown>>();
  private readonly loads = new Map<string, Promise<unknown>>();

  public async remember<T>(
    key: string,
    load: () => Promise<T>,
    retain: (value: T) => boolean = () => true,
  ): Promise<T> {
    const generation = await this.currentGeneration();
    const scoped = `${generation}\n${key}`;
    const existing = this.values.get(scoped) as Cached<T> | undefined;
    if (existing) return existing.value;
    const pending = this.loads.get(scoped) as Promise<T> | undefined;
    if (pending) return pending;
    const promise = load()
      .then((value) => {
        // A missing release is not retained: the next request must see a
        // release that was published after this read, before the purge runs.
        if (this.generation === generation && retain(value)) this.values.set(scoped, { value });
        return value;
      })
      .finally(() => {
        if (this.loads.get(scoped) === promise) this.loads.delete(scoped);
      });
    this.loads.set(scoped, promise);
    return promise;
  }

  // Bump the shared generation before the Web edge cache is purged. A render that
  // follows the purge then reloads from Postgres instead of refilling the edge
  // with the previous release.
  public async invalidate(): Promise<void> {
    this.generation = await bumpSharedGeneration();
    this.values.clear();
    this.loads.clear();
  }

  private async currentGeneration(): Promise<string> {
    const shared = await readSharedGeneration();
    if (shared !== this.generation) {
      this.generation = shared;
      this.values.clear();
      this.loads.clear();
    }
    return this.generation;
  }
}
