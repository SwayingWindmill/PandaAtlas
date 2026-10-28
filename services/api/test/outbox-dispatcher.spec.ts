import { describe, expect, it } from "vitest";

import { OutboxDispatcherService } from "../src/platform/integration/outbox-dispatcher.service.js";

function dispatcher(pending: boolean) {
  let transactions = 0;
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  builder.selectFrom = self;
  builder.select = self;
  builder.where = self;
  builder.limit = self;
  builder.executeTakeFirst = () => Promise.resolve(pending ? { event_id: "event-1" } : undefined);
  const service = new OutboxDispatcherService(
    {
      db: builder,
      transaction: () => {
        transactions += 1;
        return Promise.resolve({ dispatched: 1, queueMessages: 1 });
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, transactions: () => transactions };
}

describe("OutboxDispatcherService", () => {
  it("does not open a transaction when the outbox has nothing to publish", async () => {
    const { service, transactions } = dispatcher(false);
    await expect(service.dispatchBatch()).resolves.toEqual({ dispatched: 0, queueMessages: 0 });
    expect(transactions()).toBe(0);
  });
});
