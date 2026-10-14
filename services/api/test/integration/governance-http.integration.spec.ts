import type { NestExpressApplication } from "@nestjs/platform-express";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { sql } from "kysely";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "../../src/bootstrap.js";
import { EVIDENCE_PORT, type EvidencePort } from "../../src/modules/evidence/application/evidence.application.js";
import { PANDA_PORT, type PandaPort } from "../../src/modules/panda/application/panda.application.js";
import type {
  PublicationReleaseInspection,
  PublicationReleasePage,
} from "../../src/modules/publication/application/publication-inspection.port.js";
import { DatabaseService } from "../../src/platform/database/database.service.js";
import { injectHttp } from "../inject-http.js";

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

let app: NestExpressApplication;
let jwksServer: Server;
let privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];
let issuer: string;

const contributor = { accountId: randomUUID(), sessionId: randomUUID(), role: "member", aal: "aal1" as const };
const reviewer = { accountId: randomUUID(), sessionId: randomUUID(), role: "reviewer", aal: "aal1" as const };
const editor = { accountId: randomUUID(), sessionId: randomUUID(), role: "archive_editor", aal: "aal1" as const };
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

  for (const actor of [contributor, reviewer, editor, moderator, moderationTarget]) {
    await seedActor(actor);
  }
});

afterAll(async () => {
  await app.close();
  await new Promise<void>((resolve, reject) =>
    jwksServer.close((error) => (error === undefined ? resolve() : reject(error))),
  );
});

describe("V2 contribution, review, and moderation", () => {
  it("exposes operator-readable Publication release inspection through the authenticated V2 contract", async () => {
    const database = app.get(DatabaseService);
    const editorToken = await tokenFor(editor);
    const currentReleaseId = randomUUID();
    const candidateReleaseId = randomUUID();
    const sharedPandaId = randomUUID();
    const newPandaId = randomUUID();
    const removedPlaceId = randomUUID();
    const suffix = randomUUID();
    const previousPointer = await database.db
      .selectFrom("publication.current_release")
      .select("release_id")
      .where("singleton", "=", true)
      .executeTakeFirst();
    const currentBuiltAt = new Date(Date.now() - 2_000);
    const candidateBuiltAt = new Date(Date.now() - 1_000);

    try {
      await database.db
        .insertInto("publication.releases")
        .values([
          {
            release_id: currentReleaseId,
            version: `inspection-current-${suffix}`,
            projection_schema_version: 1,
            lifecycle_state: "building",
            built_at: currentBuiltAt,
            created_by_account_id: editor.accountId,
            created_by_system_key: null,
          },
          {
            release_id: candidateReleaseId,
            version: `inspection-candidate-${suffix}`,
            projection_schema_version: 1,
            lifecycle_state: "building",
            built_at: candidateBuiltAt,
            created_by_account_id: editor.accountId,
            created_by_system_key: null,
          },
        ])
        .execute();
      await database.db
        .insertInto("publication.release_memberships")
        .values([
          {
            release_id: currentReleaseId,
            resource_kind: "panda",
            resource_id: sharedPandaId,
            source_revision: "1",
            source_version: "1",
            source_sha256: "a".repeat(64),
            projection_sha256: "a".repeat(64),
          },
          {
            release_id: currentReleaseId,
            resource_kind: "place",
            resource_id: removedPlaceId,
            source_revision: "1",
            source_version: "1",
            source_sha256: "b".repeat(64),
            projection_sha256: "b".repeat(64),
          },
          {
            release_id: candidateReleaseId,
            resource_kind: "panda",
            resource_id: sharedPandaId,
            source_revision: "2",
            source_version: "2",
            source_sha256: "c".repeat(64),
            projection_sha256: "c".repeat(64),
          },
          {
            release_id: candidateReleaseId,
            resource_kind: "panda",
            resource_id: newPandaId,
            source_revision: "1",
            source_version: "1",
            source_sha256: "d".repeat(64),
            projection_sha256: "d".repeat(64),
          },
        ])
        .execute();
      await database.db
        .updateTable("publication.releases")
        .set({
          lifecycle_state: "sealed",
          sealed_at: currentBuiltAt,
          content_sha256: "1".repeat(64),
        })
        .where("release_id", "=", currentReleaseId)
        .executeTakeFirstOrThrow();
      await database.db
        .updateTable("publication.releases")
        .set({
          lifecycle_state: "sealed",
          sealed_at: candidateBuiltAt,
          content_sha256: "2".repeat(64),
        })
        .where("release_id", "=", candidateReleaseId)
        .executeTakeFirstOrThrow();
      await database.db
        .insertInto("publication.release_transitions")
        .values({
          release_id: candidateReleaseId,
          transition_type: "sealed",
          actor_account_id: editor.accountId,
          actor_system_key: null,
          reason: "Reviewed candidate for control-plane inspection.",
          occurred_at: candidateBuiltAt,
        })
        .execute();
      await database.db
        .insertInto("publication.current_release")
        .values({ singleton: true, release_id: currentReleaseId })
        .onConflict((conflict) => conflict.column("singleton").doUpdateSet({ release_id: currentReleaseId }))
        .execute();

      const list = await injectHttp(app, {
        method: "GET",
        url: "/api/v2/publication/releases?limit=100&offset=0&lifecycleState=sealed",
        headers: headers(editorToken),
      });
      expect(list.statusCode, list.body).toBe(200);
      const listBody = list.json<PublicationReleasePage>();
      expect(listBody.currentReleaseId).toBe(currentReleaseId);
      expect(listBody.currentRelease?.releaseId).toBe(currentReleaseId);
      expect(listBody.limit).toBe(100);
      expect(listBody.offset).toBe(0);
      const currentSummary = listBody.items.find((release) => release.releaseId === currentReleaseId);
      const candidateSummary = listBody.items.find((release) => release.releaseId === candidateReleaseId);
      expect(currentSummary?.isCurrent).toBe(true);
      expect(currentSummary?.counts).toMatchObject({ panda: 1, place: 1 });
      expect(candidateSummary?.isCurrent).toBe(false);
      expect(candidateSummary?.counts).toMatchObject({ panda: 2, place: 0 });

      const inspection = await injectHttp(app, {
        method: "GET",
        url: `/api/v2/publication/releases/${candidateReleaseId}/inspection`,
        headers: headers(editorToken),
      });
      expect(inspection.statusCode, inspection.body).toBe(200);
      const inspectionBody = inspection.json<PublicationReleaseInspection>();
      expect(inspectionBody.currentReleaseId).toBe(currentReleaseId);
      expect(inspectionBody.release.releaseId).toBe(candidateReleaseId);
      expect(inspectionBody.release.lifecycleState).toBe("sealed");
      expect(inspectionBody.release.isCurrent).toBe(false);
      expect(inspectionBody.release.suspended).toBe(false);
      expect(inspectionBody.release.counts).toMatchObject({ panda: 2, place: 0 });
      expect(inspectionBody.release.blockers).toEqual([]);
      expect(inspectionBody.changes.find((change) => change.resourceKind === "panda")).toEqual({
        resourceKind: "panda",
        added: 1,
        changed: 1,
        removed: 0,
      });
      expect(inspectionBody.changes.find((change) => change.resourceKind === "place")).toEqual({
        resourceKind: "place",
        added: 0,
        changed: 0,
        removed: 1,
      });
      expect(inspectionBody.transitions).toHaveLength(1);
      expect(inspectionBody.transitions[0]?.transitionType).toBe("sealed");
      expect(inspectionBody.transitions[0]?.actor).toBe(`account:${editor.accountId}`);
      expect(inspectionBody.transitions[0]?.reason).toBe("Reviewed candidate for control-plane inspection.");
    } finally {
      if (previousPointer === undefined) {
        await database.db.deleteFrom("publication.current_release").where("singleton", "=", true).execute();
      } else {
        await database.db
          .updateTable("publication.current_release")
          .set({ release_id: previousPointer.release_id })
          .where("singleton", "=", true)
          .execute();
      }
    }
  });

  async function acceptReviewedCorrection(options: { existingSex?: string }) {
    const suffix = randomUUID();
    const evidence = app.get<EvidencePort>(EVIDENCE_PORT);
    const pandas = app.get<PandaPort>(PANDA_PORT);
    const database = app.get(DatabaseService);
    const canonicalSourceId = `governance:${suffix}`;
    const secondaryCanonicalSourceId = `governance-secondary:${suffix}`;
    const locator = `https://example.test/governance/${suffix}`;
    const secondaryLocator = `https://example.test/governance-secondary/${suffix}`;
    for (const [sourceId, url] of [
      [canonicalSourceId, locator],
      [secondaryCanonicalSourceId, secondaryLocator],
    ] as const) {
      await evidence.createSource({
        sourceId,
        publisher: "Governance Fixture",
        title: `Governance integration source ${sourceId}`,
        url,
        publishedOn: "2026-08-26",
        lastVerifiedOn: "2026-08-26",
        languageTag: "en",
        accessState: "accessible",
        evidenceTier: "institutional",
      });
    }
    const panda = await pandas.createPanda({
      canonicalSlug: `governance-${suffix}`,
      primaryName: {
        languageTag: "en",
        value: `Governance Panda ${suffix}`,
        sourceIds: [canonicalSourceId],
      },
    });
    if (options.existingSex !== undefined) {
      const assertionId = `existing:${suffix}`;
      await pandas.recordFactAssertion({
        assertionId,
        pandaId: panda.pandaId,
        fieldKey: "profile.sex",
        value: options.existingSex,
        certainty: "confirmed",
        lastVerifiedOn: "2026-01-01",
        sourceIds: [secondaryCanonicalSourceId],
      });
      await pandas.setFactConclusion({
        pandaId: panda.pandaId,
        fieldKey: "profile.sex",
        value: options.existingSex,
        status: "confirmed",
        lastVerifiedOn: "2026-01-01",
        assertionIds: [assertionId],
      });
    }

    const contributorToken = await tokenFor(contributor);
    const reviewerToken = await tokenFor(reviewer);

    const submit = await injectHttp(app, {
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

    const open = await injectHttp(app, {
      method: "POST",
      url: "/api/v2/review/cases",
      headers: headers(reviewerToken),
      payload: { submissionId },
    });
    expect(open.statusCode).toBe(201);
    const reviewCaseId = open.json<{ reviewCaseId: string }>().reviewCaseId;

    const reviewQueue = await injectHttp(app, {
      method: "GET",
      url: "/api/v2/review/cases?state=new&limit=25&offset=0",
      headers: headers(reviewerToken),
    });
    expect(reviewQueue.statusCode).toBe(200);
    const reviewQueueBody = reviewQueue.json<{
      total: number;
      limit: number;
      offset: number;
      items: Array<{ reviewCaseId: string; state: string; targetPandaId?: string }>;
    }>();
    expect(reviewQueueBody.limit).toBe(25);
    expect(reviewQueueBody.items.find((item) => item.reviewCaseId === reviewCaseId)).toMatchObject({
      reviewCaseId,
      state: "new",
      targetPandaId: panda.pandaId,
    });

    const reviewSurface = await injectHttp(app, {
      method: "GET",
      url: `/api/v2/review/cases/${reviewCaseId}/surface`,
      headers: headers(reviewerToken),
    });
    expect(reviewSurface.statusCode).toBe(200);
    expect(
      reviewSurface.json<{ contribution: { assertions: Array<{ assertionKey: string; fieldKey: string }> } }>()
        .contribution.assertions,
    ).toEqual([expect.objectContaining({ assertionKey: "sex-correction", fieldKey: "profile.sex" })]);

    const claim = await injectHttp(app, {
      method: "POST",
      url: `/api/v2/review/cases/${reviewCaseId}/claim`,
      headers: headers(reviewerToken),
    });
    expect(claim.statusCode).toBe(200);
    expect(claim.json()).toMatchObject({ state: "assigned", primaryAssigneeId: reviewer.accountId });

    const verify = async (sourceId: string, normalizedLocator: string, canonical: string) =>
      injectHttp(app, {
        method: "POST",
        url: `/api/v2/review/cases/${reviewCaseId}/source-verifications`,
        headers: headers(reviewerToken),
        payload: {
          sourceId,
          outcome: "verified",
          normalizedLocator,
          canonicalSourceId: canonical,
          reason: "Resolved to the canonical Evidence source.",
        },
      });

    const decide = () =>
      injectHttp(app, {
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

    // An accepted assertion needs each of its sources verified to canonical Evidence.
    const unverified = await decide();
    expect(unverified.statusCode).toBe(422);
    expect(unverified.json()).toMatchObject({ code: "review.sourceNotVerified" });

    expect((await verify(submittedSource.source_id, locator, canonicalSourceId)).statusCode).toBe(201);
    expect(
      (await verify(secondarySubmittedSource.source_id, secondaryLocator, secondaryCanonicalSourceId)).statusCode,
    ).toBe(201);

    const decision = await decide();
    expect(decision.statusCode).toBe(200);

    const closedCase = await injectHttp(app, {
      method: "GET",
      url: `/api/v2/review/cases/${reviewCaseId}`,
      headers: headers(reviewerToken),
    });
    expect(closedCase.json()).toMatchObject({ state: "closed" });
    expect((await decide()).statusCode).toBe(404);

    const contribution = await injectHttp(app, {
      method: "GET",
      url: `/api/v2/me/contributions/${submissionId}`,
      headers: headers(contributorToken),
    });
    expect(contribution.statusCode).toBe(200);
    expect(contribution.json()).toMatchObject({
      status: "accepted",
      statusExplanation: "The submitted correction is supported by verified evidence.",
    });

    const conclusions = await database.db
      .selectFrom("panda.fact_conclusions")
      .select(["conclusion_id", "value_json", "is_current", "conclusion_version"])
      .where("panda_id", "=", panda.pandaId)
      .where("field_key", "=", "profile.sex")
      .orderBy("conclusion_version")
      .execute();
    const current = conclusions.find((conclusion) => conclusion.is_current);
    if (current === undefined) throw new Error("The accepted fact has no current conclusion");
    const currentAssertion = await database.db
      .selectFrom("panda.fact_conclusion_assertions")
      .select("assertion_id")
      .where("conclusion_id", "=", current.conclusion_id)
      .executeTakeFirstOrThrow();
    const currentSources = await database.db
      .selectFrom("panda.fact_assertion_sources")
      .select("source_id")
      .where("assertion_id", "=", currentAssertion.assertion_id)
      .execute();
    expect(currentSources.map((source) => source.source_id)).toEqual([canonicalSourceId]);

    return { pandaId: panda.pandaId, conclusions };
  }

  it("writes an accepted contribution's fact as the field's first conclusion in the decision", async () => {
    const { pandaId, conclusions } = await acceptReviewedCorrection({});

    expect(conclusions).toEqual([
      expect.objectContaining({ value_json: "female", is_current: true, conclusion_version: 1 }),
    ]);
    const panda = await app.get<PandaPort>(PANDA_PORT).getPanda(pandaId);
    expect(panda?.conclusions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldKey: "profile.sex", value: "female", status: "confirmed" }),
      ]),
    );
  });

  it("supersedes a field's current conclusion when the decision accepts a correction", async () => {
    const { conclusions } = await acceptReviewedCorrection({ existingSex: "male" });

    expect(conclusions).toEqual([
      expect.objectContaining({ value_json: "male", is_current: false, conclusion_version: 1 }),
      expect.objectContaining({ value_json: "female", is_current: true, conclusion_version: 2 }),
    ]);
  });

  it("lets a suspended member appeal while other account APIs stay blocked, then restores Identity on overturn", async () => {
    const moderatorToken = await tokenFor(moderator);
    const targetToken = await tokenFor(moderationTarget);

    const sanction = await injectHttp(app, {
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

    const blockedProfile = await injectHttp(app, {
      method: "GET",
      url: "/api/v2/me/profile",
      headers: headers(targetToken),
    });
    expect(blockedProfile.statusCode).toBe(403);

    const appeal = await injectHttp(app, {
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

    const appealQueue = await injectHttp(app, {
      method: "GET",
      url: "/api/v2/moderation/appeals?state=open&limit=25&offset=0",
      headers: headers(moderatorToken),
    });
    expect(appealQueue.statusCode).toBe(200);
    const appealQueueBody = appealQueue.json<{
      total: number;
      limit: number;
      offset: number;
      items: Array<{
        appealCaseId: string;
        accountId: string;
        sanctionId: string;
        state: string;
        userStatement: string;
        slaOverdue: boolean;
      }>;
    }>();
    expect(appealQueueBody.total).toBeGreaterThanOrEqual(1);
    expect(appealQueueBody.limit).toBe(25);
    expect(appealQueueBody.offset).toBe(0);
    expect(appealQueueBody.items.find((item) => item.appealCaseId === appealCaseId)).toMatchObject({
      appealCaseId,
      accountId: moderationTarget.accountId,
      sanctionId,
      state: "open",
      userStatement: "I am appealing this suspension and asking for the evidence to be reviewed again.",
      slaOverdue: false,
    });

    const overturn = await injectHttp(app, {
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

    const restoredProfile = await injectHttp(app, {
      method: "GET",
      url: "/api/v2/me/profile",
      headers: headers(targetToken),
    });
    expect(restoredProfile.statusCode).toBe(200);

    const moderationState = await injectHttp(app, {
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
