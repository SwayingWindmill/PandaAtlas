import { expect, type Page } from "@playwright/test";

/** A fresh local test address; each run signs up a new local Supabase user. */
export function testEmail(label: string): string {
  return `e2e-${label}-${Date.now()}@example.test`;
}

/** The newest six-digit code Supabase Auth mailed to this address (Mailpit, local stack only). */
export async function latestCode(email: string): Promise<string> {
  const mailpit = process.env.E2E_MAILPIT_URL;
  if (!mailpit) throw new Error("E2E_MAILPIT_URL is not set; run through playwright.config.ts");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const search = await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const found = (await search.json()) as { messages?: { ID: string }[] };
    const id = found.messages?.[0]?.ID;
    if (id) {
      const message = (await (await fetch(`${mailpit}/api/v1/message/${id}`)).json()) as { Text?: string; HTML?: string };
      const code = /\b(\d{6})\b/.exec(`${message.Text ?? ""} ${message.HTML ?? ""}`)?.[1];
      if (code) return code;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No sign-in code reached ${email}`);
}

/** Signs in through the app's own screens, starting from the 我的 tab. */
export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/me");
  await page.getByRole("button", { name: "登录" }).click();
  await enterCode(page, email);
  // Only the signed-in 我的 tab offers sign-out; the code screen also shows the address, so it proves nothing.
  await expect(page.getByRole("button", { name: "退出登录" })).toBeVisible();
}

/** Completes the sign-in screen the app has just opened; it returns to where the fan came from. */
export async function enterCode(page: Page, email: string): Promise<void> {
  await page.getByLabel("邮箱").fill(email);
  await page.getByRole("button", { name: "获取验证码" }).click();
  await page.getByLabel("验证码").fill(await latestCode(email));
  await page.getByRole("button", { name: "登录" }).last().click();
}
