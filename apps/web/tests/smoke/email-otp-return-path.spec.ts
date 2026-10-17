import { expect, test, type Page } from "@playwright/test";

async function returnPathSentFromLogin(page: Page, next: string): Promise<string> {
  let sentNext: string | undefined;
  await page.route("**/api/auth/email-otp/start", async (route) => {
    sentNext = (route.request().postDataJSON() as { next: string }).next;
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"message":"ok"}' });
  });
  await page.goto(`/auth/login?next=${encodeURIComponent(next)}`);
  const send = page.getByRole("button", { name: /发送验证码|Send verification code/ });
  // A value typed before hydration does not reach React state, so clear and retype until the form accepts it.
  const email = page.getByRole("textbox");
  await expect(async () => {
    await email.fill("");
    await email.fill("fan@example.test");
    await expect(send).toBeEnabled({ timeout: 500 });
  }).toPass();
  await send.click();
  await expect(page.getByRole("button", { name: /验证并登录|Verify and sign in/ })).toBeVisible();
  if (sentNext === undefined) throw new Error("The login page did not request a verification code.");
  return sentNext;
}

for (const next of [
  "/zh/games/guess",
  "/en/me",
  "/zh/me/collections",
  "/en/me/memories",
  "/zh/me/game-history",
  "/en/places/zoo-atlanta",
  "/zh/pandas/mei-xiang",
  "/en/me/inbox",
]) {
  test(`email sign-in returns the fan to ${next}`, async ({ page }) => {
    expect(await returnPathSentFromLogin(page, next)).toBe(next);
  });
}

for (const next of [
  "//evil.example/zh/me",
  "https://evil.example/zh/me",
  "/fr/me",
  "/zh/me/unknown",
  "/zh/games/guess/extra",
  "/zh/games/random",
  "/en/places/Zoo_Atlanta",
]) {
  test(`email sign-in refuses the return path ${next}`, async ({ page }) => {
    expect(await returnPathSentFromLogin(page, next)).toBe("/admin");
  });
}
