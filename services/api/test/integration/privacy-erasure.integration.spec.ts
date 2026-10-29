import type { NestExpressApplication } from "@nestjs/platform-express";
import { sql } from "kysely";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "../../src/bootstrap.js";
import {
  contributorSubjectHash,
  deidentifiedSubjectHash,
} from "../../src/modules/contribution/application/contribution-erasure.js";
import { AUTH_USER_DELETION, type AuthUserDeletion } from "../../src/modules/identity/application/auth-user-deletion.js";
import { PrivacyRequestProcessorService } from "../../src/modules/privacy/infrastructure/privacy-request-processor.service.js";
import { DatabaseService } from "../../src/platform/database/database.service.js";
import { DATABASE_URL } from "./api-source.js";

const failAuthDeletion = new Set<string>();

let app: NestExpressApplication;
let server: Server;
let pool: pg.Pool;

async function removeAuthUser(userId: string): Promise<boolean> {
  const found = await pool.query("select 1 from auth.users where id = $1", [userId]);
  if (found.rowCount === 0) return false;
  for (const table of ["auth.sessions", "auth.refresh_tokens", "auth.mfa_factors", "auth.identities", "auth.one_time_tokens"]) {
    const reg = await pool.query<{ name: string | null }>("select to_regclass($1) as name", [table]);
    if (!reg.rows[0]?.name) continue;
    const columns = await pool.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = 'auth' and table_name = $1 and column_name = 'user_id'",
      [table.slice("auth.".length)],
    );
    if (columns.rowCount === 0) continue;
    await pool.query(`delete from ${table} where user_id = $1`, [userId]);
  }
  await pool.query("delete from auth.users where id = $1", [userId]);
  return true;
}

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: DATABASE_URL });
  server = createServer((request, response) => {
    const url = request.url ?? "";
    if (url === "/auth/v1/.well-known/jwks.json") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ keys: [] }));
      return;
    }
    const userId = url.match(/^\/auth\/v1\/admin\/users\/([^/?]+)/)?.[1];
    if (request.method === "DELETE" && userId) {
      void (async () => {
        if (failAuthDeletion.has(userId)) {
          response.statusCode = 500;
          response.end(JSON.stringify({ code: "unexpected_failure", message: "Auth deletion failed" }));
          return;
        }
        const removed = await removeAuthUser(userId);
        if (!removed) {
          response.statusCode = 404;
          response.end(JSON.stringify({ code: "user_not_found", message: "User not found" }));
          return;
        }
        response.statusCode = 200;
        response.end(JSON.stringify({ id: userId }));
      })().catch((error: unknown) => {
        response.statusCode = 500;
        response.end(error instanceof Error ? error.message : "delete failed");
      });
      return;
    }
    response.statusCode = 404;
    response.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Auth mock did not bind a port");

  process.env.APP_ENV = "test";
  process.env.CORS_ALLOW_ORIGINS = "http://localhost:3000";
  process.env.DATABASE_URL = DATABASE_URL;
  process.env.SUPABASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.SUPABASE_SECRET_KEY = "test-server-only-key";
  app = await createApplication();
});

afterAll(async () => {
  await app.close();
  await pool.end();
  await new Promise<void>((resolve, reject) => server.close((error) => (error === undefined ? resolve() : reject(error))));
});

async function seedAccount(accountId: string, email: string): Promise<void> {
  const database = app.get(DatabaseService);
  await sql`
    insert into auth.users (id, aud, role, email, created_at, updated_at)
    values (${accountId}::uuid, 'authenticated', 'authenticated', ${email}, now(), now())
    on conflict (id) do update set email = excluded.email
  `.execute(database.db);
  await sql`
    insert into identity.accounts (account_id, email)
    values (${accountId}::uuid, ${email})
    on conflict (account_id) do update set email = excluded.email, state = 'active'
  `.execute(database.db);
}

async function seedCorrection(accountId: string): Promise<{ submissionId: string; reviewerHash: string }> {
  const database = app.get(DatabaseService);
  const submissionId = randomUUID();
  const reviewerHash = contributorSubjectHash(randomUUID());
  const content = JSON.stringify({
    assertions: [{ assertionKey: "assertion-1", fieldKey: "name", value: "圆圆" }],
  });
  await sql`
    insert into community_intake.submissions (
      submission_id, account_id, contributor_subject_hash, submission_type, target_id,
      public_version_seen, state, submitted_at, latest_revision_number, draft_content
    )
    values (
      ${submissionId}::uuid, ${accountId}::uuid, ${contributorSubjectHash(accountId)},
      'correction', ${randomUUID()}, '2026.10.26.1', 'submitted', now(), 1, ${content}::jsonb
    )
  `.execute(database.db);
  await sql`
    insert into community_intake.submission_revisions (
      submission_id, revision_number, content, content_sha256, public_version_seen
    )
    values (
      ${submissionId}::uuid, 1, ${content}::jsonb, ${contributorSubjectHash(content)}, '2026.10.26.1'
    )
  `.execute(database.db);
  const contributorEvent = await sql<{ status_event_id: string }>`
    insert into community_intake.contributor_status_events (
      submission_id, status, active_revision_number, source_context, actor_subject_hash,
      correlation_id, idempotency_key
    )
    values (
      ${submissionId}::uuid, 'submitted', 1, 'contributor', ${contributorSubjectHash(accountId)},
      ${randomUUID()}::uuid, ${`contributor:${submissionId}`}
    )
    returning status_event_id
  `.execute(database.db);
  await sql`
    insert into community_intake.contributor_status_events (
      submission_id, status, active_revision_number, source_context, actor_subject_hash,
      correlation_id, idempotency_key, user_visible_reason
    )
    values (
      ${submissionId}::uuid, 'accepted', 1, 'review', ${reviewerHash},
      ${randomUUID()}::uuid, ${`review:${submissionId}`}, '已核对来源'
    )
  `.execute(database.db);
  await sql`
    update community_intake.submissions
    set current_status_event_id = ${contributorEvent.rows[0]!.status_event_id}::uuid,
        contributor_status = 'accepted'
    where submission_id = ${submissionId}::uuid
  `.execute(database.db);
  await sql`
    insert into community_intake.attachments (
      submission_id, bound_revision_number, storage_object_key, object_version, original_filename,
      media_type, byte_size, content_sha256, upload_completed_at
    )
    values (
      ${submissionId}::uuid, 1, ${`object/${submissionId}`}, '1', 'fan-note.jpg',
      'image/jpeg', 1200, ${contributorSubjectHash("file")}, now()
    )
  `.execute(database.db);
  return { submissionId, reviewerHash };
}

async function fileDeletion(accountId: string): Promise<void> {
  const database = app.get(DatabaseService);
  const requestId = randomUUID();
  await sql`
    insert into privacy.subject_requests (
      request_id, account_id, kind, reason, idempotency_key, correlation_id, requested_at
    )
    values (
      ${requestId}::uuid, ${accountId}::uuid, 'account_deletion', '请注销账号',
      ${randomUUID()}, ${randomUUID()}::uuid, '1970-01-01'
    )
  `.execute(database.db);
  for (const participant of ["engagement", "game", "notification", "identity"]) {
    await sql`
      insert into privacy.subject_request_steps (request_id, participant_key)
      values (${requestId}::uuid, ${participant})
    `.execute(database.db);
  }
}

describe("account deletion de-identifies corrections and removes the auth user", () => {
  it("keeps the correction and review history, drops the person, and deletes the auth user", async () => {
    const accountId = randomUUID();
    await seedAccount(accountId, `erase-${accountId}@example.test`);
    const { submissionId, reviewerHash } = await seedCorrection(accountId);
    await fileDeletion(accountId);

    const result = await app.get(PrivacyRequestProcessorService).processBatch(1);
    expect(result).toMatchObject({ completed: 1, failed: 0 });

    const database = app.get(DatabaseService);
    const submission = await sql<{
      account_id: string | null;
      contributor_subject_hash: string;
      content: { assertions: { value: string }[] };
      contributor_status: string;
    }>`
      select submission.account_id, submission.contributor_subject_hash, revision.content, submission.contributor_status
      from community_intake.submissions submission
      join community_intake.submission_revisions revision
        on revision.submission_id = submission.submission_id and revision.revision_number = 1
      where submission.submission_id = ${submissionId}::uuid
    `.execute(database.db);
    const row = submission.rows[0]!;
    expect(row.account_id).toBeNull();
    expect(row.contributor_subject_hash).toBe(deidentifiedSubjectHash(submissionId));
    expect(row.contributor_subject_hash).not.toBe(contributorSubjectHash(accountId));
    const stored = typeof row.content === "string" ? JSON.parse(row.content) as typeof row.content : row.content;
    expect(stored.assertions[0]?.value).toBe("圆圆");
    expect(row.contributor_status).toBe("accepted");

    const events = await sql<{ actor_subject_hash: string; source_context: string; user_visible_reason: string | null }>`
      select actor_subject_hash, source_context, user_visible_reason
      from community_intake.contributor_status_events
      where submission_id = ${submissionId}::uuid
      order by source_context
    `.execute(database.db);
    const contributor = events.rows.find((event) => event.source_context === "contributor");
    const review = events.rows.find((event) => event.source_context === "review");
    expect(contributor?.actor_subject_hash).toBe(deidentifiedSubjectHash(submissionId));
    expect(review?.actor_subject_hash).toBe(reviewerHash);
    expect(review?.user_visible_reason).toBe("已核对来源");

    const attachment = await sql<{ original_filename: string; state: string }>`
      select original_filename, state from community_intake.attachments
      where submission_id = ${submissionId}::uuid
    `.execute(database.db);
    expect(attachment.rows[0]).toMatchObject({ original_filename: "[deleted]", state: "deleted" });

    const account = await sql<{ email: string | null; state: string }>`
      select email, state from identity.accounts where account_id = ${accountId}::uuid
    `.execute(database.db);
    expect(account.rows[0]).toEqual({ email: null, state: "deleted" });
    expect((await pool.query("select 1 from auth.users where id = $1", [accountId])).rowCount).toBe(0);

    await expect(app.get<AuthUserDeletion>(AUTH_USER_DELETION).deleteUser(accountId)).resolves.toBeUndefined();
  });

  it("rolls the panda-side cleanup back when auth deletion fails", async () => {
    const accountId = randomUUID();
    failAuthDeletion.add(accountId);
    await seedAccount(accountId, `fail-${accountId}@example.test`);
    const { submissionId } = await seedCorrection(accountId);
    await fileDeletion(accountId);

    const result = await app.get(PrivacyRequestProcessorService).processBatch(1);
    expect(result).toMatchObject({ completed: 0, failed: 1 });

    const database = app.get(DatabaseService);
    const submission = await sql<{ account_id: string | null }>`
      select account_id from community_intake.submissions where submission_id = ${submissionId}::uuid
    `.execute(database.db);
    expect(submission.rows[0]?.account_id).toBe(accountId);
    const account = await sql<{ state: string; email: string | null }>`
      select state, email from identity.accounts where account_id = ${accountId}::uuid
    `.execute(database.db);
    expect(account.rows[0]).toMatchObject({ state: "active", email: `fail-${accountId}@example.test` });
    expect((await pool.query("select 1 from auth.users where id = $1", [accountId])).rowCount).toBe(1);
    failAuthDeletion.delete(accountId);
  });
});
