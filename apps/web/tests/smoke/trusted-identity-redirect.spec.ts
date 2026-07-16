import { expect, test } from "@playwright/test";

test("legacy panda slugs permanently redirect to the canonical profile", async ({ request }) => {
  const response = await request.get("/atlas/meixiang", { maxRedirects: 0 });

  expect(response.status()).toBe(308);
  const location = new URL(response.headers().location, "http://localhost");
  expect(location.pathname).toBe("/zh/atlas/mei-xiang");
  expect(location.search).toBe("");

  const canonicalResponse = await request.get("/zh/atlas/mei-xiang");
  expect(canonicalResponse.status()).toBe(200);
  expect(await canonicalResponse.text()).toContain("美香");
});
