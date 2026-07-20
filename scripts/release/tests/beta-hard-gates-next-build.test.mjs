import assert from "node:assert/strict";
import test from "node:test";

import { classifyGeneratedWebArtifact } from "../check-beta-hard-gates.mjs";

test("classifies default and alternate Next server bundles as generated-only", () => {
  for (const relative of [
    "apps/web/.next/server/app/api/admin/import-jobs/route.js",
    "apps/web/.next-production-smoke/server/app/api/admin/import-jobs/route.js",
  ]) {
    assert.deepEqual(classifyGeneratedWebArtifact(relative), {
      isGenerated: true,
      isBrowserBuild: false,
    });
  }
});

test("classifies alternate Next browser artifacts as browser-exposed", () => {
  for (const relative of [
    "apps/web/.next-production-smoke/static/chunks/app.js",
    "apps/web/.next-production-smoke/server/app/page.rsc",
    "apps/web/.next-production-smoke/server/app/page.html",
  ]) {
    assert.deepEqual(classifyGeneratedWebArtifact(relative), {
      isGenerated: true,
      isBrowserBuild: true,
    });
  }
});

test("classifies OpenNext server and browser outputs separately", () => {
  assert.deepEqual(
    classifyGeneratedWebArtifact(
      "apps/web/.open-next/server-functions/default/apps/web/.next/server/app/api/admin/import-jobs/route.js",
    ),
    { isGenerated: true, isBrowserBuild: false },
  );
  for (const relative of [
    "apps/web/.open-next/assets/_next/static/chunks/app.js",
    "apps/web/.open-next/server-functions/default/apps/web/.next/server/app/page.rsc",
  ]) {
    assert.deepEqual(classifyGeneratedWebArtifact(relative), {
      isGenerated: true,
      isBrowserBuild: true,
    });
  }
});

test("does not classify source files as generated artifacts", () => {
  assert.deepEqual(classifyGeneratedWebArtifact("apps/web/app/page.tsx"), {
    isGenerated: false,
    isBrowserBuild: false,
  });
});
