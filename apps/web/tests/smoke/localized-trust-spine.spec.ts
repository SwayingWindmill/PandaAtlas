import { expect, test } from "@playwright/test";

test("uses the same reviewed identity release in English", async ({ page }) => {
  await page.goto("/en/pandas?q=Mei%20Xiang");

  await expect(page.getByRole("heading", { level: 1, name: "Panda guide | ZhiPanda" })).toBeVisible();
  await expect(page.getByTestId("atlas-result-summary")).toContainText("1 pandas found");
  await expect(page.getByRole("link", { name: /Mei Xiang.*缇庨/ })).toHaveAttribute(
    "href",
    "/en/pandas/mei-xiang",
  );
  await expect(page.getByText("He Hua")).toHaveCount(0);
});

test("resolves unprefixed routes from the request language and preserves task state", async ({ request }) => {
  const root = await request.get("/", {
    headers: { "accept-language": "en-US,en;q=0.9,zh;q=0.5" },
    maxRedirects: 0,
  });
  expect(root.status()).toBe(308);
  expect(root.headers().location).toContain("/en");

  const atlas = await request.get("/atlas?q=%E7%BE%8E%E9%A6%99", {
    headers: { "accept-language": "en-US,en;q=0.9" },
    maxRedirects: 0,
  });
  expect(atlas.status()).toBe(308);
  expect(atlas.headers().location).toContain("/en/pandas?q=%E7%BE%8E%E9%A6%99");

  const profile = await request.get("/atlas/meixiang?from=legacy", {
    headers: { "accept-language": "en-US,en;q=0.9" },
    maxRedirects: 0,
  });
  expect(profile.status()).toBe(308);
  expect(profile.headers().location).toContain("/en/pandas/mei-xiang?from=legacy");
});

test("never renders the generated legacy profile as a rollback", async ({ request }) => {
  const untrustedLegacy = await request.get("/atlas/he-hua", { maxRedirects: 0 });
  expect(untrustedLegacy.status()).toBe(404);

  if (process.platform === "win32" && process.env.PLAYWRIGHT_BASE_URL) {
    const malformedLegacy = await fetch(new URL("/atlas/%E0%A4%A", process.env.PLAYWRIGHT_BASE_URL), {
      redirect: "manual",
    });
    expect(malformedLegacy.status).not.toBe(500);
  } else {
    const malformedLegacy = await request.get("/atlas/%E0%A4%A", { maxRedirects: 0 });
    expect(malformedLegacy.status()).not.toBe(500);
  }

  const reviewedLegacy = await request.get("/atlas/meixiang", { maxRedirects: 0 });
  expect(reviewedLegacy.status()).toBe(308);
  expect(reviewedLegacy.headers().location).toContain("/zh/pandas/mei-xiang");

  const localizedLegacy = await request.get("/en/pandas/meixiang?from=old-link", { maxRedirects: 0 });
  expect(localizedLegacy.status()).toBe(308);
  expect(localizedLegacy.headers().location).toContain("/en/pandas/mei-xiang?from=old-link");
});
