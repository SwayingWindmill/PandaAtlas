import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { sql } from "kysely";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "../../src/bootstrap.js";
import { PostgresIdentityRepository } from "../../src/modules/identity/infrastructure/postgres-identity.repository.js";
import { DatabaseService } from "../../src/platform/database/database.service.js";
import { IntegrationOutboxService } from "../../src/platform/integration/integration-outbox.service.js";
import { PgmqService } from "../../src/platform/integration/pgmq.service.js";

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";

let app: NestFastifyApplication;
let database: DatabaseService;
let identity: PostgresIdentityRepository;
const outbox = new IntegrationOutboxService();
const pgmq = new PgmqService();

beforeAll(async () => {
  process.env.APP_ENV = "test";
  process.env.CORS_ALLOW_ORIGINS = "http://localhost:3000";
  process.env.DATABASE_URL = DATABASE_URL;
  delete process.env.SUPABASE_URL;

  app = await createApplication();
  database = app.get(DatabaseService);
  identity = new PostgresIdentityRepository(database);

  await sql`
    insert into auth.users (id, aud, role, created_at, updated_at)
    values (${ACCOUNT_ID}::uuid, 'authenticated', 'authenticated', now(), now())
    on conflict (id) do nothing
  `.execute(database.db);
  await sql`
    insert into auth.sessions (id, user_id, created_at, updated_at, aal)
    values (${SESSION_ID}::uuid, ${ACCOUNT_ID}::uuid, now(), now(), 'aal2')
    on conflict (id) do update set user_id = excluded.user_id, aal = excluded.aal
  `.execute(database.db);
});

afterAll(async () => {
  await app.close();
});

describe("NestJS V2 platform against local Supabase PostgreSQL", () => {
  it("serves readiness from the real database while public health ignores auth availability", async () => {
    const health = await app.inject({ method: "GET", url: "/health" });
    const ready = await app.inject({ method: "GET", url: "/ready" });
    const protectedWithoutToken = await app.inject({ method: "GET", url: "/api/v2/me" });
    const protectedWithUnverifiableToken = await app.inject({
      method: "GET",
      url: "/api/v2/me",
      headers: { authorization: "Bearer not-a-real-token" },
    });

    expect(health.statusCode).toBe(200);
    expect(ready.statusCode).toBe(200);
    expect(protectedWithoutToken.statusCode).toBe(401);
    expect(protectedWithoutToken.json()).toMatchObject({ code: "auth.invalidToken" });
    expect(protectedWithUnverifiableToken.statusCode).toBe(503);
    expect(protectedWithUnverifiableToken.json()).toMatchObject({
      code: "system.dependencyUnavailable",
    });
  });

  it("has the required database extensions and bounded app role", async () => {
    const extensions = await sql<{ extname: string }>`
      select extname from pg_extension where extname in ('postgis', 'pgmq') order by extname
    `.execute(database.db);
    const role = await sql<{
      rolcanlogin: boolean;
      rolsuper: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
    }>`
      select rolcanlogin, rolsuper, rolcreatedb, rolcreaterole
      from pg_roles
      where rolname = 'zhipanda_app'
    `.execute(database.db);
    const privileges = await sql<{ identity_select: boolean; public_pandas_select: boolean }>`
      select
        has_table_privilege('zhipanda_app', 'identity.accounts', 'select') as identity_select,
        has_table_privilege('zhipanda_app', 'public.pandas', 'select') as public_pandas_select
    `.execute(database.db);

    expect(extensions.rows.map((row) => row.extname)).toEqual(["pgmq", "postgis"]);
    expect(role.rows[0]).toMatchObject({
      rolcanlogin: false,
      rolsuper: false,
      rolcreatedb: false,
      rolcreaterole: false,
    });
    expect(privileges.rows[0]).toEqual({
      identity_select: true,
      public_pandas_select: false,
    });
  });

  it("provisions exactly the base member account and loads capability security policy", async () => {
    const snapshot = await identity.provisionAccount(ACCOUNT_ID, randomUUID());
    const second = await identity.provisionAccount(ACCOUNT_ID, randomUUID());

    expect(snapshot.accountState).toBe("active");
    expect(snapshot.capabilities.has("account.session.read")).toBe(true);
    expect(snapshot.capabilities.has("identity.role.manage")).toBe(false);
    expect(second.capabilities.has("account.session.read")).toBe(true);

    const memberAssignments = await sql<{ count: string }>`
      select count(*)::text as count
      from identity.role_assignments assignment
      left join identity.role_assignment_revocations revocation
        on revocation.assignment_id = assignment.assignment_id
      where assignment.account_id = ${ACCOUNT_ID}::uuid
        and assignment.role_key = 'member'
        and revocation.assignment_id is null
    `.execute(database.db);
    expect(memberAssignments.rows[0]?.count).toBe("1");
    expect(await identity.isLiveSession(SESSION_ID, ACCOUNT_ID)).toBe(true);

    const sensitivePolicy = await database.db
      .selectFrom("identity.capabilities")
      .select(["requires_recent_auth", "minimum_aal", "requires_live_session"])
      .where("capability_key", "=", "identity.role.manage")
      .executeTakeFirstOrThrow();
    expect(sensitivePolicy).toMatchObject({
      requires_recent_auth: true,
      minimum_aal: "aal2",
      requires_live_session: true,
    });
  });

  it("commits and rolls back Outbox plus PGMQ as one PostgreSQL transaction", async () => {
    const committedIdempotency = `integration-${randomUUID()}`;
    let committedEventId = "";
    await database.transaction(async (transaction) => {
      committedEventId = await outbox.append(transaction, {
        eventType: "platform.integration-test.committed",
        sourceContext: "platform",
        aggregateType: "integration-test",
        aggregateId: randomUUID(),
        idempotencyKey: committedIdempotency,
        correlationId: randomUUID(),
        occurredAt: new Date(),
        payload: { result: "committed" },
      });
      await pgmq.sendEvent(transaction, "integration_updates", committedEventId);
      await outbox.markPublished(transaction, committedEventId);
    });

    const committedOutbox = await database.db
      .selectFrom("integration.outbox_events")
      .select(["event_id", "published_at"])
      .where("event_id", "=", committedEventId)
      .executeTakeFirst();
    const committedQueue = await sql<{ count: string }>`
      select count(*)::text as count
      from pgmq.q_integration_updates
      where message ->> 'eventId' = ${committedEventId}
    `.execute(database.db);
    expect(committedOutbox?.published_at).not.toBeNull();
    expect(committedQueue.rows[0]?.count).toBe("1");

    let rolledBackEventId = "";
    await expect(
      database.transaction(async (transaction) => {
        rolledBackEventId = await outbox.append(transaction, {
          eventType: "platform.integration-test.rolled-back",
          sourceContext: "platform",
          aggregateType: "integration-test",
          aggregateId: randomUUID(),
          idempotencyKey: `integration-${randomUUID()}`,
          correlationId: randomUUID(),
          occurredAt: new Date(),
          payload: { result: "rolled-back" },
        });
        await pgmq.sendEvent(transaction, "integration_updates", rolledBackEventId);
        throw new Error("force rollback");
      }),
    ).rejects.toThrow("force rollback");

    const rolledBackOutbox = await database.db
      .selectFrom("integration.outbox_events")
      .select("event_id")
      .where("event_id", "=", rolledBackEventId)
      .executeTakeFirst();
    const rolledBackQueue = await sql<{ count: string }>`
      select count(*)::text as count
      from pgmq.q_integration_updates
      where message ->> 'eventId' = ${rolledBackEventId}
    `.execute(database.db);
    expect(rolledBackOutbox).toBeUndefined();
    expect(rolledBackQueue.rows[0]?.count).toBe("0");
  });
});
