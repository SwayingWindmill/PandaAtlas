import { expect, test } from "@playwright/test";

const RELEASE_ID = "2026.07.20.2";
const SMITHSONIAN_RESULT = "institution:afb0f227-dd5e-5076-88e3-74e9807a6049";


test("renders the canonical graph-free institution journey", async ({ page }) => {
  await page.goto("/zh/map");

  await expect(page).toHaveURL(`/zh/map?mode=institutions&snapshot=${RELEASE_ID}`);
  await expect(page.getByTestId("structured-map-page")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "结构化全球分布与足迹" })).toBeVisible();
  await expect(page.locator('[data-testid^="structured-map-result-institution:"]')).toHaveCount(8);
  await expect(page.getByRole("heading", { level: 3, name: "上野动物园" })).toBeVisible();
  await expect(page.getByText("地图画布不是完成任务的前提")).toBeVisible();
  await expect(page.getByText("结构化页面未加载地图服务")).toBeVisible();
});


test("filters the individual footprint while preserving current and historical residency truth", async ({ page }) => {
  await page.goto(`/en/map?mode=individual&focus=mei-xiang&snapshot=${RELEASE_ID}`);

  await expect(page.getByTestId("structured-map-page")).toBeVisible();
  const results = page.locator('[data-testid^="structured-map-result-residency:"]');
  await expect(results).toHaveCount(2);
  await expect(results.filter({ hasText: "Current" })).toHaveCount(1);
  await expect(results.filter({ hasText: "Historical" })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Open trusted profile" }).first()).toHaveAttribute(
    "href",
    "/en/atlas/mei-xiang",
  );
});


test("keeps wild conservation usable without a visual provider and states public precision", async ({ page }) => {
  await page.goto(`/zh/map?mode=wild&snapshot=${RELEASE_ID}`);

  await expect(page.getByTestId("structured-map-page")).toBeVisible();
  await expect(page.locator('[data-testid^="structured-map-result-conservation:"]').first()).toBeVisible();
  await expect(page.getByText(/PandaAtlas (实时栖息地接口|缓存的部分栖息地发布)/).first()).toBeVisible();
  await expect(page.getByText(/省级|国家级/).first()).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.getByText("© OpenStreetMap contributors · © CARTO")).toBeHidden();
  await page.getByText("地图 Provider 契约").click();
  await expect(page.getByText("© OpenStreetMap contributors · © CARTO")).toBeVisible();
});


test("selects a result in canonical URL state and preserves it across locale switching", async ({ page }) => {
  await page.goto(`/zh/map?mode=institutions&country=US&snapshot=${RELEASE_ID}`);
  const smithsonian = page.getByTestId(`structured-map-result-${SMITHSONIAN_RESULT}`);
  await smithsonian.getByRole("link", { name: "查看此结果" }).click();

  await expect(page).toHaveURL(new RegExp(`selected=${encodeURIComponent(SMITHSONIAN_RESULT)}`));
  await expect(page.getByTestId("selected-structured-map-result")).toContainText("史密森国家动物园");
  await expect(page.getByRole("link", { name: "English", exact: true })).toHaveAttribute(
    "href",
    `/en/map?mode=institutions&country=US&snapshot=${RELEASE_ID}&selected=${encodeURIComponent(SMITHSONIAN_RESULT)}`,
  );
});


test("normalizes invalid, repeated, and unsupported structured map parameters", async ({ page }) => {
  await page.goto("/en/map?mode=combined&country=china&status=future&snapshot=wrong&selected=missing&unsupported=value");

  await expect(page).toHaveURL(`/en/map?mode=institutions&snapshot=${RELEASE_ID}`);
  await expect(page.getByTestId("structured-map-page")).toBeVisible();
});


test("legacy map routes redirect by request language while preserving task state", async ({ request }) => {
  for (const legacyPath of ["/map", "/global-distribution"]) {
    const response = await request.get(`${legacyPath}?mode=individual&focus=mei-xiang`, {
      headers: { "accept-language": "en-US,en;q=0.9" },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(308);
    expect(response.headers().location).toContain("/en/map?mode=individual&focus=mei-xiang");
  }
});


test("submits native structured map filters from the keyboard", async ({ page }) => {
  await page.goto(`/en/map?mode=institutions&snapshot=${RELEASE_ID}`);
  const form = page.getByRole("form", { name: "Filter structured results" });

  await form.getByLabel("Panda, institution, or place").fill("Smithsonian");
  await form.getByLabel("Country scope").selectOption("US");
  await form.getByRole("button", { name: "Update results" }).focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(`/en/map?mode=institutions&focus=Smithsonian&country=US&snapshot=${RELEASE_ID}`);
  await expect(page.getByTestId(`structured-map-result-${SMITHSONIAN_RESULT}`)).toBeVisible();
});


test("renders the complete structured map journey without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`/en/map?mode=individual&focus=mei-xiang&snapshot=${RELEASE_ID}`);

  await expect(page.getByTestId("structured-map-page")).toBeVisible();
  await expect(page.locator('[data-testid^="structured-map-result-residency:"]')).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Open trusted profile" }).first()).toBeVisible();
  await context.close();
});
