import {
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type DatabaseConnection,
  type Driver,
} from "kysely";
import { describe, expect, it } from "vitest";

import { PostgresPublicReadRepository } from "../src/modules/public-read/infrastructure/postgres-public-read.repository.js";
import { PublicReadCache } from "../src/modules/public-read/infrastructure/public-read-cache.js";
import type { Database } from "../src/platform/database/database.types.js";

const RELEASE_ID = "00000000-0000-0000-0000-000000000010";
const PANDA_ID = "00000000-0000-0000-0000-000000000001";
const PLACE_ID = "00000000-0000-0000-0000-000000000002";

interface RecordedStatement {
  sql: string;
  parameters: readonly unknown[];
}

function makePandaRow(canonicalSlug: string, legacySlugs: string[] = []) {
  return {
    release_id: RELEASE_ID,
    panda_id: PANDA_ID,
    canonical_slug: canonicalSlug,
    legacy_slugs: legacySlugs,
    names: [],
    facts: [],
    evidence_source_ids: [],
    listing_facts: [],
  };
}

function makePlaceRow(slug: string, legacySlugs: string[] = []) {
  return {
    release_id: RELEASE_ID,
    place_id: PLACE_ID,
    institution_id: null,
    slug,
    place_type: "facility",
    name_zh: "成都",
    name_en: "Chengdu",
    country_code: "CN",
    region: null,
    longitude: null,
    latitude: null,
    visit_guide: null,
    legacy_slugs: legacySlugs,
  };
}

function recordingDb(rowsFor: (statement: string, parameters: readonly unknown[]) => unknown[]) {
  const statements: RecordedStatement[] = [];
  const connection: DatabaseConnection = {
    executeQuery: <R>(compiled: { sql: string; parameters: readonly unknown[] }) => {
      statements.push({ sql: compiled.sql, parameters: compiled.parameters });
      return Promise.resolve({ rows: rowsFor(compiled.sql, compiled.parameters) as R[] });
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

function baseSnapshotRows(statement: string): unknown[] | undefined {
  if (statement.includes('"publication"."current_release"')) {
    return [{ release_id: RELEASE_ID, version: "2026.11.22.1", lifecycle_state: "sealed" }];
  }
  if (statement.includes('"publication"."delivery_control_events"')) {
    return [];
  }
  return undefined;
}

describe("PostgresPublicReadRepository index-friendly slug lookups", () => {
  it("resolves canonical panda slug in one query and queries life events with array containment", async () => {
    const { db, statements } = recordingDb((statement) => {
      const snapshotRows = baseSnapshotRows(statement);
      if (snapshotRows !== undefined) return snapshotRows;
      if (statement.includes('from "public_read"."pandas"') && statement.includes('"canonical_slug" =')) {
        return [makePandaRow("hua-hua")];
      }
      return [];
    });
    const repository = new PostgresPublicReadRepository({ db } as never, new PublicReadCache());

    const result = await repository.getPanda("hua-hua");
    expect(result.kind).toBe("ok");

    const pandaLookups = statements.filter((item) => item.sql.includes('from "public_read"."pandas"'));
    expect(pandaLookups).toHaveLength(1);
    expect(pandaLookups[0]?.sql).toContain('"canonical_slug" =');
    expect(pandaLookups[0]?.sql).not.toContain("legacy_slugs");
    expect(pandaLookups[0]?.sql).not.toContain("panda_id::text");

    const lifeEventLookups = statements.filter((item) => item.sql.includes('from "public_read"."life_events"'));
    expect(lifeEventLookups).toHaveLength(1);
    expect(lifeEventLookups[0]?.sql).toContain("participant_ids @> array[");
    expect(lifeEventLookups[0]?.sql).not.toContain("any(participant_ids)");
  });

  it("falls back to legacy_slugs array containment when canonical panda slug misses", async () => {
    const { db, statements } = recordingDb((statement) => {
      const snapshotRows = baseSnapshotRows(statement);
      if (snapshotRows !== undefined) return snapshotRows;
      if (statement.includes('from "public_read"."pandas"') && statement.includes("legacy_slugs @>")) {
        return [makePandaRow("hua-hua", ["old-hua-hua"])];
      }
      return [];
    });
    const repository = new PostgresPublicReadRepository({ db } as never, new PublicReadCache());

    const result = await repository.getPanda("old-hua-hua");
    expect(result.kind).toBe("ok");

    const pandaLookups = statements.filter((item) => item.sql.includes('from "public_read"."pandas"'));
    expect(pandaLookups).toHaveLength(2);
    expect(pandaLookups[0]?.sql).toContain('"canonical_slug" =');
    expect(pandaLookups[1]?.sql).toContain("legacy_slugs @> array[");
    expect(pandaLookups[1]?.sql).toContain("::text[]");
  });

  it("skips panda_id lookup when a missing slug is not a UUID, and checks panda_id when it is", async () => {
    const nonUuid = recordingDb((statement) => baseSnapshotRows(statement) ?? []);
    const nonUuidRepo = new PostgresPublicReadRepository({ db: nonUuid.db } as never, new PublicReadCache());
    await expect(nonUuidRepo.getPanda("missing-panda")).resolves.toEqual({ kind: "not_found" });

    const nonUuidQueries = nonUuid.statements.filter((item) => item.sql.includes('from "public_read"."pandas"'));
    expect(nonUuidQueries).toHaveLength(2);
    expect(nonUuidQueries.some((item) => item.sql.includes('"panda_id" ='))).toBe(false);

    const uuidHit = recordingDb((statement) => {
      const snapshotRows = baseSnapshotRows(statement);
      if (snapshotRows !== undefined) return snapshotRows;
      if (statement.includes('from "public_read"."pandas"') && statement.includes('"panda_id" =')) {
        return [makePandaRow("hua-hua")];
      }
      return [];
    });
    const uuidRepo = new PostgresPublicReadRepository({ db: uuidHit.db } as never, new PublicReadCache());
    const found = await uuidRepo.getPanda(PANDA_ID);
    expect(found.kind).toBe("ok");

    const uuidQueries = uuidHit.statements.filter((item) => item.sql.includes('from "public_read"."pandas"'));
    expect(uuidQueries).toHaveLength(3);
    expect(uuidQueries[2]?.sql).toContain('"panda_id" =');
    expect(uuidQueries[2]?.sql).not.toContain("panda_id::text");
  });

  it("prioritizes canonical place slug and falls back cleanly to legacy_slugs", async () => {
    const canonicalHit = recordingDb((statement) => {
      const snapshotRows = baseSnapshotRows(statement);
      if (snapshotRows !== undefined) return snapshotRows;
      if (statement.includes('from "public_read"."places"') && statement.includes('"slug" =')) {
        return [makePlaceRow("chengdu")];
      }
      return [];
    });
    const canonicalRepo = new PostgresPublicReadRepository(
      { db: canonicalHit.db } as never,
      new PublicReadCache(),
    );
    await expect(canonicalRepo.getPlace("chengdu")).resolves.toMatchObject({
      kind: "ok",
      value: { place: { slug: "chengdu" } },
    });
    const canonicalQueries = canonicalHit.statements.filter((item) =>
      item.sql.includes('from "public_read"."places"'),
    );
    expect(canonicalQueries).toHaveLength(1);
    expect(canonicalQueries[0]?.sql).toContain('"slug" =');

    const legacyHit = recordingDb((statement) => {
      const snapshotRows = baseSnapshotRows(statement);
      if (snapshotRows !== undefined) return snapshotRows;
      if (statement.includes('from "public_read"."places"') && statement.includes("legacy_slugs @>")) {
        return [makePlaceRow("chengdu", ["old-chengdu"])];
      }
      return [];
    });
    const legacyRepo = new PostgresPublicReadRepository({ db: legacyHit.db } as never, new PublicReadCache());
    await expect(legacyRepo.getPlace("old-chengdu")).resolves.toMatchObject({
      kind: "ok",
      value: { place: { slug: "chengdu" } },
    });
    const legacyQueries = legacyHit.statements.filter((item) =>
      item.sql.includes('from "public_read"."places"'),
    );
    expect(legacyQueries).toHaveLength(2);
    expect(legacyQueries[0]?.sql).toContain('"slug" =');
    expect(legacyQueries[1]?.sql).toContain("legacy_slugs @> array[");
  });
});
