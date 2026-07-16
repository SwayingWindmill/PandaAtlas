import { expect, test } from "@playwright/test";

import { loadGoldenDatasetForBrowserTests } from "../fixtures/golden-dataset";

const family = loadGoldenDatasetForBrowserTests().pandas
  .filter(
    ({ publication_status, public: profile }) =>
      publication_status === "published"
      && (profile.record_tier === "complete_first_pass" || profile.record_tier === "identity_first_pass"),
  )
  .map(({ public: profile }) => ({
    slug: profile.canonical_slug,
    legacySlug: profile.legacy_slugs?.[0]?.value,
    nameZh: profile.names.find(({ language }) => language === "zh-Hans")?.value,
    nameEn: profile.names.find(({ language }) => language === "en")?.value,
  }));

test("serves bilingual canonical profiles and legacy redirects for all seven pandas", async ({ request }) => {
  expect(family).toHaveLength(7);
  for (const { slug, legacySlug, nameZh, nameEn } of family) {
    expect(legacySlug, `${slug} legacy slug`).toBeTruthy();
    expect(nameZh, `${slug} Chinese name`).toBeTruthy();
    expect(nameEn, `${slug} English name`).toBeTruthy();
    for (const locale of ["zh", "en"] as const) {
      const canonical = await request.get(`/${locale}/atlas/${slug}`);
      expect(canonical.status(), `${locale}/${slug}`).toBe(200);
      const html = await canonical.text();
      expect(html).toContain(nameZh!);
      expect(html).toContain(nameEn!);

      const legacy = await request.get(`/${locale}/atlas/${legacySlug!}`, { maxRedirects: 0 });
      expect(legacy.status(), `${locale}/${legacySlug}`).toBe(308);
      expect(legacy.headers().location).toContain(`/${locale}/atlas/${slug}`);
    }
  }
});

test("completes the Xiao Qi Ji family-to-evidence golden journey", async ({ page }) => {
  await page.goto(`/zh/atlas?q=${encodeURIComponent("小奇迹")}`);
  await page.getByRole("link", { name: /小奇迹.*Xiao Qi Ji/ }).click();

  await expect(page).toHaveURL(/\/zh\/atlas\/xiao-qi-ji$/);
  await page.getByTestId("fact-parents").getByRole("link", { name: "美香" }).click();
  await expect(page).toHaveURL(/\/zh\/atlas\/mei-xiang$/);

  await expect(page.getByTestId("timeline-list")).toContainText("已完成");
  await expect(page.getByTestId("footprint-text-view")).toContainText("中国（国家级记录）");
  const evidenceLink = page.getByTestId("evidence-list").getByRole("link").first();
  await expect(evidenceLink).toHaveAttribute("href", /^https:\/\//);

  await page.getByRole("button", { name: "收藏美香" }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("panda-atlas:saved-profiles"))).toContain("mei-xiang");
  await page.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en\/atlas\/mei-xiang$/);
  await expect(page.getByRole("heading", { level: 1, name: "Mei Xiang" })).toBeVisible();
});

test("renders reviewed source-link media without importing unlicensed imagery", async ({ page }) => {
  await page.goto("/en/atlas/tian-tian");

  await expect(page.getByTestId("fact-birth")).toContainText("Source");
  await expect(page.getByTestId("fact-sex")).toContainText("Source");
  await expect(page.getByTestId("fact-place")).toContainText("Source");
  const mediaState = page.getByTestId("media-source-link-state");
  await expect(mediaState).toContainText("Source-linked media only");
  await expect(mediaState.getByRole("link")).toHaveAttribute("href", /^https:\/\//);
});

test("keeps Bao Li third-generation relationship paths inside the trusted release", async ({ page }) => {
  await page.goto("/en/atlas/bao-li");

  const parents = page.getByTestId("parent-relations");
  await expect(parents.getByRole("link", { name: "Bao Bao" })).toBeVisible();
  await expect(parents).toContainText("An An");
  await expect(parents).toContainText("Tentative relationship");

  const grandparents = page.getByRole("heading", { name: "Grandparents" }).locator("..");
  await expect(grandparents.getByRole("link", { name: "Mei Xiang" })).toBeVisible();
  await expect(grandparents.getByRole("link", { name: "Tian Tian" })).toBeVisible();
});
