import { describe, expect, it } from "vitest";

import type { PublicReadPort } from "../src/modules/publication/application/public-read.application.js";
import { CachingPublicReadRepository } from "../src/modules/publication/infrastructure/caching-public-read.repository.js";
import { PostgresPublicReadRepository } from "../src/modules/publication/infrastructure/postgres-public-read.repository.js";
import { PublicReadCache } from "../src/modules/publication/infrastructure/public-read-cache.js";

const RELEASE = { releaseId: "release-1", version: "2026.10.28.1" };

function chain(answer: (table: string, many: boolean) => unknown) {
  let table = "";
  const builder: object = new Proxy({}, {
    get(target, prop) {
      if (prop === "selectFrom") {
        return (name: string) => {
          table = name;
          return builder;
        };
      }
      if (prop === "executeTakeFirst") return () => Promise.resolve(answer(table, false));
      if (prop === "execute") return () => Promise.resolve(answer(table, true));
      if (prop === "then") return undefined;
      const current = Reflect.get(target, prop) as unknown;
      return current ?? (() => builder);
    },
  });
  return builder;
}

describe("PublicReadCache", () => {
  it("runs a load once and shares an in-flight load", async () => {
    const cache = new PublicReadCache();
    let calls = 0;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const load = () => {
      calls += 1;
      return gate.then(() => "pandas");
    };

    const first = cache.remember("listPandas", load);
    const second = cache.remember("listPandas", load);
    release();
    await expect(Promise.all([first, second])).resolves.toEqual(["pandas", "pandas"]);
    await expect(cache.remember("listPandas", load)).resolves.toBe("pandas");
    expect(calls).toBe(1);
  });

  it("does not retain a value the caller refuses, and drops everything on invalidate", async () => {
    const cache = new PublicReadCache();
    let calls = 0;
    const load = () => {
      calls += 1;
      return Promise.resolve(calls === 1 ? undefined : "live");
    };

    await expect(cache.remember("snapshot", load, (value) => value !== undefined)).resolves.toBeUndefined();
    await expect(cache.remember("snapshot", load, (value) => value !== undefined)).resolves.toBe("live");
    expect(calls).toBe(2);
    await expect(cache.remember("snapshot", load, (value) => value !== undefined)).resolves.toBe("live");
    expect(calls).toBe(2);

    await cache.invalidate();
    await expect(cache.remember("snapshot", load, (value) => value !== undefined)).resolves.toBe("live");
    expect(calls).toBe(3);
  });

  it("drops another isolate's memory when the shared generation changes", async () => {
    const store = new Map<string, Response>();
    const previous = (globalThis as { caches?: unknown }).caches;
    (globalThis as { caches?: unknown }).caches = {
      default: {
        match: (request: Request) => Promise.resolve(store.get(request.url)?.clone()),
        put: (request: Request, response: Response) => {
          store.set(request.url, response.clone());
          return Promise.resolve();
        },
      },
    };
    try {
      const writer = new PublicReadCache();
      const reader = new PublicReadCache();
      let reads = 0;
      const load = () => {
        reads += 1;
        return Promise.resolve(`release-${reads}`);
      };

      await expect(writer.remember("currentRelease", load)).resolves.toBe("release-1");
      await expect(reader.remember("currentRelease", load)).resolves.toBe("release-2");
      await expect(reader.remember("currentRelease", load)).resolves.toBe("release-2");
      expect(reads).toBe(2);

      await writer.invalidate();
      await expect(reader.remember("currentRelease", load)).resolves.toBe("release-3");
      expect(reads).toBe(3);
    } finally {
      if (previous === undefined) delete (globalThis as { caches?: unknown }).caches;
      else (globalThis as { caches?: unknown }).caches = previous;
    }
  });
});

describe("CachingPublicReadRepository", () => {
  it("does not repeat a public read, including one Daily Panda makes for every guess", async () => {
    let lists = 0;
    let details = 0;
    let releases = 0;
    const inner = {
      listPandas: () => {
        lists += 1;
        return Promise.resolve({ kind: "ok", value: { release: RELEASE, items: [] } });
      },
      getPanda: () => {
        details += 1;
        return Promise.resolve({ kind: "not_found" });
      },
      currentRelease: () => {
        releases += 1;
        return Promise.resolve({ kind: "unavailable" });
      },
    } as unknown as PublicReadPort;
    const repository = new CachingPublicReadRepository(inner, new PublicReadCache());

    await repository.listPandas();
    await repository.listPandas();
    await repository.getPanda("hua-hua");
    await repository.getPanda("hua-hua");
    await repository.currentRelease();
    await repository.currentRelease();

    expect(lists).toBe(1);
    expect(details).toBe(1);
    expect(releases).toBe(2);
  });
});

describe("PostgresPublicReadRepository snapshot", () => {
  it("resolves the release and takedowns once for every list in the generation", async () => {
    const calls: string[] = [];
    const db = chain((table, many) => {
      calls.push(`${many ? "many" : "one"}:${table}`);
      if (table.startsWith("publication.current_release")) {
        return { release_id: RELEASE.releaseId, version: RELEASE.version, lifecycle_state: "sealed" };
      }
      if (table === "publication.delivery_control_events") return many ? [] : undefined;
      if (table === "public_read.pandas") {
        return [{ panda_id: "panda-1", canonical_slug: "hua-hua", legacy_slugs: [], names: [], facts: [] }];
      }
      if (table === "public_read.places") {
        return [{
          place_id: "place-1",
          institution_id: null,
          slug: "chengdu",
          place_type: "facility",
          name_zh: "成都",
          name_en: "Chengdu",
          country_code: "CN",
          region: null,
          longitude: null,
          latitude: null,
          visit_guide: null,
        }];
      }
      return many ? [] : undefined;
    });
    const repository = new PostgresPublicReadRepository({ db } as never, new PublicReadCache());

    await repository.listPandas();
    await repository.listPlaces();

    expect(calls.filter((call) => call.startsWith("one:publication.current_release"))).toHaveLength(1);
    expect(calls.filter((call) => call.includes("delivery_control_events"))).toHaveLength(1);
    expect(calls.filter((call) => call === "many:public_read.pandas")).toHaveLength(1);
    expect(calls.filter((call) => call === "many:public_read.places")).toHaveLength(1);
  });

  it("hides the release when the newest suspension applies", async () => {
    const calls: string[] = [];
    const db = chain((table, many) => {
      calls.push(`${many ? "many" : "one"}:${table}`);
      if (table.startsWith("publication.current_release")) {
        return { release_id: RELEASE.releaseId, version: RELEASE.version, lifecycle_state: "sealed" };
      }
      if (table === "publication.delivery_control_events") {
        return [
          { control_kind: "release_suspension", resource_kind: null, resource_id: null, action: "apply" },
          { control_kind: "release_suspension", resource_kind: null, resource_id: null, action: "lift" },
        ];
      }
      return many ? [] : undefined;
    });
    const repository = new PostgresPublicReadRepository({ db } as never, new PublicReadCache());

    await expect(repository.listPandas()).resolves.toEqual({ kind: "unavailable" });
    expect(calls.filter((call) => call === "many:public_read.pandas")).toHaveLength(0);
    expect(calls.filter((call) => call.includes("delivery_control_events"))).toHaveLength(1);
  });

  it("drops a panda whose newest takedown applies and keeps one that was lifted", async () => {
    const db = chain((table, many) => {
      if (table.startsWith("publication.current_release")) {
        return { release_id: RELEASE.releaseId, version: RELEASE.version, lifecycle_state: "sealed" };
      }
      if (table === "publication.delivery_control_events") {
        return [
          { control_kind: "resource_takedown", resource_kind: "panda", resource_id: "panda-hidden", action: "apply" },
          { control_kind: "resource_takedown", resource_kind: "panda", resource_id: "panda-shown", action: "lift" },
          { control_kind: "resource_takedown", resource_kind: "panda", resource_id: "panda-shown", action: "apply" },
          { control_kind: "release_suspension", resource_kind: null, resource_id: null, action: "lift" },
        ];
      }
      if (table === "public_read.pandas") {
        return [
          { panda_id: "panda-hidden", canonical_slug: "hidden", legacy_slugs: [], names: [], listing_facts: [] },
          { panda_id: "panda-shown", canonical_slug: "shown", legacy_slugs: [], names: [], listing_facts: [{ fieldKey: "sex" }] },
        ];
      }
      return many ? [] : undefined;
    });
    const repository = new PostgresPublicReadRepository({ db } as never, new PublicReadCache());

    await expect(repository.listPandas()).resolves.toEqual({
      kind: "ok",
      value: {
        release: RELEASE,
        items: [{
          pandaId: "panda-shown",
          canonicalSlug: "shown",
          legacySlugs: [],
          names: [],
          facts: [{ fieldKey: "sex" }],
        }],
      },
    });
  });
});
