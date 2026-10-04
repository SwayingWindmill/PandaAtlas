import { expect, test } from "@playwright/test";

const RELEASE_ID_PATTERN = String.raw`2026\.\d{2}\.\d{2}\.\d+`;
test("renders the canonical graph-free institution journey", async ({ page }) => {
  await page.goto("/zh/map");

  await expect(page).toHaveURL(new RegExp(`/zh/map\\?mode=institutions&snapshot=${RELEASE_ID_PATTERN}$`));
  await expect(page.getByTestId("structured-map-page")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "鐪嬬湅澶х唺鐚敓娲诲湪鍝噷" })).toBeVisible();
  await expect(page.locator('[data-testid^="structured-map-result-institution:"]')).toHaveCount(3);
  await expect(page.getByRole("heading", { level: 3, name: "涓婇噹鍔ㄧ墿鍥? })).toBeVisible();
  await expect(page.getByText("鐪熷疄鍦板浘鏆傛椂涓嶅彲鐢ㄦ椂锛屾帰绱㈠垪琛ㄣ€佸湴鐐圭簿搴︺€佹潵婧愬拰鏅€氶摼鎺ヤ粛鍙户缁娇鐢ㄣ€?)).toBeVisible();
  await expect(page.getByText("鐪熷疄鍦板浘灏氭湭鍔犺浇")).toBeVisible();
});


test("keeps wild conservation usable without a visual provider and states public precision", async ({ page }) => {
  await page.goto("/zh/map?mode=wild");

  await expect(page.getByTestId("structured-map-page")).toBeVisible();
  await expect(page.locator('[data-testid^="structured-map-result-conservation:"]').first()).toBeVisible();
  await expect(page.getByText(/鍚辩唺鐚?褰撳墠閲庣敓瀹跺洯鏁版嵁|鏈€杩戝彲鐢ㄧ殑閮ㄥ垎閲庣敓瀹跺洯鏁版嵁)/).first()).toBeVisible();
  await expect(page.getByText(/鐪佺骇|鍥藉绾?).first()).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.getByText("漏 OpenStreetMap contributors 路 漏 CARTO")).toBeHidden();
  await page.getByText("鍦板浘涓庢暟鎹鏄?).click();
  await expect(page.getByText("漏 OpenStreetMap contributors 路 漏 CARTO")).toBeVisible();
});


test("normalizes invalid, repeated, and unsupported structured map parameters", async ({ page }) => {
  await page.goto("/en/map?mode=combined&country=china&status=future&snapshot=wrong&selected=missing&unsupported=value");

  await expect(page).toHaveURL(new RegExp(`/en/map\\?mode=institutions&snapshot=${RELEASE_ID_PATTERN}$`));
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
