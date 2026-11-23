import type { NestExpressApplication } from "@nestjs/platform-express";
import { sql } from "kysely";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "../../src/bootstrap.js";
import { PostgresPublicReadRepository } from "../../src/modules/public-read/infrastructure/postgres-public-read.repository.js";
import { PublicReadCache } from "../../src/modules/public-read/infrastructure/public-read-cache.js";
import { DatabaseService } from "../../src/platform/database/database.service.js";

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

let app: NestExpressApplication;
let database: DatabaseService;

class RollbackSentinel extends Error {}

interface ExplainNode {
  "Index Name"?: string;
  Plans?: ExplainNode[];
}

function collectIndexNames(node: ExplainNode, found = new Set<string>()): string[] {
  if (typeof node["Index Name"] === "string") {
    found.add(node["Index Name"]);
  }
  for (const child of node.Plans ?? []) {
    collectIndexNames(child, found);
  }
  return [...found];
}

beforeAll(async () => {
  process.env.APP_ENV = "test";
  process.env.CORS_ALLOW_ORIGINS = "http://localhost:3000";
  process.env.DATABASE_URL = DATABASE_URL;
  delete process.env.SUPABASE_URL;

  app = await createApplication();
  database = app.get(DatabaseService);
});

afterAll(async () => {
  await app.close();
});

describe("High-frequency query indexes against local Supabase PostgreSQL", () => {
  it("defines all expected high-frequency query indexes in pg_indexes", async () => {
    const expected = [
      { schemaname: "engagement", tablename: "collections", indexname: "idx_engagement_collections_account_updated" },
      { schemaname: "engagement", tablename: "favorites", indexname: "idx_engagement_favorites_time_panda" },
      { schemaname: "privacy", tablename: "subject_requests", indexname: "idx_privacy_subject_requests_account_time" },
      { schemaname: "public_read", tablename: "life_events", indexname: "idx_public_read_life_events_release_order" },
      { schemaname: "public_read", tablename: "pandas", indexname: "idx_public_read_pandas_legacy_slugs" },
      { schemaname: "public_read", tablename: "places", indexname: "idx_public_read_places_legacy_slugs" },
      { schemaname: "public_read", tablename: "residencies", indexname: "idx_public_read_residencies_current" },
      { schemaname: "public_read", tablename: "residencies", indexname: "idx_public_read_residencies_place" },
    ] as const;

    const result = await sql<{ schemaname: string; tablename: string; indexname: string }>`
      select schemaname, tablename, indexname
      from pg_indexes
      where indexname in (${sql.join(expected.map((item) => item.indexname))})
      order by indexname
    `.execute(database.db);

    const byName = new Map(result.rows.map((row) => [row.indexname, row]));
    for (const item of expected) {
      expect(byName.get(item.indexname)).toEqual(item);
    }
  });

  it("allows PostgreSQL to select each intended index when sequential scans are disabled", async () => {
    const checks: ReadonlyArray<{ expectedIndex: string; query: string }> = [
      {
        expectedIndex: "idx_engagement_collections_account_updated",
        query: `select collection_id, name, created_at, updated_at from engagement.collections where account_id = '${ZERO_UUID}'::uuid order by updated_at desc, collection_id`,
      },
      {
        expectedIndex: "idx_engagement_favorites_time_panda",
        query: `select panda_id, count(distinct account_id) from engagement.favorites where favorited_at >= now() - interval '30 days' group by panda_id`,
      },
      {
        expectedIndex: "idx_privacy_subject_requests_account_time",
        query: `select request_id, account_id, kind, state, requested_at from privacy.subject_requests where account_id = '${ZERO_UUID}'::uuid order by requested_at desc`,
      },
      {
        expectedIndex: "idx_public_read_life_events_release_order",
        query: `select event_id, occurred_on from public_read.life_events where release_id = '${ZERO_UUID}'::uuid order by occurred_on desc, event_id`,
      },
      {
        expectedIndex: "idx_public_read_life_events_participants",
        query: `select event_id from public_read.life_events where participant_ids @> array['${ZERO_UUID}']::uuid[]`,
      },
      {
        expectedIndex: "idx_public_read_pandas_legacy_slugs",
        query: `select panda_id from public_read.pandas where legacy_slugs @> array['old-hua-hua']::text[]`,
      },
      {
        expectedIndex: "idx_public_read_places_legacy_slugs",
        query: `select place_id from public_read.places where legacy_slugs @> array['old-chengdu']::text[]`,
      },
      {
        expectedIndex: "idx_public_read_residencies_current",
        query: `select panda_id, place_id, residency_type from public_read.residencies where release_id = '${ZERO_UUID}'::uuid and end_on is null order by panda_id, residency_id`,
      },
      {
        expectedIndex: "idx_public_read_residencies_place",
        query: `select residency_id, panda_id, place_id, start_on from public_read.residencies where release_id = '${ZERO_UUID}'::uuid and place_id = '${ZERO_UUID}'::uuid order by panda_id, start_on, residency_id`,
      },
    ];

    try {
      await database.transaction(async (trx) => {
        await sql`set local enable_seqscan = off`.execute(trx);
        for (const check of checks) {
          const result = await sql.raw<{ "QUERY PLAN": Array<{ Plan: ExplainNode }> }>(
            `EXPLAIN (FORMAT JSON) ${check.query}`,
          ).execute(trx);
          const rootPlan = result.rows[0]?.["QUERY PLAN"]?.[0]?.Plan;
          expect(rootPlan).toBeDefined();
          if (rootPlan === undefined) continue;
          const indexes = collectIndexNames(rootPlan);
          expect(indexes, `query: ${check.query}`).toContain(check.expectedIndex);
        }
        throw new RollbackSentinel();
      });
    } catch (error) {
      if (!(error instanceof RollbackSentinel)) throw error;
    }
  });

  it("preserves canonical priority, legacy slug fallback, UUID lookup, and participant containment in PostgresPublicReadRepository", async () => {
    const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
    const releaseId = randomUUID();
    const panda1Id = randomUUID();
    const panda2Id = randomUUID();
    const place1Id = randomUUID();
    const place2Id = randomUUID();
    const eventId = `event-${suffix}`;
    const canonicalSlug = `idx-panda-${suffix}`;
    const panda2Slug = `idx-panda-other-${suffix}`;
    const legacyPandaSlug = `idx-panda-old-${suffix}`;
    const canonicalPlaceSlug = `idx-place-${suffix}`;
    const place2Slug = `idx-place-other-${suffix}`;
    const legacyPlaceSlug = `idx-place-old-${suffix}`;

    try {
      await database.transaction(async (trx) => {
        await trx
          .insertInto("publication.releases")
          .values({
            release_id: releaseId,
            version: `2026.11.22.${suffix}`,
            lifecycle_state: "building",
            created_by_system_key: "test.query-indexes",
          })
          .execute();

        await trx
          .insertInto("public_read.pandas")
          .values([
            {
              release_id: releaseId,
              panda_id: panda1Id,
              canonical_slug: canonicalSlug,
              legacy_slugs: [legacyPandaSlug],
              names: sql`'[]'::jsonb`,
              facts: sql`'[]'::jsonb`,
              evidence_source_ids: [],
            },
            {
              release_id: releaseId,
              panda_id: panda2Id,
              canonical_slug: panda2Slug,
              legacy_slugs: [canonicalSlug],
              names: sql`'[]'::jsonb`,
              facts: sql`'[]'::jsonb`,
              evidence_source_ids: [],
            },
          ])
          .execute();

        await trx
          .insertInto("public_read.places")
          .values([
            {
              release_id: releaseId,
              place_id: place1Id,
              institution_id: null,
              slug: canonicalPlaceSlug,
              place_type: "facility",
              legacy_slugs: [legacyPlaceSlug],
            },
            {
              release_id: releaseId,
              place_id: place2Id,
              institution_id: null,
              slug: place2Slug,
              place_type: "facility",
              legacy_slugs: [canonicalPlaceSlug],
            },
          ])
          .execute();

        await trx
          .insertInto("public_read.life_events")
          .values({
            release_id: releaseId,
            event_id: eventId,
            event_type: "transfer",
            event_status: "confirmed",
            occurred_on: "2026-01-15",
            occurred_precision: "day",
            from_place_id: place1Id,
            to_place_id: place2Id,
            summary: "Index verification transfer",
            participant_ids: [panda1Id],
            source_ids: [],
          })
          .execute();

        await trx
          .updateTable("publication.releases")
          .set({
            lifecycle_state: "sealed",
            sealed_at: new Date(),
            content_sha256: "0".repeat(64),
          })
          .where("release_id", "=", releaseId)
          .execute();

        await sql`
          insert into publication.current_release (singleton, release_id)
          values (true, ${releaseId}::uuid)
          on conflict (singleton) do update set release_id = excluded.release_id, updated_at = now()
        `.execute(trx);

        const repo = new PostgresPublicReadRepository({ db: trx } as never, new PublicReadCache());

        const byCanonical = await repo.getPanda(canonicalSlug);
        expect(byCanonical.kind).toBe("ok");
        if (byCanonical.kind === "ok") {
          expect(byCanonical.value.panda.pandaId).toBe(panda1Id);
          expect(byCanonical.value.events.map((event) => event.eventId)).toEqual([eventId]);
        }

        const byLegacy = await repo.getPanda(legacyPandaSlug);
        expect(byLegacy.kind).toBe("ok");
        if (byLegacy.kind === "ok") {
          expect(byLegacy.value.panda.pandaId).toBe(panda1Id);
        }

        const byUuid = await repo.getPanda(panda1Id);
        expect(byUuid.kind).toBe("ok");
        if (byUuid.kind === "ok") {
          expect(byUuid.value.panda.pandaId).toBe(panda1Id);
        }

        await expect(repo.getPanda(`missing-${suffix}`)).resolves.toEqual({ kind: "not_found" });

        const placeByCanonical = await repo.getPlace(canonicalPlaceSlug);
        expect(placeByCanonical).toMatchObject({
          kind: "ok",
          value: { place: { placeId: place1Id, slug: canonicalPlaceSlug } },
        });

        const placeByLegacy = await repo.getPlace(legacyPlaceSlug);
        expect(placeByLegacy).toMatchObject({
          kind: "ok",
          value: { place: { placeId: place1Id, slug: canonicalPlaceSlug } },
        });

        await expect(repo.getPlace(`missing-place-${suffix}`)).resolves.toEqual({ kind: "not_found" });

        throw new RollbackSentinel();
      });
    } catch (error) {
      if (!(error instanceof RollbackSentinel)) throw error;
    }
  });
});
