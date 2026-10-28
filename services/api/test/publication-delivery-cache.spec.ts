import { describe, expect, it } from "vitest";

import { PostgresPublicationCoordinator } from "../src/modules/publication/infrastructure/postgres-publication.coordinator.js";
import type { PublicReadCache } from "../src/modules/publication/infrastructure/public-read-cache.js";

const context = {
  actor: { kind: "system" as const, systemKey: "test" },
  correlationId: "00000000-0000-4000-8000-000000000010",
};

function coordinator(options: { row?: unknown; fail?: boolean }) {
  let invalidated = 0;
  const transaction = new Proxy({}, {
    get(_target, property) {
      if (property === "then") return undefined;
      if (property === "executeTakeFirst") return () => Promise.resolve(options.row);
      if (property === "executeTakeFirstOrThrow") return () => Promise.resolve({ control_event_id: "control-1" });
      if (property === "execute") return () => Promise.resolve();
      return () => transaction;
    },
  });
  const database = {
    transaction: async <T>(work: (tx: unknown) => Promise<T>) => {
      if (options.fail) throw new Error("write failed");
      return work(transaction);
    },
  };
  const cache = { invalidate: () => { invalidated += 1; return Promise.resolve(); } };
  const service = new PostgresPublicationCoordinator(
    database as never,
    { append: () => Promise.resolve("event-1") } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    cache as unknown as PublicReadCache,
  );
  return { service, invalidated: () => invalidated };
}

describe("public read cache after a delivery change", () => {
  it("drops cached public reads when a resource takedown commits", async () => {
    const { service, invalidated } = coordinator({});
    await service.setResourceTakedown(
      "panda",
      "00000000-0000-4000-8000-000000000020",
      true,
      context,
      "Emergency panda takedown",
    );
    expect(invalidated()).toBe(1);
  });

  it("keeps the cache when the release change does not become current", async () => {
    const { service, invalidated } = coordinator({});
    await expect(service.activate("00000000-0000-4000-8000-000000000030", context, "missing")).resolves.toEqual({
      kind: "not_found",
    });
    expect(invalidated()).toBe(0);
  });

  it("does not drop the cache when the delivery write fails", async () => {
    const { service, invalidated } = coordinator({ fail: true });
    await expect(service.setResourceTakedown(
      "panda",
      "00000000-0000-4000-8000-000000000020",
      true,
      context,
      "Emergency panda takedown",
    )).rejects.toThrow("write failed");
    expect(invalidated()).toBe(0);
  });
});
