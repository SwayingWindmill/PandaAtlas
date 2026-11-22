import assert from "node:assert/strict";
import { test } from "node:test";

import {
  enforceOtpRateLimit,
  extractClientIp,
  hashEmailForRateLimit,
  otpRateLimitedResponse,
} from "../../lib/server/otp-rate-limit.ts";

test("extractClientIp reads cf-connecting-ip when present", () => {
  assert.equal(extractClientIp(new Headers({ "cf-connecting-ip": " 198.51.100.8 " })), "198.51.100.8");
  assert.equal(extractClientIp(new Headers()), undefined);
});

test("hashEmailForRateLimit normalizes case/whitespace without leaking the raw email", async () => {
  const a = await hashEmailForRateLimit("  Fan@Example.COM ");
  const b = await hashEmailForRateLimit("fan@example.com");
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{32}$/u);
  assert.ok(!a.includes("fan"));
});

test("enforceOtpRateLimit allows requests when no Worker binding is present", async () => {
  const allowed = await enforceOtpRateLimit({
    limiter: undefined,
    ip: "198.51.100.8",
    email: "fan@example.com",
  });
  assert.equal(allowed, true);
});

test("enforceOtpRateLimit checks both IP and hashed email and stops when either exceeds the limit", async () => {
  const keys = [];
  const allowed = await enforceOtpRateLimit({
    limiter: {
      limit: async ({ key }) => {
        keys.push(key);
        return { success: true };
      },
    },
    ip: "198.51.100.8",
    email: "fan@example.com",
  });
  assert.equal(allowed, true);
  assert.equal(keys.length, 2);
  assert.equal(keys[0], "otp:ip:198.51.100.8");
  assert.match(keys[1], /^otp:email:[0-9a-f]{32}$/u);

  const deniedByIp = await enforceOtpRateLimit({
    limiter: {
      limit: async ({ key }) => ({ success: !key.startsWith("otp:ip:") }),
    },
    ip: "198.51.100.8",
    email: "fan@example.com",
  });
  assert.equal(deniedByIp, false);

  const deniedByEmail = await enforceOtpRateLimit({
    limiter: {
      limit: async ({ key }) => ({ success: !key.startsWith("otp:email:") }),
    },
    ip: undefined,
    email: "fan@example.com",
  });
  assert.equal(deniedByEmail, false);
});

test("enforceOtpRateLimit fails open if the rate-limit binding throws unexpectedly", async () => {
  const allowed = await enforceOtpRateLimit({
    limiter: {
      limit: async () => {
        throw new Error("binding offline");
      },
    },
    ip: "198.51.100.8",
    email: "fan@example.com",
  });
  assert.equal(allowed, true);
});

test("otpRateLimitedResponse returns 429 with Retry-After and private no-store cache headers", async () => {
  const response = otpRateLimitedResponse(60);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "60");
  assert.equal(response.headers.get("cache-control"), "no-store, private");
  assert.deepEqual(await response.json(), { detail: "请求过于频繁，请一分钟后再试。" });
});
