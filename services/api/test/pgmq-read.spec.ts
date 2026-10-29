import {
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type DatabaseConnection,
  type Driver,
} from "kysely";
import { describe, expect, it } from "vitest";

import type { Database } from "../src/platform/database/database.types.js";
import { PgmqService } from "../src/platform/integration/pgmq.service.js";

function recordingDb(rowsFor: (statement: string) => unknown[]) {
  const statements: string[] = [];
  const connection: DatabaseConnection = {
    executeQuery: <R>(compiled: { sql: string }) => {
      statements.push(compiled.sql);
      return Promise.resolve({ rows: rowsFor(compiled.sql) as R[] });
    },
    streamQuery: () => {
      throw new Error("streamQuery is not used");
    },
  };
  const driver: Driver = {
    init: () => Promise.resolve(),
    acquireConnection: () => Promise.resolve(connection),
    beginTransaction: () => Promise.resolve(),
    commitTransaction: () => Promise.resolve(),
    rollbackTransaction: () => Promise.resolve(),
    releaseConnection: () => Promise.resolve(),
    destroy: () => Promise.resolve(),
  };
  const db = new Kysely<Database>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => driver,
      createIntrospector: (kysely) => new PostgresIntrospector(kysely),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });
  return { db, statements };
}

describe("PgmqService.read", () => {
  const pgmq = new PgmqService();

  it("does not call pgmq.read when the queue has no visible message", async () => {
    const { db, statements } = recordingDb(() => [{ ready: false }]);
    await expect(pgmq.read(db, "integration_updates", 60, 25)).resolves.toEqual([]);
    expect(statements).toHaveLength(1);
    expect(statements[0]).toContain("pgmq.q_integration_updates");
    expect(statements[0]).toContain("vt <=");
    expect(statements[0]).not.toContain("pgmq.read");
  });

  it("reads only after a visible message is found", async () => {
    const { db, statements } = recordingDb((statement) =>
      statement.includes("pgmq.read")
        ? [{ msg_id: "7", read_ct: 1, message: { eventId: "abc" } }]
        : [{ ready: true }],
    );
    await expect(pgmq.read(db, "integration_audit", 60, 25)).resolves.toEqual([
      { msgId: "7", readCount: 1, message: { eventId: "abc" } },
    ]);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain("pgmq.q_integration_audit");
    expect(statements[1]).toContain("pgmq.read");
  });
});
