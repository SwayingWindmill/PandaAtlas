import { Kysely, PostgresDialect } from "kysely";
import { readFileSync } from "node:fs";
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { apiSourceFiles, DATABASE_URL } from "./api-source.js";

// The admin shell gate lives in the Web app (features/admin/shell), not in an API route.
const WEB_ENFORCED_CAPABILITIES = new Set(["admin.shell.access"]);
// Every staff role grants this; it does not make a role a duty.
const SESSION_CAPABILITIES = new Set(["account.session.read"]);

// Every dotted string literal the API source names; capability keys are among them.
function namedByApi(): Set<string> {
  const named = new Set<string>();
  for (const file of apiSourceFiles()) {
    for (const match of readFileSync(file, "utf8").matchAll(/"([a-z_]+(?:\.[a-z_]+)+)"/gu)) named.add(match[1]!);
  }
  return named;
}

interface CatalogDatabase {
  "identity.capabilities": { capability_key: string };
  "identity.roles": { role_key: string; is_staff: boolean };
  "identity.role_capabilities": { role_key: string; capability_key: string };
}

const database = new Kysely<CatalogDatabase>({
  dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: DATABASE_URL }) }),
});

afterAll(async () => {
  await database.destroy();
});

describe("staff capability catalog", () => {
  // A capability nothing checks still appears on staff accounts and in the delegation console (#633).
  it("holds only capabilities the API or the Web enforces", async () => {
    const named = namedByApi();
    const catalog = await database.selectFrom("identity.capabilities").select("capability_key").execute();
    const unenforced = catalog
      .map((row) => row.capability_key)
      .filter((key) => !named.has(key) && !WEB_ENFORCED_CAPABILITIES.has(key))
      .sort();
    expect(unenforced).toEqual([]);
  });

  it("gives every staff role a duty of its own", async () => {
    const named = namedByApi();
    const roles = await database.selectFrom("identity.roles").select("role_key").where("is_staff", "=", true).execute();
    const mappings = await database.selectFrom("identity.role_capabilities").selectAll().execute();
    const duties = new Map(
      roles.map((role) => [
        role.role_key,
        mappings
          .filter((mapping) => mapping.role_key === role.role_key)
          .map((mapping) => mapping.capability_key)
          .filter((key) => named.has(key) && !SESSION_CAPABILITIES.has(key))
          .sort()
          .join(" "),
      ]),
    );
    const withoutDuty = [...duties].filter(([, keys]) => keys === "").map(([role]) => role);
    expect(withoutDuty).toEqual([]);
    const duplicates = [...duties].filter(([role, keys]) => [...duties].some(([other, otherKeys]) => other < role && otherKeys === keys));
    expect(duplicates.map(([role]) => role)).toEqual([]);
  });
});
