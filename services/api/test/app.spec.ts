import type { NestExpressApplication } from "@nestjs/platform-express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApplication } from "../src/bootstrap.js";
import { injectHttp } from "./inject-http.js";

let app: NestExpressApplication | undefined;

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

    const health = await injectHttp(app, { method: "GET", url: "/health" });
    const ready = await injectHttp(app, { method: "GET", url: "/ready" });

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

    const response = await injectHttp(app, { method: "GET", url: "/api/v2/missing" });
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

  it("exposes no HTTP trigger for async jobs; the Worker Cron Trigger runs them", async () => {
    app = await createApplication();

    const internal = await injectHttp(app, { method: "GET", url: "/internal/jobs/async-downstream" });
    const publicPrefix = await injectHttp(app, { method: "GET", url: "/api/v2/internal/jobs/async-downstream" });

    expect(internal.statusCode).toBe(404);
    expect(publicPrefix.statusCode).toBe(404);
  });
});
