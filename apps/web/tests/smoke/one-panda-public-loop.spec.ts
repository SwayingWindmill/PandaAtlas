import { expect, test } from "@playwright/test";

test("finds Mei Xiang by every reviewed public identity form", async ({ page }) => {
  await page.goto("/atlas");
  const search = page.getByLabel("搜索");

  for (const query of [
    "美香",
    "Mei Xiang",
    "Měixiāng",
    "Mei-Xiang",
    "meixiang",
    "smithsonian_history_key:mei-xiang",
  ]) {
    await search.fill(query);
    await expect(page.getByRole("heading", { name: "1 份档案" }), query).toBeVisible();
    await expect(page.getByTestId("panda-card-link-mei-xiang"), query).toBeVisible();
  }
});

test("serves bilingual canonical routes and permanently redirects legacy slugs", async ({ request }) => {
  const legacy = await request.get("/atlas/meixiang", { maxRedirects: 0 });
  expect(legacy.status()).toBe(308);
  expect(legacy.headers().location).toContain("/zh/atlas/mei-xiang");

  const englishLegacy = await request.get("/en/atlas/meixiang", { maxRedirects: 0 });
  expect(englishLegacy.status()).toBe(308);
  expect(englishLegacy.headers().location).toContain("/en/atlas/mei-xiang");

  for (const path of ["/zh/atlas/mei-xiang", "/en/atlas/mei-xiang"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(await response.text()).toContain("Mei Xiang");
  }
});

test("renders the reviewed identity, family, footprint, evidence, no-image, and revision loop", async ({ page }) => {
  await page.goto("/zh/atlas/mei-xiang");

  await expect(page.getByTestId("trusted-panda-profile")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /美香/ })).toBeVisible();
  await expect(page.getByText("完整档案").first()).toBeVisible();
  await expect(page.getByText("最后核实：2026-05-09").first()).toBeVisible();
  await expect(page.getByTestId("lineage-text-view")).toContainText("小奇迹");
  await expect(page.getByTestId("footprint-text-view")).toContainText("史密森国家动物园");
  await expect(page.getByTestId("footprint-text-view")).toContainText("中国（国家级记录）");
  await expect(page.getByTestId("evidence-list").getByRole("link")).toHaveCount(2);
  await expect(page.getByTestId("media-empty-state")).toContainText("暂无可公开授权影像");
  await expect(page.getByTestId("revision-summary")).toContainText("2026.07.14.1");
});

test("keeps favorites local-only and keyboard operable", async ({ page }) => {
  await page.goto("/zh/atlas/mei-xiang");

  const favorite = page.getByRole("button", { name: "收藏美香" });
  await favorite.focus();
  await page.keyboard.press("Enter");
  await expect(favorite).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/仅保存在此浏览器/)).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("panda-atlas:saved-profiles"))).toContain("mei-xiang");
});

test("keeps the server-rendered profile readable without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/zh/atlas/mei-xiang");

  await expect(page.getByRole("heading", { level: 1, name: /美香/ })).toBeVisible();
  await expect(page.getByTestId("timeline-list")).toBeVisible();
  await expect(page.getByTestId("footprint-text-view")).toBeVisible();
  await expect(page.getByTestId("evidence-list")).toBeVisible();
  await context.close();
});

test("reflows the complete reading loop at a narrow 200-percent-equivalent viewport", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 900 });
  await page.goto("/zh/atlas/mei-xiang");

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
  await expect(page.getByTestId("footprint-text-view")).toBeVisible();
});

test("uses the trusted profile theme in dark color scheme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/en/atlas/mei-xiang");

  const colors = await page.getByTestId("identity-first-card").evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, color: style.color };
  });
  expect(colors.background).toBe("rgb(24, 33, 26)");
  expect(colors.color).toBe("rgb(237, 243, 238)");
});
