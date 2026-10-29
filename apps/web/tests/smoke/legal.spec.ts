import { expect, test } from "@playwright/test";

const pages = [
  {
    locale: "zh",
    termsTitle: "用户协议",
    privacyTitle: "隐私政策",
    operator: "[运营方名称]",
    erasure: "已提交的纠错会留在审核记录里",
  },
  {
    locale: "en",
    termsTitle: "Terms",
    privacyTitle: "Privacy",
    operator: "[Operator name]",
    erasure: "Submitted corrections stay in the review records",
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
    await expect(page.getByText(pageCopy.erasure)).toBeVisible();
    await expect(page.getByText("待运营方确认")).toHaveCount(0);
    await expect(page.getByText("Pending operator confirmation")).toHaveCount(0);
    await page.getByRole("main").getByRole("link", { name: pageCopy.termsTitle }).click();
    await expect(page).toHaveURL(`/${pageCopy.locale}/terms`);
  });
}

test("sign-in says logging in agrees to the terms and the privacy policy", async ({ page }) => {
  await page.goto("/auth/login?next=/zh/me");
  await expect(page.getByText("登录即表示同意《用户协议》和《隐私政策》")).toBeVisible();
  await expect(page.getByRole("link", { name: "《用户协议》" })).toHaveAttribute("href", "/zh/terms");
  await expect(page.getByRole("link", { name: "《隐私政策》" })).toHaveAttribute("href", "/zh/privacy");

  await page.goto("/auth/login?next=/en/me");
  await expect(page.getByText("Signing in means you agree to the Terms and the Privacy policy")).toBeVisible();
  await expect(page.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/en/terms");
  await expect(page.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/en/privacy");
});

test("sitemap lists terms and privacy in both locales", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  for (const path of ["/zh/terms", "/en/terms", "/zh/privacy", "/en/privacy"]) {
    expect(xml).toContain(path);
  }
});
