import type { NestExpressApplication } from "@nestjs/platform-express";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { sql } from "kysely";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "../../src/bootstrap.js";
import { EVIDENCE_PORT, type EvidencePort } from "../../src/modules/evidence/application/evidence.application.js";
import { LIFE_HISTORY_PORT, type LifeHistoryPort } from "../../src/modules/life-history/application/life-history.application.js";
import { PANDA_PORT, type PandaPort } from "../../src/modules/panda/application/panda.application.js";
import { PLACES_PORT, type PlacesPort } from "../../src/modules/places/application/places.application.js";
import { PUBLICATION_PORT, type PublicationPort } from "../../src/modules/publication/application/publication.application.js";
import { DatabaseService } from "../../src/platform/database/database.service.js";
import { injectHttp } from "../inject-http.js";

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const REVIEWER_ID = "85555555-5555-4555-8555-555555555555";
const SESSION_ID = "86666666-6666-4666-8666-666666666666";
const INGEST_TOKEN = "integration-news-ingest-secret-token";

let app: NestExpressApplication;
let jwksServer: Server;
let reviewerToken: string;
let pandaSlug: string;
let instSlug: string;
let destInstSlug: string;
let suffix: string;

beforeAll(async () => {
  const keyPair = await generateKeyPair("ES256");
  const jwk = await exportJWK(keyPair.publicKey);
  Object.assign(jwk, { kid: "news-http", alg: "ES256", use: "sig" });

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
  process.env.APP_ENV = "test";
  process.env.CORS_ALLOW_ORIGINS = "http://localhost:3000";
  process.env.DATABASE_URL = DATABASE_URL;
  process.env.SUPABASE_URL = supabaseUrl;
  process.env.NEWS_INGEST_TOKEN = INGEST_TOKEN;
  process.env.NEWS_AUTO_PUBLISH_TIERS = "institution,official";

  app = await createApplication();
  const database = app.get(DatabaseService);
  const evidence = app.get<EvidencePort>(EVIDENCE_PORT);
  const places = app.get<PlacesPort>(PLACES_PORT);
  const pandas = app.get<PandaPort>(PANDA_PORT);
  const lifeHistory = app.get<LifeHistoryPort>(LIFE_HISTORY_PORT);
  const publication = app.get<PublicationPort>(PUBLICATION_PORT);

  await sql`
    insert into auth.users (id, aud, role, created_at, updated_at)
    values (${REVIEWER_ID}::uuid, 'authenticated', 'authenticated', now(), now())
    on conflict (id) do nothing
  `.execute(database.db);
  await sql`
    insert into auth.sessions (id, user_id, created_at, updated_at, aal)
    values (${SESSION_ID}::uuid, ${REVIEWER_ID}::uuid, now(), now(), 'aal1')
    on conflict (id) do update set user_id = excluded.user_id, aal = excluded.aal
  `.execute(database.db);
  await database.db
    .insertInto("identity.accounts")
    .values({ account_id: REVIEWER_ID, email: null })
    .onConflict((conflict) => conflict.column("account_id").doNothing())
    .execute();
  await database.db
    .insertInto("identity.role_assignments")
    .values({
      account_id: REVIEWER_ID,
      role_key: "reviewer",
      assigned_by_account_id: null,
      reason: "News HTTP integration test reviewer",
      source: "integration_test",
      correlation_id: randomUUID(),
      idempotency_key: `news-reviewer:${REVIEWER_ID}`,
    })
    .onConflict((conflict) => conflict.columns(["account_id", "idempotency_key"]).doNothing())
    .execute();

  const now = Math.floor(Date.now() / 1_000);
  reviewerToken = await new SignJWT({
    role: "authenticated",
    aal: "aal1",
    session_id: SESSION_ID,
    is_anonymous: false,
    amr: [{ method: "password", timestamp: now - 10 }],
  })
    .setProtectedHeader({ alg: "ES256", kid: "news-http" })
    .setIssuer(`${supabaseUrl}/auth/v1`)
    .setAudience("authenticated")
    .setSubject(REVIEWER_ID)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(keyPair.privateKey);

  suffix = randomUUID().slice(0, 8);
  const sourceId = `news-integration:${suffix}`;
  await evidence.createSource({
    sourceId,
    publisher: "News Integration Source",
    title: "News integration fixture",
    url: `https://example.test/news/${suffix}`,
    publishedOn: "2026-11-28",
    lastVerifiedOn: "2026-11-28",
    languageTag: "zh",
    accessState: "accessible",
    evidenceTier: "institutional",
  });

  instSlug = `news-base-${suffix}`;
  destInstSlug = `news-zoo-${suffix}`;
  const inst = await places.createInstitution({
    slug: instSlug,
    nameZh: `测试基地${suffix}`,
    countryCode: "CN",
  });
  await places.createInstitution({
    slug: destInstSlug,
    nameZh: `测试动物园${suffix}`,
    countryCode: "CN",
  });
  const place = await places.createPlace({
    institutionId: inst.institutionId,
    slug: `news-place-${suffix}`,
    placeType: "facility",
    nameZh: `测试园区${suffix}`,
    countryCode: "CN",
  });

  pandaSlug = `news-bear-${suffix}`;
  const panda = await pandas.createPanda({
    canonicalSlug: pandaSlug,
    primaryName: {
      languageTag: "zh-CN",
      value: `测试熊${suffix}`,
      sourceIds: [sourceId],
    },
  });
  await lifeHistory.createResidency({
    residencyId: randomUUID(),
    pandaId: panda.pandaId,
    placeId: place.placeId,
    residencyType: "primary",
    startOn: "2024-01-01",
    startPrecision: "day",
    status: "confirmed",
    sourceIds: [sourceId],
  });

  const ctx = { actor: { kind: "system" as const, systemKey: "news-integration" }, correlationId: randomUUID() };
  const release = await publication.build(`news-integration-${suffix}`, ctx);
  await publication.seal(release.releaseId, ctx, "News integration release.");
  await publication.activate(release.releaseId, ctx, "News integration release.");
});

afterAll(async () => {
  await app.close();
  await new Promise<void>((resolve, reject) =>
    jwksServer.close((error) => (error === undefined ? resolve() : reject(error))),
  );
});

describe("V2 News ingest, moderation queue, venue merge, and outbox integration", () => {
  it("runs Option B ingest -> public read + venue merge + outbox events -> staff moderation", async () => {
    const database = app.get(DatabaseService);
    const badAuth = await injectHttp(app, {
      method: "POST",
      url: "/api/v2/news/ingest",
      headers: { authorization: "Bearer wrong-token" },
      payload: { items: [] },
    });
    expect(badAuth.statusCode).toBe(401);

    const t1ExternalId = `weibo:t1-${suffix}`;
    const t2ExternalId = `douban:fan-${suffix}`;
    const ingestPayload = {
      items: [
        {
          externalId: t1ExternalId,
          platform: "weibo",
          sourceTier: "institution",
          authorInstitutionSlug: instSlug,
          sourceUrl: `https://weibo.com/1798176285/notice-${suffix}`,
          sourcePublisher: `测试基地${suffix}`,
          publishedAt: "2026-11-28T08:30:00+08:00",
          kind: "transfer",
          scope: "single",
          titleZh: `测试熊${suffix}近期将赴测试动物园`,
          summaryZh: `测试基地${suffix}官方公告显示，测试熊${suffix}将转运。`,
          pandaNames: [`测试熊${suffix}`],
          institutionName: `测试基地${suffix}`,
          coverUrl: `https://cdn.example.test/t1-${suffix}.jpg`,
          factChange: {
            kind: "transfer",
            phase: "announced",
            date: "2026-11-28",
            toPlace: `测试动物园${suffix}`,
          },
          evidenceQuote: "将于近期赴测试动物园交流。",
        },
        {
          externalId: t2ExternalId,
          platform: "douban",
          sourceTier: "fan",
          sourceUrl: `https://www.douban.com/group/topic/99${suffix.replace(/[^0-9]/g, "").slice(0, 6) || "123"}/`,
          sourcePublisher: "豆瓣公开小组(745379)",
          publishedAt: "2026-11-28T09:00:00+08:00",
          kind: "event",
          scope: "single",
          titleZh: `粉丝记录测试熊${suffix}今天啃竹笋`,
          summaryZh: "豆瓣公开小组文字讨论。",
          pandaNames: [`测试熊${suffix}`],
          coverUrl: "https://fan.example.test/must-be-stripped.jpg",
        },
      ],
    };

    const ingestRes = await injectHttp(app, {
      method: "POST",
      url: "/api/v2/news/ingest",
      headers: { authorization: `Bearer ${INGEST_TOKEN}` },
      payload: ingestPayload,
    });
    expect(ingestRes.statusCode).toBe(200);
    expect(ingestRes.json()).toEqual({
      accepted: 2,
      published: 1,
      pendingReview: 1,
      factCandidatesCreated: 1,
    });

    // Re-ingesting the exact same payload must stay idempotent.
    const repeatRes = await injectHttp(app, {
      method: "POST",
      url: "/api/v2/news/ingest",
      headers: { authorization: `Bearer ${INGEST_TOKEN}` },
      payload: ingestPayload,
    });
    expect(repeatRes.statusCode).toBe(200);
    expect(repeatRes.json()).toMatchObject({ accepted: 2, published: 0, pendingReview: 0, factCandidatesCreated: 0 });

    const publicNews = await injectHttp(app, {
      method: "GET",
      url: `/api/v2/news?panda=${pandaSlug}`,
    });
    expect(publicNews.statusCode).toBe(200);
    const newsBody = publicNews.json<{ items: Array<{ newsItemId: string; titleZh: string; coverUrl?: string }> }>();
    expect(newsBody.items).toHaveLength(1);
    const t1ItemId = newsBody.items[0]!.newsItemId;
    expect(newsBody.items[0]!.coverUrl).toBe(`https://cdn.example.test/t1-${suffix}.jpg`);

    // Official T1 item must automatically surface in GET /api/v2/venue-news too.
    const venueNews = await injectHttp(app, {
      method: "GET",
      url: `/api/v2/venue-news?institution=${instSlug}`,
    });
    expect(venueNews.statusCode).toBe(200);
    expect(venueNews.json<{ items: Array<{ sourceUrl: string }> }>().items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceUrl: `https://weibo.com/1798176285/notice-${suffix}` }),
      ]),
    );

    // Outbox should have exactly 1 panda_item.published and 1 venue_item.published for T1 item.
    const outboxEvents = await database.db
      .selectFrom("integration.outbox_events")
      .select(["event_type", "idempotency_key"])
      .where("aggregate_id", "=", t1ItemId)
      .execute();
    expect(outboxEvents.map((e) => e.event_type).sort()).toEqual([
      "news.panda_item.published",
      "news.venue_item.published",
    ]);

    // T2 fan item is pending_review; staff reviewer approves & publishes it, and coverUrl remains stripped.
    const pendingRes = await injectHttp(app, {
      method: "GET",
      url: "/api/v2/news/review/items?status=pending_review",
      headers: { authorization: `Bearer ${reviewerToken}` },
    });
    expect(pendingRes.statusCode).toBe(200);
    const pendingFan = pendingRes
      .json<Array<{ newsItemId: string; externalId: string; coverUrl?: string }>>()
      .find((entry) => entry.externalId === t2ExternalId);
    expect(pendingFan).toBeDefined();
    expect(pendingFan?.coverUrl).toBeUndefined();

    const approveItemRes = await injectHttp(app, {
      method: "POST",
      url: `/api/v2/news/review/items/${pendingFan!.newsItemId}/decision`,
      headers: { authorization: `Bearer ${reviewerToken}` },
      payload: { decision: "publish", reviewNote: "核实属于公开有效讨论" },
    });
    expect(approveItemRes.statusCode).toBe(200);

    // Fact candidate created by T1 notice stays locked in pending_review until human decides.
    const factsRes = await injectHttp(app, {
      method: "GET",
      url: "/api/v2/news/review/fact-candidates?reviewState=pending_review",
      headers: { authorization: `Bearer ${reviewerToken}` },
    });
    expect(factsRes.statusCode).toBe(200);
    const candidate = factsRes
      .json<Array<{ candidateId: string; newsItemId: string; gateStatus: string; reviewState: string }>>()
      .find((entry) => entry.newsItemId === t1ItemId);
    expect(candidate).toMatchObject({
      gateStatus: "eligible_institution_source",
      reviewState: "pending_review",
    });

    const decideFactRes = await injectHttp(app, {
      method: "POST",
      url: `/api/v2/news/review/fact-candidates/${candidate!.candidateId}/decision`,
      headers: { authorization: `Bearer ${reviewerToken}` },
      payload: { decision: "approved", reviewNote: "人工复核确认" },
    });
    expect(decideFactRes.statusCode).toBe(200);
    expect(decideFactRes.json()).toMatchObject({ reviewState: "approved" });

    // Hiding T1 item removes it from public news and survives re-ingest.
    const hideRes = await injectHttp(app, {
      method: "POST",
      url: `/api/v2/news/review/items/${t1ItemId}/decision`,
      headers: { authorization: `Bearer ${reviewerToken}` },
      payload: { decision: "hide", reviewNote: "演练隐藏防复活" },
    });
    expect(hideRes.statusCode).toBe(200);

    await injectHttp(app, {
      method: "POST",
      url: "/api/v2/news/ingest",
      headers: { authorization: `Bearer ${INGEST_TOKEN}` },
      payload: { items: [ingestPayload.items[0]] },
    });
    const afterHide = await injectHttp(app, {
      method: "GET",
      url: `/api/v2/news?panda=${pandaSlug}`,
    });
    expect(afterHide.json<{ items: Array<{ newsItemId: string }> }>().items.map((item) => item.newsItemId)).toEqual([
      pendingFan!.newsItemId,
    ]);
  });
});
