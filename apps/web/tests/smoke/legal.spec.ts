import { expect, test } from "@playwright/test";

const pages = [
  {
    locale: "zh",
    termsTitle: "用户协议",
    privacyTitle: "隐私政策",
    operator: "[运营方名称]",
    pending: "待运营方确认：注销后，已提交的纠错会保留，但会去标识（匿名化）",
  },
  {
    locale: "en",
    termsTitle: "Terms",
    privacyTitle: "Privacy",
    operator: "[Operator name]",
    pending: "Pending operator confirmation: after deletion, submitted corrections are kept but de-identified (anonymized)",
  },
] as const;

for (const pageCopy of pages) {
  test(`${pageCopy.locale} terms and privacy render, cross-link, and sit in the footer`, async ({ page }) => {
    await page.goto(`/${pageCopy.locale}`);
    const footer = page.getByRole("contentinfo");
    await footer.getByRole("link", { name: pageCopy.termsTitle }).click();

    await expect(page).toHaveURL(`/${pageCopy.locale}/terms`);
    await expect(page.locator("html")).toHaveAttribute("lang", pageCopy.locale === "zh" ? "zh-CN" : "en");
    await expect(page.getByRole("heading", { level: 1, name: pageCopy.termsTitle })).toBeVisible();
    await expect(page.getByTestId("legal-draft-banner")).toBeVisible();
    await expect(page.getByText(pageCopy.operator).first()).toBeVisible();
    await page.getByRole("main").getByRole("link", { name: pageCopy.privacyTitle }).click();

    await expect(page).toHaveURL(`/${pageCopy.locale}/privacy`);
    await expect(page.getByRole("heading", { level: 1, name: pageCopy.privacyTitle })).toBeVisible();
    await expect(page.getByText(pageCopy.pending)).toBeVisible();
    await page.getByRole("main").getByRole("link", { name: pageCopy.termsTitle }).click();
    await expect(page).toHaveURL(`/${pageCopy.locale}/terms`);
  });
}

test("sitemap lists terms and privacy in both locales", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  for (const path of ["/zh/terms", "/en/terms", "/zh/privacy", "/en/privacy"]) {
    expect(xml).toContain(path);
  }
});
