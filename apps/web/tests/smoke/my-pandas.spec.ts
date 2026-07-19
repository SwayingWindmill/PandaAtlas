import { expect, test } from "@playwright/test";

const PREFERENCES_KEY = "panda-atlas:profile-preferences";
const LEGACY_KEY = "panda-atlas:saved-profiles";

async function clearLocalProfileData(page: import("@playwright/test").Page) {
  await page.goto("/en");
  await page.evaluate(({ preferencesKey, legacyKey }) => {
    localStorage.removeItem(preferencesKey);
    localStorage.removeItem(legacyKey);
  }, { preferencesKey: PREFERENCES_KEY, legacyKey: LEGACY_KEY });
}

test("serves canonical bilingual My Pandas routes and resolves the locale-less route", async ({ page, request }) => {
  const redirect = await request.get("/my-pandas", {
    headers: { "accept-language": "en-US,en;q=0.9" },
    maxRedirects: 0,
  });
  expect(redirect.status()).toBe(308);
  expect(new URL(redirect.headers().location, "http://localhost").pathname).toBe("/en/my-pandas");

  await page.goto("/zh/my-pandas");
  await expect(page.getByRole("heading", { level: 1, name: "我的熊猫" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "这些记录只保存在当前浏览器" })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/zh\/my-pandas$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("migrates legacy saved slugs to stable IDs without caching public facts", async ({ page }) => {
  await page.addInitScript(({ legacyKey }) => {
    localStorage.setItem(legacyKey, JSON.stringify(["mei-xiang", "bao-li"]));
  }, { legacyKey: LEGACY_KEY });

  await page.goto("/zh/my-pandas");
  const saved = page.getByTestId("saved-pandas-section");
  await expect(saved).toContainText("美香");
  await expect(saved).toContainText("宝力");

  const stored = await page.evaluate(({ preferencesKey, legacyKey }) => ({
    preferences: JSON.parse(localStorage.getItem(preferencesKey) ?? "null"),
    legacy: localStorage.getItem(legacyKey),
  }), { preferencesKey: PREFERENCES_KEY, legacyKey: LEGACY_KEY });
  expect(stored.legacy).toBeNull();
  expect(stored.preferences.version).toBe(1);
  expect(stored.preferences.saved).toHaveLength(2);
  for (const entry of stored.preferences.saved) {
    expect(entry.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Object.keys(entry).sort()).toEqual(["at", "id"]);
  }
  expect(JSON.stringify(stored.preferences)).not.toContain("Mei Xiang");
  expect(JSON.stringify(stored.preferences)).not.toContain("美香");
});

test("returns saved and recent profiles from ordinary profile journeys", async ({ page }) => {
  await clearLocalProfileData(page);
  await page.goto("/en/atlas/mei-xiang");
  await page.getByRole("button", { name: "Save Mei Xiang" }).click();
  await page.goto("/en/my-pandas");

  await expect(page.getByTestId("saved-pandas-section")).toContainText("Mei Xiang");
  await expect(page.getByTestId("recent-pandas-section")).toContainText("Mei Xiang");
  await expect(page.getByTestId("saved-pandas-section").getByRole("link", { name: "Open profile" })).toHaveAttribute(
    "href",
    "/en/atlas/mei-xiang",
  );
});

test("sorts saved profiles and preserves local IDs across locale switching", async ({ page }) => {
  await clearLocalProfileData(page);
  await page.evaluate((legacyKey) => {
    localStorage.setItem(legacyKey, JSON.stringify(["xiao-qi-ji", "bao-li"]));
  }, LEGACY_KEY);
  await page.goto("/zh/my-pandas");

  await page.getByLabel("收藏排序").selectOption("name");
  const savedCards = page.getByTestId("saved-pandas-section").getByRole("listitem");
  await expect(savedCards.first()).toContainText("宝力");

  const idsBefore = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null").saved.map((entry: { id: string }) => entry.id), PREFERENCES_KEY);
  await page.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en\/my-pandas$/);
  await expect(page.getByTestId("saved-pandas-section")).toContainText("Bao Li");
  const idsAfter = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null").saved.map((entry: { id: string }) => entry.id), PREFERENCES_KEY);
  expect(idsAfter).toEqual(idsBefore);
});

test("supports single removal and clear-all controls with keyboard operation", async ({ page }) => {
  await clearLocalProfileData(page);
  await page.goto("/en/atlas/mei-xiang");
  await page.getByRole("button", { name: "Save Mei Xiang" }).click();
  await page.goto("/en/atlas/bao-li");
  await page.getByRole("button", { name: "Save Bao Li" }).click();
  await page.goto("/en/my-pandas");

  const removeMeiXiang = page.getByTestId("saved-pandas-section").getByRole("button", { name: "Remove: Mei Xiang" });
  await removeMeiXiang.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("saved-pandas-section")).not.toContainText("Mei Xiang");
  await expect(page.getByTestId("saved-pandas-section")).toContainText("Bao Li");

  await page.getByRole("button", { name: "Clear all saved profiles" }).click();
  await expect(page.getByTestId("saved-pandas-section")).toContainText("No profiles are saved");
  await page.getByRole("button", { name: "Clear all recent profiles" }).click();
  await expect(page.getByTestId("recent-pandas-section")).toContainText("No recent profile visits");
});

test("discloses and removes stale or withdrawn stable IDs", async ({ page }) => {
  await page.addInitScript(({ preferencesKey }) => {
    localStorage.setItem(preferencesKey, JSON.stringify({
      version: 1,
      saved: [{ id: "withdrawn-profile-id", at: "2026-07-18T00:00:00.000Z" }],
      recent: [{ id: "withdrawn-profile-id", at: "2026-07-18T00:00:00.000Z" }],
    }));
  }, { preferencesKey: PREFERENCES_KEY });
  await page.goto("/en/my-pandas");

  await expect(page.getByText("Profile unavailable in this release")).toHaveCount(2);
  await expect(page.getByText(/does not restore public facts from an old browser cache/)).toHaveCount(2);
  const removeButtons = page.getByRole("button", { name: "Remove" });
  await removeButtons.first().click();
  await expect(page.getByTestId("saved-pandas-section")).toContainText("No profiles are saved");
  await page.getByTestId("recent-pandas-section").getByRole("button", { name: "Remove" }).click();
  await expect(page.getByTestId("recent-pandas-section")).toContainText("No recent profile visits");
});

test("reflows at 320 CSS pixels and simulated 200-percent text resize", async ({ page }) => {
  await page.addInitScript(({ legacyKey }) => {
    localStorage.setItem(legacyKey, JSON.stringify(["mei-xiang", "xiao-qi-ji"]));
  }, { legacyKey: LEGACY_KEY });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/zh/my-pandas");
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });

  const layout = await page.evaluate(() => ({
    hasHorizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    protruding: Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          className: typeof element.className === "string" ? element.className : "",
          text: element.innerText?.slice(0, 80) ?? "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        };
      })
      .filter((item) => item.right > innerWidth + 1 || item.left < -1),
  }));
  expect(layout.hasHorizontalOverflow, JSON.stringify(layout.protruding, null, 2)).toBe(false);
  await expect(page.getByTestId("saved-pandas-section")).toBeVisible();
  await expect(page.getByRole("button", { name: "清除全部收藏" })).toBeVisible();
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps disclosure and ordinary archive navigation without unusable controls", async ({ page }) => {
    await page.goto("/en/my-pandas");
    await expect(page.getByRole("heading", { level: 2, name: "JavaScript is required to read local records" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse all panda profiles" }).last()).toHaveAttribute("href", "/en/atlas");
    await expect(page.getByRole("button", { name: /Clear|Remove/ })).toHaveCount(0);
  });
});
