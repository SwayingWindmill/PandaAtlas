import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { sql } from "kysely";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "../../src/bootstrap.js";
import { EVIDENCE_PORT, type EvidencePort } from "../../src/modules/evidence/application/evidence.application.js";
import { MEDIA_PORT, type MediaPort } from "../../src/modules/media/application/media.application.js";
import { PANDA_PORT, type PandaPort } from "../../src/modules/panda/application/panda.application.js";
import { PLACES_PORT, type PlacesPort } from "../../src/modules/places/application/places.application.js";
import { DatabaseService } from "../../src/platform/database/database.service.js";

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const ACCOUNT_ID = "75555555-5555-4555-8555-555555555555";
const SESSION_ID = "76666666-6666-4666-8666-666666666666";

let app: NestFastifyApplication;
let jwksServer: Server;
let token: string;
let questionId: string;
let answerPandaId: string;
let placeId: string;

function responseBody<T>(response: { body: string }): T {
  return JSON.parse(response.body) as T;
}

beforeAll(async () => {
  const keyPair = await generateKeyPair("ES256");
  const jwk = await exportJWK(keyPair.publicKey);
  Object.assign(jwk, { kid: "fan-http", alg: "ES256", use: "sig" });

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

  app = await createApplication();
  const database = app.get(DatabaseService);
  const evidence = app.get<EvidencePort>(EVIDENCE_PORT);
  const pandas = app.get<PandaPort>(PANDA_PORT);
  const places = app.get<PlacesPort>(PLACES_PORT);
  const media = app.get<MediaPort>(MEDIA_PORT);

  await sql`
    insert into auth.users (id, aud, role, created_at, updated_at)
    values (${ACCOUNT_ID}::uuid, 'authenticated', 'authenticated', now(), now())
    on conflict (id) do nothing
  `.execute(database.db);
  await sql`
    insert into auth.sessions (id, user_id, created_at, updated_at, aal)
    values (${SESSION_ID}::uuid, ${ACCOUNT_ID}::uuid, now(), now(), 'aal1')
    on conflict (id) do update set user_id = excluded.user_id, aal = excluded.aal
  `.execute(database.db);

  const now = Math.floor(Date.now() / 1_000);
  token = await new SignJWT({
    role: "authenticated",
    aal: "aal1",
    session_id: SESSION_ID,
    is_anonymous: false,
    amr: [{ method: "password", timestamp: now - 10 }],
  })
    .setProtectedHeader({ alg: "ES256", kid: "fan-http" })
    .setIssuer(`${supabaseUrl}/auth/v1`)
    .setAudience("authenticated")
    .setSubject(ACCOUNT_ID)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(keyPair.privateKey);

  const suffix = randomUUID();
  const sourceId = `fan-integration:${suffix}`;
  await evidence.createSource({
    sourceId,
    publisher: "Fan Integration Fixture",
    title: "Fan integration fixture",
    url: `https://example.test/fan/${suffix}`,
    publishedOn: "2026-08-26",
    lastVerifiedOn: "2026-08-26",
    languageTag: "en",
    accessState: "accessible",
    evidenceTier: "institutional",
  });

  const pandaRecords = [];
  for (const index of [1, 2, 3, 4]) {
    pandaRecords.push(
      await pandas.createPanda({
        canonicalSlug: `fan-game-${index}-${suffix}`,
        primaryName: {
          languageTag: "en",
          value: `Fan Game Panda ${index} ${suffix}`,
          sourceIds: [sourceId],
        },
      }),
    );
  }
  answerPandaId = pandaRecords[0]!.pandaId;

  const place = await places.createPlace({
    slug: `fan-place-${suffix}`,
    placeType: "facility",
    nameEn: `Fan Place ${suffix}`,
    countryCode: "CN",
  });
  placeId = place.placeId;

  const asset = await media.createAsset({
    sourceId,
    storageBucket: "panda-media",
    storageKey: `fan/${suffix}.jpg`,
    contentSha256: "e".repeat(64),
    mediaType: "image/jpeg",
    byteSize: 1024,
    rightsStatus: "cleared",
    eligibilityStatus: "eligible",
    metadata: { purpose: "fan-integration" },
  });

  const question = await database.db
    .insertInto("game.questions")
    .values({
      target_panda_id: answerPandaId,
      media_asset_id: asset.assetId,
      difficulty: "easy",
      option_panda_ids: pandaRecords.map((panda) => panda.pandaId),
      recognition_tips: JSON.stringify(["integration tip"]),
      state: "published",
      published_at: new Date(),
    })
    .returning("question_id")
    .executeTakeFirstOrThrow();
  questionId = question.question_id;
});

afterAll(async () => {
  await app.close();
  await new Promise<void>((resolve, reject) =>
    jwksServer.close((error) => (error === undefined ? resolve() : reject(error))),
  );
});

describe("V2 fan identity, engagement, and games", () => {
  it("persists one signed-in fan journey through real ES256/JWKS HTTP and PostgreSQL", async () => {
    const headers = { authorization: `Bearer ${token}` };
    const provision = await app.inject({ method: "POST", url: "/api/v2/me/account", headers });
    expect(provision.statusCode).toBe(201);
    const provisionBody = responseBody<{ capabilities: string[] }>(provision);
    expect(provisionBody.capabilities).toEqual(
      expect.arrayContaining([
        "account.profile.read",
        "account.profile.manage",
        "engagement.read",
        "engagement.manage",
        "game.attempt.read",
        "game.attempt.manage",
      ]),
    );

    const updateProfile = await app.inject({
      method: "PUT",
      url: "/api/v2/me/profile",
      headers,
      payload: { nickname: "  Panda   Fan  ", bio: " Loves   panda history " },
    });
    expect(updateProfile.statusCode).toBe(200);
    expect(updateProfile.json()).toMatchObject({ nickname: "Panda Fan", bio: "Loves panda history" });

    const favorite = await app.inject({ method: "POST", url: `/api/v2/me/favorites/${answerPandaId}`, headers });
    expect(favorite.statusCode).toBe(201);

    const createCollection = await app.inject({
      method: "POST",
      url: "/api/v2/me/collections",
      headers,
      payload: { name: `My pandas ${questionId.slice(0, 8)}` },
    });
    expect(createCollection.statusCode).toBe(201);
    const collectionId = responseBody<{ collectionId: string }>(createCollection).collectionId;
    const addToCollection = await app.inject({
      method: "POST",
      url: `/api/v2/me/collections/${collectionId}/pandas/${answerPandaId}`,
      headers,
    });
    expect(addToCollection.statusCode).toBe(201);
    expect(responseBody<{ pandaIds: string[] }>(addToCollection).pandaIds).toContain(answerPandaId);

    const checkin = await app.inject({
      method: "POST",
      url: "/api/v2/me/checkins",
      headers,
      payload: { placeId, visitedOn: "2026-08-26", note: "Saw the habitat" },
    });
    expect(checkin.statusCode).toBe(201);

    const seen = await app.inject({
      method: "PUT",
      url: `/api/v2/me/seen-pandas/${answerPandaId}`,
      headers,
      payload: { placeId, seenOn: "2026-08-26", note: "Seen in person" },
    });
    expect(seen.statusCode).toBe(200);
    expect(seen.json()).toMatchObject({ pandaId: answerPandaId, placeId, seenOn: "2026-08-26" });

    const attempt = await app.inject({
      method: "POST",
      url: "/api/v2/me/game-attempts",
      headers,
      payload: { questionId, selectedPandaId: answerPandaId },
    });
    expect(attempt.statusCode).toBe(201);
    expect(attempt.json()).toMatchObject({
      attempt: { questionId, selectedPandaId: answerPandaId, correct: true },
      answer: { correct: true, answerPandaId },
    });

    const profile = await app.inject({ method: "GET", url: "/api/v2/me/profile", headers });
    const favorites = await app.inject({ method: "GET", url: "/api/v2/me/favorites", headers });
    const collections = await app.inject({ method: "GET", url: "/api/v2/me/collections", headers });
    const checkins = await app.inject({ method: "GET", url: "/api/v2/me/checkins", headers });
    const seenPandas = await app.inject({ method: "GET", url: "/api/v2/me/seen-pandas", headers });
    const attempts = await app.inject({ method: "GET", url: "/api/v2/me/game-attempts", headers });

    const profileBody = responseBody<{ nickname: string }>(profile);
    const favoritesBody = responseBody<{ items: Array<{ pandaId: string }> }>(favorites);
    const collectionsBody = responseBody<{ items: Array<{ collectionId: string }> }>(collections);
    const checkinsBody = responseBody<{ items: Array<{ placeId: string }> }>(checkins);
    const seenPandasBody = responseBody<{ items: Array<{ pandaId: string }> }>(seenPandas);
    const attemptsBody = responseBody<{ items: Array<{ questionId: string }> }>(attempts);
    expect(profileBody.nickname).toBe("Panda Fan");
    expect(favoritesBody.items.some((item) => item.pandaId === answerPandaId)).toBe(true);
    expect(collectionsBody.items.some((item) => item.collectionId === collectionId)).toBe(true);
    expect(checkinsBody.items.some((item) => item.placeId === placeId)).toBe(true);
    expect(seenPandasBody.items.some((item) => item.pandaId === answerPandaId)).toBe(true);
    expect(attemptsBody.items.some((item) => item.questionId === questionId)).toBe(true);
  });

  it("serves anonymous Random Panda and Guess without persisting an attempt", async () => {
    const database = app.get(DatabaseService);
    const before = await database.db
      .selectFrom("game.attempts")
      .select((expression) => expression.fn.countAll<number>().as("count"))
      .where("account_id", "=", ACCOUNT_ID)
      .executeTakeFirstOrThrow();

    const randomPanda = await app.inject({ method: "GET", url: "/api/v2/games/random-panda" });
    expect(randomPanda.statusCode).toBe(200);
    expect(responseBody<{ pandaId: string }>(randomPanda).pandaId).toEqual(expect.any(String));

    const question = await app.inject({ method: "GET", url: "/api/v2/games/guess/question?difficulty=easy" });
    expect(question.statusCode).toBe(200);
    const questionBody = responseBody<{
      questionId: string;
      difficulty: string;
      optionPandaIds: string[];
    }>(question);
    expect(questionBody.difficulty).toBe("easy");
    expect(questionBody.optionPandaIds).toHaveLength(4);
    expect(questionBody).not.toHaveProperty("targetPandaId");

    const answer = await app.inject({
      method: "POST",
      url: "/api/v2/games/guess/answer",
      payload: { questionId: questionBody.questionId, selectedPandaId: questionBody.optionPandaIds[0] },
    });
    expect(answer.statusCode).toBe(200);
    const answerBody = responseBody<{ correct: boolean; answerPandaId: string }>(answer);
    expect(typeof answerBody.correct).toBe("boolean");
    expect(answerBody.answerPandaId).toEqual(expect.any(String));

    const after = await database.db
      .selectFrom("game.attempts")
      .select((expression) => expression.fn.countAll<number>().as("count"))
      .where("account_id", "=", ACCOUNT_ID)
      .executeTakeFirstOrThrow();
    expect(Number(after.count)).toBe(Number(before.count));
  });
});
