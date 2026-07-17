import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);

async function exists(path) {
  try {
    await access(new URL(path, root));
    return true;
  } catch {
    return false;
  }
}

test("localized Atlas discovery is server-owned and legacy client filtering is removed", async () => {
  const page = await readFile(new URL("apps/web/app/[locale]/atlas/page.tsx", root), "utf8");
  const query = await readFile(new URL("apps/web/features/atlas/atlas-query.ts", root), "utf8");
  const search = await readFile(new URL("apps/web/features/atlas/atlas-search.ts", root), "utf8");

  assert.match(page, /parseAtlasQuery/);
  assert.match(page, /buildAtlasSearchViewModel/);
  assert.match(page, /loadPublishedAtlasDataset/);
  assert.doesNotMatch(page, /["']use client["']/);
  assert.doesNotMatch(page, /api-client|atlas-presenters|popularity|featured/i);

  for (const parameter of ["q", "status", "sex", "facility", "completeness", "sort", "page"]) {
    assert.match(query, new RegExp(`\\b${parameter}\\b`));
  }
  assert.match(query, /needsNormalization/);
  assert.match(search, /ATLAS_PAGE_SIZE/);
  assert.doesNotMatch(search, /popularity|featured/i);

  for (const removedPath of [
    "apps/web/components/atlas/atlas-browser.tsx",
    "apps/web/components/atlas/atlas-filters.tsx",
    "apps/web/components/atlas/atlas-search.tsx",
    "apps/web/components/atlas/panda-card.tsx",
    "apps/web/lib/atlas-presenters.ts",
  ]) {
    assert.equal(await exists(removedPath), false, `${removedPath} must remain deleted`);
  }
});
