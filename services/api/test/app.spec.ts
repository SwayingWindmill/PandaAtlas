import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApplication } from "../src/bootstrap.js";

let app: NestFastifyApplication | undefined;

beforeEach(() => {
  process.env.APP_ENV = "test";
  process.env.CORS_ALLOW_ORIGINS = "http://localhost:3000";
  delete process.env.DATABASE_URL;
  delete process.env.SUPABASE_URL;
});

afterEach(async () => {
  if (app !== undefined) {
    await app.close();
    app = undefined;
  }
});

describe("NestJS V2 runtime", () => {
  it("serves version-neutral health and readiness endpoints", async () => {
    app = await createApplication();

    const health = await app.inject({ method: "GET", url: "/health" });
    const ready = await app.inject({ method: "GET", url: "/ready" });

    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: "ok" });
    expect(ready.statusCode).toBe(503);
    expect(ready.json()).toMatchObject({
      status: 503,
      code: "system.dependencyUnavailable",
    });
  });

  it("returns RFC 9457 problem details with the request id", async () => {
    app = await createApplication();

    const response = await app.inject({ method: "GET", url: "/api/v2/missing" });
    const body = response.json<{
      type: string;
      status: number;
      code: string;
      requestId: string;
    }>();

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(body).toMatchObject({
      type: "about:blank",
      status: 404,
      code: "request.notFound",
    });
    expect(response.headers["x-request-id"]).toBe(body.requestId);
  });

});
