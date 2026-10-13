import { Kysely, PostgresDialect, sql } from "kysely";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const SOURCE_ROOT = fileURLToPath(new URL("../../src/", import.meta.url));

type Privilege = "select" | "insert" | "update" | "delete" | "execute";

// Statements the API source issues against "schema.relation", through Kysely or raw SQL.
const ACCESS_PATTERNS: Array<[RegExp, Privilege]> = [
  [/\.(?:selectFrom|innerJoin|leftJoin|rightJoin|fullJoin)\(\s*"([a-z_]+\.[a-z_]+)/gu, "select"],
  [/\.insertInto\(\s*"([a-z_]+\.[a-z_]+)/gu, "insert"],
  [/\.updateTable\(\s*"([a-z_]+\.[a-z_]+)/gu, "update"],
  [/\.deleteFrom\(\s*"([a-z_]+\.[a-z_]+)/gu, "delete"],
  [/\b(?:from|join)\s+([a-z_]+\.[a-z_]+)\b(?!\s*\()/giu, "select"],
  [/\binsert\s+into\s+([a-z_]+\.[a-z_]+)/giu, "insert"],
  [/\bupdate\s+([a-z_]+\.[a-z_]+)\s+set\b/giu, "update"],
  [/\bdelete\s+from\s+([a-z_]+\.[a-z_]+)/giu, "delete"],
  // Schema-qualified calls; TypeScript calls such as database.transaction( resolve to no function.
  [/\b([a-z_]+\.[a-z_]+)\(/gu, "execute"],
];

// Access the application role deliberately lacks, each with the issue that resolves it.
const KNOWN_GAPS = new Set([
  "select pipeline.artifacts", // unrouted acquisition curation path, #576
  "select pipeline.jobs", // unrouted acquisition curation path, #576
]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".generated.ts") ? [absolute] : [];
  });
}

function requiredAccess(): string[] {
  const access = new Set<string>();
  for (const file of sourceFiles(SOURCE_ROOT)) {
    const source = readFileSync(file, "utf8");
    for (const [pattern, privilege] of ACCESS_PATTERNS) {
      for (const match of source.matchAll(pattern)) access.add(`${privilege} ${match[1]!.toLowerCase()}`);
    }
  }
  return [...access].sort();
}

const database = new Kysely<unknown>({ dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: DATABASE_URL }) }) });

afterAll(async () => {
  await database.destroy();
});

describe("application role grants", () => {
  // Integration tests connect as postgres, so a migration that forgets a grant passes every other
  // suite and fails only in production (#547, #571).
  it("grants the application role every table and function privilege the API source uses", async () => {
    const access = requiredAccess().map((entry) => {
      const [privilege, relation] = entry.split(" ") as [Privilege, string];
      return { entry, privilege, relation };
    });
    expect(access.length).toBeGreaterThan(100);

    const result = await sql<{ entry: string; granted: boolean }>`
      with required as (
        select * from jsonb_to_recordset(${JSON.stringify(access)}::jsonb)
          as required(entry text, privilege text, relation text)
      )
      select required.entry,
        has_schema_privilege('zhipanda_app', c.relnamespace, 'usage')
          and has_table_privilege('zhipanda_app', c.oid, required.privilege) as granted
      from required join pg_class c on c.oid = to_regclass(required.relation)
      where required.privilege <> 'execute'
      union all
      select required.entry,
        has_schema_privilege('zhipanda_app', p.pronamespace, 'usage')
          and has_function_privilege('zhipanda_app', p.oid, 'execute') as granted
      from required join pg_proc p on p.oid = to_regproc(required.relation)
      where required.privilege = 'execute'
      order by 1
    `.execute(database);

    const missing = result.rows.filter((row) => !row.granted && !KNOWN_GAPS.has(row.entry)).map((row) => row.entry);
    expect(missing).toEqual([]);

    const resolvedGaps = result.rows.filter((row) => row.granted && KNOWN_GAPS.has(row.entry)).map((row) => row.entry);
    expect(resolvedGaps).toEqual([]);
  });
});
