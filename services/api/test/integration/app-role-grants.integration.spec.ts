import { Kysely, PostgresDialect, sql } from "kysely";
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// Schemas the application role can use but that are not API storage: the Supabase Data API schema
// and the pg_net extension.
const NON_API_SCHEMAS = ["public", "net"];

// Relations in API schemas that the application role deliberately cannot read.
const NOT_READ_BY_THE_API: Record<string, string> = {
  "evidence.pipeline_source_export_v1": "read by the offline tools/panda-data pipeline, not the API",
  "media.pipeline_asset_export_v1": "read by the offline tools/panda-data pipeline, not the API",
  "panda.pipeline_identity_export_v1": "read by the offline tools/panda-data pipeline, not the API",
  "community_intake.attachment_scan_events": "V1-era table no runtime reads or writes; retirement in #575",
  "community_intake.audit_events": "V1-era table no runtime reads or writes; retirement in #575",
  "community_intake.contributor_journey_events": "V1-era table no runtime reads or writes; retirement in #575",
  "community_intake.retention_events": "V1-era table no runtime reads or writes; retirement in #575",
  "community_intake.sensitive_read_events": "V1-era table no runtime reads or writes; retirement in #575",
  "review_moderation.audit_events": "V1-era table no runtime reads or writes; retirement in #575",
  "review_moderation.command_receipts": "V1-era table no runtime reads or writes; retirement in #575",
  "review_moderation.moderation_alerts": "V1-era view no runtime reads; retirement in #575",
  "review_moderation.moderation_audit_events": "V1-era table no runtime reads or writes; retirement in #575",
  "review_moderation.moderation_command_receipts": "V1-era table no runtime reads or writes; retirement in #575",
  "review_moderation.moderation_subject_status": "V1-era table no runtime reads or writes; retirement in #575",
  "review_moderation.sla_alerts": "V1-era view no runtime reads; retirement in #575",
};

const database = new Kysely<unknown>({ dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: DATABASE_URL }) }) });

afterAll(async () => {
  await database.destroy();
});

describe("application role grants", () => {
  // Integration tests connect as postgres, so a migration that forgets a grant passes every other
  // suite and fails only in production (#547, #571).
  it("lets the application role read every relation in the API's schemas", async () => {
    const result = await sql<{ relation: string; readable: boolean }>`
      select n.nspname || '.' || c.relname as relation,
        has_table_privilege('zhipanda_app', c.oid, 'select') as readable
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('r', 'p', 'v', 'm')
        and has_schema_privilege('zhipanda_app', n.oid, 'usage')
        and n.nspname not in ('pg_catalog', 'information_schema')
        and n.nspname <> all(${NON_API_SCHEMAS})
      order by 1
    `.execute(database);
    const relations = new Set(result.rows.map((row) => row.relation));

    const unreadable = result.rows
      .filter((row) => !row.readable && !(row.relation in NOT_READ_BY_THE_API))
      .map((row) => row.relation);
    expect(unreadable).toEqual([]);

    const staleExceptions = Object.keys(NOT_READ_BY_THE_API).filter((relation) => !relations.has(relation));
    expect(staleExceptions).toEqual([]);
  });
});
