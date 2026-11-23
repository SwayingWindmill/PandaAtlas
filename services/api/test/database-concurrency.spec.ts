import { ConfigService } from "@nestjs/config";
import pg from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppConfig, validateEnvironment } from "../src/platform/config/app-config.js";
import { DatabaseService } from "../src/platform/database/database.service.js";

function createTestConfig(overrides: Record<string, unknown> = {}): AppConfig {
  const validated = validateEnvironment({ APP_ENV: "test", DB_POOL_MAX: "5", ...overrides });
  return new AppConfig(new ConfigService(validated));
}

describe("DatabaseService request-scoped pooling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("isolates overlapping withRequest contexts with max=1 pool and destroys pools in finally", async () => {
    const endCalls: number[] = [];
    const maxValues: Array<number | undefined> = [];

    vi.spyOn(pg, "Pool").mockImplementation(function MockPool(this: unknown, options?: pg.PoolConfig): pg.Pool {
      maxValues.push(options?.max);
      const idx = maxValues.length;
      const client = {
        query: vi.fn(() => Promise.resolve({ command: "SELECT", rowCount: 1, rows: [{ ok: 1 }] })),
        release: vi.fn(),
      };
      return {
        totalCount: idx,
        idleCount: 1,
        waitingCount: 0,
        on: vi.fn(),
        connect: vi.fn(() => Promise.resolve(client)),
        query: client.query,
        end: vi.fn(() => {
          endCalls.push(idx);
          return Promise.resolve();
        }),
      } as unknown as pg.Pool;
    });

    const service = new DatabaseService(createTestConfig());
    expect(() => service.db).toThrow("DATABASE_URL is not configured");

    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let signalFirstEntered!: () => void;
    const firstEntered = new Promise<void>((resolve) => {
      signalFirstEntered = resolve;
    });

    const first = service.withRequest("postgresql://hyperdrive-a.local/db", async () => {
      const dbInside = service.db;
      const statsBefore = service.poolStats;
      await service.checkReady();
      signalFirstEntered();
      await firstGate;
      expect(service.db).toBe(dbInside);
      return statsBefore.total;
    });

    await firstEntered;

    const failing = service.withRequest("postgresql://hyperdrive-b.local/db", async () => {
      expect(service.poolStats.total).toBe(2);
      await service.checkReady();
      throw new Error("boom");
    });
    await expect(failing).rejects.toThrow("boom");
    expect(endCalls).toContain(2);

    releaseFirst();
    await expect(first).resolves.toBe(1);
    expect(endCalls).toEqual([2, 1]);
    expect(maxValues).toEqual([1, 1]);
    expect(() => service.db).toThrow("DATABASE_URL is not configured");
  });
});
