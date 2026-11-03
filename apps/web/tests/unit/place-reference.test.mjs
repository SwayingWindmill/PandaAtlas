import assert from "node:assert/strict";
import test from "node:test";

import { findPlaceByReference } from "../../features/public-content/place-reference.ts";

const places = [
  { placeId: "p-bifengxia", slug: "ccrcgp-bifengxia-base", legacySlugs: ["ccrcgp-yaan-base"] },
  { placeId: "p-shenshuping", slug: "ccrcgp-wolong-shenshuping-base", legacySlugs: ["ccrcgp-wolong-gengda-base"] },
  { placeId: "p-ueno", slug: "ueno-zoo" },
];

test("a place is found by id or by its current slug", () => {
  assert.equal(findPlaceByReference(places, "p-ueno")?.slug, "ueno-zoo");
  assert.equal(findPlaceByReference(places, " ueno-zoo ")?.placeId, "p-ueno");
});

test("a merged duplicate's old slug finds the place it was merged into", () => {
  assert.equal(findPlaceByReference(places, "ccrcgp-yaan-base")?.slug, "ccrcgp-bifengxia-base");
  assert.equal(findPlaceByReference(places, "ccrcgp-wolong-gengda-base")?.slug, "ccrcgp-wolong-shenshuping-base");
});

test("a current slug wins over another place's former slug, and unknown references find nothing", () => {
  const clash = [{ placeId: "a", slug: "old", legacySlugs: [] }, { placeId: "b", slug: "new", legacySlugs: ["old"] }];
  assert.equal(findPlaceByReference([...clash].reverse(), "old")?.placeId, "a");
  assert.equal(findPlaceByReference(places, "missing-zoo"), undefined);
});
