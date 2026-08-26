import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { sql } from "kysely";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "../../src/bootstrap.js";
import { EVIDENCE_PORT, type EvidencePort } from "../../src/modules/evidence/application/evidence.application.js";
import { PANDA_PORT, type PandaPort } from "../../src/modules/panda/application/panda.application.js";
import { DatabaseService } from "../../src/platform/database/database.service.js";

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

let app: NestFastifyApplication;
let jwksServer: Server;
let privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];
let issuer: string;

const contributor = { accountId: randomUUID(), sessionId: randomUUID(), role: "member", aal: "aal1" as const };
const reviewer = { accountId: randomUUID(), sessionId: randomUUID(), role: "reviewer", aal: "aal1" as const };
const editor = { accountId: randomUUID(), sessionId: randomUUID(), role: "archive_editor", aal: "aal1" as const };
const seniorEditor = {
  accountId: randomUUID(),
  sessionId: randomUUID(),
  role: "senior_archive_editor",
  aal: "aal2" as const,
};
const moderator = { accountId: randomUUID(), sessionId: randomUUID(), role: "moderator", aal: "aal2" as const };
const moderationTarget = { accountId: randomUUID(), sessionId: randomUUID(), role: "member", aal: "aal1" as const };

async function seedActor(actor: {
  accountId: string;
  sessionId: string;
  role: string;
  aal: "aal1" | "aal2";
}): Promise<void> {
  const database = app.get(DatabaseService);
  await sql`
    insert into auth.users (id, aud, role, created_at, updated_at)
    values (${actor.accountId}::uuid, 'authenticated', 'authenticated', now(), now())
    on conflict (id) do nothing
  `.execute(database.db);
  await sql`
    insert into auth.sessions (id, user_id, created_at, updated_at, aal)
    values (${actor.sessionId}::uuid, ${actor.accountId}::uuid, now(), now(), ${actor.aal})
    on conflict (id) do update set user_id = excluded.user_id, aal = excluded.aal
  `.execute(database.db);
  await database.db
    .insertInto("identity.accounts")
    .values({ account_id: actor.accountId, email: null })
    .onConflict((conflict) => conflict.column("account_id").doNothing())
    .execute();
  await database.db
    .insertInto("identity.role_assignments")
    .values({
      account_id: actor.accountId,
      role_key: actor.role,
      assigned_by_account_id: null,
      reason: "V2 governance integration fixture",
      source: "integration_test",
      correlation_id: randomUUID(),
      idempotency_key: `governance:${actor.role}:${actor.accountId}`,
    })
    .execute();
}

async function tokenFor(actor: {
  accountId: string;
  sessionId: string;
  aal: "aal1" | "aal2";
}): Promise<string> {
  const now = Math.floor(Date.now() / 1_000);
  return new SignJWT({
    role: "authenticated",
    aal: actor.aal,
    session_id: actor.sessionId,
    is_anonymous: false,
    amr: [{ method: "password", timestamp: now - 10 }],
  })
    .setProtectedHeader({ alg: "ES256", kid: "governance-http" })
    .setIssuer(issuer)
    .setAudience("authenticated")
    .setSubject(actor.accountId)
    .setIssuedAt(now)
    .setExpirationTime(now + 600)
    .sign(privateKey);
}

function headers(token: string) {
  return { authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  const keyPair = await generateKeyPair("ES256");
  privateKey = keyPair.privateKey;
  const jwk = await exportJWK(keyPair.publicKey);
  Object.assign(jwk, { kid: "governance-http", alg: "ES256", use: "sig" });

  jwksServer = createServer((request, response) => {
    if (request.url === "/auth/v1/.well-known/jwks.json") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    response.statusCode = 404;
    response.end();
  });
  await new Promise<void>((resolve) => jwksServer.listen(0, "127.0.0.1", resolve));
  const address = jwksServer.address();
  if (address === null || typeof address === "string") throw new Error("JWKS server did not bind");

  const supabaseUrl = `http://127.0.0.1:${address.port}`;
  issuer = `${supabaseUrl}/auth/v1`;
  process.env.APP_ENV = "test";
  process.env.CORS_ALLOW_ORIGINS = "http://localhost:3000";
  process.env.DATABASE_URL = DATABASE_URL;
  process.env.SUPABASE_URL = supabaseUrl;
  app = await createApplication();

  for (const actor of [contributor, reviewer, editor, seniorEditor, moderator, moderationTarget]) {
    await seedActor(actor);
  }
});

afterAll(async () => {
  await app.close();
  await new Promise<void>((resolve, reject) =>
    jwksServer.close((error) => (error === undefined ? resolve() : reject(error))),
  );
});

describe("V2 contribution, review, curation, and moderation", () => {
  it("moves an immutable contribution through Review and Curation before Panda owner applies the fact", async () => {
    const suffix = randomUUID();
    const evidence = app.get<EvidencePort>(EVIDENCE_PORT);
    const pandas = app.get<PandaPort>(PANDA_PORT);
    const database = app.get(DatabaseService);
    const canonicalSourceId = `governance:${suffix}`;
    const secondaryCanonicalSourceId = `governance-secondary:${suffix}`;
    const locator = `https://example.test/governance/${suffix}`;
    const secondaryLocator = `https://example.test/governance-secondary/${suffix}`;
    await evidence.createSource({
      sourceId: canonicalSourceId,
      publisher: "Governance Fixture",
      title: "Governance integration source",
      url: locator,
      publishedOn: "2026-08-26",
      lastVerifiedOn: "2026-08-26",
      languageTag: "en",
      accessState: "accessible",
      evidenceTier: "institutional",
    });
    await evidence.createSource({
      sourceId: secondaryCanonicalSourceId,
      publisher: "Governance Fixture",
      title: "Governance secondary integration source",
      url: secondaryLocator,
      publishedOn: "2026-08-26",
      lastVerifiedOn: "2026-08-26",
      languageTag: "en",
      accessState: "accessible",
      evidenceTier: "institutional",
    });
    const panda = await pandas.createPanda({
      canonicalSlug: `governance-${suffix}`,
      primaryName: {
        languageTag: "en",
        value: `Governance Panda ${suffix}`,
        sourceIds: [canonicalSourceId],
      },
    });

    const contributorToken = await tokenFor(contributor);
    const reviewerToken = await tokenFor(reviewer);
    const editorToken = await tokenFor(editor);
    const seniorEditorToken = await tokenFor(seniorEditor);

    const submit = await app.inject({
      method: "POST",
      url: "/api/v2/contributions",
      headers: headers(contributorToken),
      payload: {
        submissionType: "correction",
        targetPandaId: panda.pandaId,
        publicVersionSeen: "integration-release",
        assertions: [
          {
            assertionKey: "sex-correction",
            fieldKey: "profile.sex",
            value: "female",
            certainty: "confirmed",
            lastVerifiedOn: "2026-08-26",
            sourceKeys: ["primary-source"],
          },
        ],
        sources: [
          { sourceKey: "primary-source", sourceKind: "url", title: "Contributor source", locator },
          {
            sourceKey: "secondary-source",
            sourceKind: "url",
            title: "Contributor secondary source",
            locator: secondaryLocator,
          },
        ],
      },
    });
    expect(submit.statusCode).toBe(201);
    const submissionId = submit.json<{ submissionId: string }>().submissionId;
    const submittedSources = await database.db
      .selectFrom("community_intake.submitted_sources")
      .select(["source_id", "locator"])
      .where("submission_id", "=", submissionId)
      .execute();
    const submittedSource = submittedSources.find((source) => source.locator === locator);
    const secondarySubmittedSource = submittedSources.find((source) => source.locator === secondaryLocator);
    if (submittedSource === undefined || secondarySubmittedSource === undefined) {
      throw new Error("Governance contribution sources were not persisted");
    }

    const open = await app.inject({
      method: "POST",
      url: "/api/v2/review/cases",
      headers: headers(reviewerToken),
      payload: { submissionId },
    });
    expect(open.statusCode).toBe(201);
    const reviewCaseId = open.json<{ reviewCaseId: string }>().reviewCaseId;

    const claim = await app.inject({
      method: "POST",
      url: `/api/v2/review/cases/${reviewCaseId}/claim`,
      headers: headers(reviewerToken),
    });
    expect(claim.statusCode).toBe(200);

    const verify = await app.inject({
      method: "POST",
      url: `/api/v2/review/cases/${reviewCaseId}/source-verifications`,
      headers: headers(reviewerToken),
      payload: {
        sourceId: submittedSource.source_id,
        outcome: "verified",
        normalizedLocator: locator,
        canonicalSourceId,
        reason: "Resolved to the canonical Evidence source.",
      },
    });
    expect(verify.statusCode).toBe(201);

    const verifySecondary = await app.inject({
      method: "POST",
      url: `/api/v2/review/cases/${reviewCaseId}/source-verifications`,
      headers: headers(reviewerToken),
      payload: {
        sourceId: secondarySubmittedSource.source_id,
        outcome: "verified",
        normalizedLocator: secondaryLocator,
        canonicalSourceId: secondaryCanonicalSourceId,
        reason: "Resolved the secondary source to canonical Evidence as well.",
      },
    });
    expect(verifySecondary.statusCode).toBe(201);

    const decision = await app.inject({
      method: "POST",
      url: `/api/v2/review/cases/${reviewCaseId}/decision`,
      headers: headers(reviewerToken),
      payload: {
        outcome: "accepted",
        selectedAssertionKeys: ["sex-correction"],
        userVisibleExplanation: "The submitted correction is supported by verified evidence.",
        internalReason: "Canonical institutional evidence confirms the assertion.",
      },
    });
    expect(decision.statusCode).toBe(200);

    const recommend = await app.inject({
      method: "POST",
      url: `/api/v2/review/cases/${reviewCaseId}/recommend`,
      headers: headers(reviewerToken),
      payload: { reason: "Send the accepted assertion to independent Curation." },
    });
    expect(recommend.statusCode).toBe(200);
    const changeSetId = recommend.json<{ changeSetId: string }>().changeSetId;

    const beforeApproval = await pandas.getPanda(panda.pandaId);
    expect(beforeApproval?.conclusions.some((item) => item.fieldKey === "profile.sex")).toBe(false);

    const validate = await app.inject({
      method: "POST",
      url: `/api/v2/curation/change-sets/${changeSetId}/validate`,
      headers: headers(editorToken),
    });
    expect(validate.statusCode).toBe(200);
    expect(validate.json()).toMatchObject({
      reviewCaseId,
      submissionId,
      targetPandaId: panda.pandaId,
      state: "validated",
    });

    const stillBeforeApproval = await pandas.getPanda(panda.pandaId);
    expect(stillBeforeApproval?.conclusions.some((item) => item.fieldKey === "profile.sex")).toBe(false);

    const approve = await app.inject({
      method: "POST",
      url: `/api/v2/curation/change-sets/${changeSetId}/approve`,
      headers: headers(seniorEditorToken),
      payload: { reason: "Independent approval after semantic validation." },
    });
    expect(approve.statusCode).toBe(200);
    expect(approve.json()).toMatchObject({ state: "applied", approvedByAccountId: seniorEditor.accountId });

    const applied = await pandas.getPanda(panda.pandaId);
    expect(applied?.conclusions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldKey: "profile.sex", value: "female", status: "confirmed" }),
      ]),
    );
    const appliedAssertion = await database.db
      .selectFrom("panda.fact_assertions")
      .select("assertion_id")
      .where("panda_id", "=", panda.pandaId)
      .where("field_key", "=", "profile.sex")
      .orderBy("created_at", "desc")
      .executeTakeFirstOrThrow();
    const appliedSources = await database.db
      .selectFrom("panda.fact_assertion_sources")
      .select("source_id")
      .where("assertion_id", "=", appliedAssertion.assertion_id)
      .orderBy("source_id")
      .execute();
    expect(appliedSources.map((source) => source.source_id)).toEqual([canonicalSourceId]);
  });

  it("lets a suspended member appeal while other account APIs stay blocked, then restores Identity on overturn", async () => {
    const moderatorToken = await tokenFor(moderator);
    const targetToken = await tokenFor(moderationTarget);

    const sanction = await app.inject({
      method: "POST",
      url: `/api/v2/moderation/accounts/${moderationTarget.accountId}/sanctions`,
      headers: headers(moderatorToken),
      payload: {
        kind: "account_suspended",
        reasonCode: "repeat_abuse",
        internalExplanation: "Integration fixture suspension with enough internal detail.",
        userVisibleExplanation: "Your account is suspended while this moderation action is reviewed.",
        endsAt: new Date(Date.now() + 86_400_000).toISOString(),
        idempotencyKey: `suspend-${randomUUID()}`,
      },
    });
    expect(sanction.statusCode).toBe(201);
    const sanctionId = sanction.json<{ sanctionId: string }>().sanctionId;

    const blockedProfile = await app.inject({
      method: "GET",
      url: "/api/v2/me/profile",
      headers: headers(targetToken),
    });
    expect(blockedProfile.statusCode).toBe(403);

    const appeal = await app.inject({
      method: "POST",
      url: "/api/v2/me/moderation/appeals",
      headers: headers(targetToken),
      payload: {
        sanctionId,
        userStatement: "I am appealing this suspension and asking for the evidence to be reviewed again.",
      },
    });
    expect(appeal.statusCode).toBe(201);
    const appealCaseId = appeal.json<{ appealCaseId: string }>().appealCaseId;

    const overturn = await app.inject({
      method: "POST",
      url: `/api/v2/moderation/appeals/${appealCaseId}/decision`,
      headers: headers(moderatorToken),
      payload: {
        outcome: "overturned",
        internalExplanation: "Re-review found the account suspension should be fully reversed.",
        userVisibleExplanation: "Your appeal was accepted and the account suspension has been removed.",
      },
    });
    expect(overturn.statusCode).toBe(200);
    expect(overturn.json()).toMatchObject({ appealCaseId, outcome: "overturned" });

    const restoredProfile = await app.inject({
      method: "GET",
      url: "/api/v2/me/profile",
      headers: headers(targetToken),
    });
    expect(restoredProfile.statusCode).toBe(200);

    const moderationState = await app.inject({
      method: "GET",
      url: `/api/v2/moderation/accounts/${moderationTarget.accountId}`,
      headers: headers(moderatorToken),
    });
    expect(moderationState.statusCode).toBe(200);
    expect(moderationState.json()).toMatchObject({
      subject: { accountSuspended: false, accountClosedForAbuse: false },
    });
  });
});
