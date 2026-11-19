import assert from "node:assert/strict";
import test from "node:test";

import { requiresSupabaseSessionRefresh } from "../../lib/supabase/session-refresh-policy.ts";

test("requiresSupabaseSessionRefresh skips anonymous public pages", () => {
  for (const path of [
    "/",
    "/zh",
    "/en",
    "/zh/pandas",
    "/en/pandas/xi-lun",
    "/zh/institutions/tokyo-ueno-zoo",
    "/en/places/wolong",
    "/zh/families",
    "/en/moments",
    "/zh/games",
    "/zh/search",
    "/en/terms",
    "/zh/privacy",
    "/zh/media-kit",
    "/en/contribution",
    "/api/site-search",
    "/api/site-search/",
    "//api/site-search",
  ]) {
    assert.equal(requiresSupabaseSessionRefresh(path), false, path);
  }
});

test("requiresSupabaseSessionRefresh matches private, auth, admin, and API paths", () => {
  for (const path of [
    "/api",
    "/api/engagement/favorites",
    "/auth",
    "/auth/login",
    "/auth/callback",
    "/admin",
    "/admin/review",
    "/zh/me",
    "/en/me",
    "/zh/me/collections",
    "/en/me/submissions/123",
    "/zh/contribute",
    "/en/contribute",
    "/en/contribute/draft",
  ]) {
    assert.equal(requiresSupabaseSessionRefresh(path), true, path);
  }
});
