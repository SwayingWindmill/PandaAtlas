import { describe, expect, it } from "vitest";

import { PublicCacheConsumerService } from "../src/modules/publication/infrastructure/public-cache-consumer.service.js";

const EVENT_ID = "00000000-0000-4000-8000-000000000001";

describe("PublicCacheConsumerService", () => {
  it("does not invalidate or purge when the queue is empty", async () => {
    const order: string[] = [];
    const consumer = new PublicCacheConsumerService(
      { db: {} } as never,
      { read: () => { order.push("read"); return Promise.resolve([]); } } as never,
      { invalidate: () => { order.push("invalidate"); return Promise.resolve(); } } as never,
    );

    await expect(consumer.processBatch({ purge: () => { order.push("purge"); return Promise.resolve(); } })).resolves.toEqual({
      received: 0,
      purged: false,
      duplicates: 0,
    });
    expect(order).toEqual(["read"]);
  });

  it("invalidates cached public reads before the edge purge and archives only after it succeeds", async () => {
    const order: string[] = [];
    const consumer = new PublicCacheConsumerService(
      {
        db: {},
        transaction: (work: (transaction: unknown) => Promise<void>) => {
          order.push("archive");
          return work({});
        },
      } as never,
      {
        read: () => {
          order.push("read");
          return Promise.resolve([{ msgId: "9", readCount: 1, message: { eventId: EVENT_ID } }]);
        },
        claimReceipt: () => {
          order.push("claim");
          return Promise.resolve(true);
        },
        archive: () => {
          order.push("archive-message");
          return Promise.resolve();
        },
      } as never,
      { invalidate: () => { order.push("invalidate"); return Promise.resolve(); } } as never,
    );

    await consumer.processBatch({
      purge: () => {
        order.push("purge");
        return Promise.resolve();
      },
    });

    expect(order).toEqual(["read", "invalidate", "purge", "archive", "claim", "archive-message"]);
  });

  it("leaves the queue message in place when the purge fails", async () => {
    const order: string[] = [];
    const consumer = new PublicCacheConsumerService(
      { db: {}, transaction: () => { order.push("archive"); return Promise.resolve(); } } as never,
      {
        read: () => Promise.resolve([{ msgId: "9", readCount: 1, message: { eventId: EVENT_ID } }]),
      } as never,
      { invalidate: () => { order.push("invalidate"); return Promise.resolve(); } } as never,
    );

    await expect(consumer.processBatch({
      purge: () => {
        order.push("purge");
        return Promise.reject(new Error("edge unavailable"));
      },
    })).rejects.toThrow("edge unavailable");
    expect(order).toEqual(["invalidate", "purge"]);
  });
});
