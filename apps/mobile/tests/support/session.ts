import type { App, Screen } from "e2e";
import { expect } from "e2e";

import { fixture } from "./fixture.ts";

/** A fresh local test address; each run signs up a new local Supabase user. */
export function testEmail(label: string): string {
  return `e2e-${label}-${Date.now()}@example.test`;
}

/** How many emails Supabase Auth has currently mailed to this address in Mailpit. */
export async function mailCount(email: string): Promise<number> {
  const mailpit = fixture().mailpitUrl;
  const search = await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
  const body = (await search.json()) as { messages?: { ID: string }[] };
  return body.messages?.length ?? 0;
}

/** The newest six-digit code mailed after `previousCount` existing messages for this address. */
export async function nextCode(email: string, previousCount: number): Promise<string> {
  const mailpit = fixture().mailpitUrl;
  // Mail arrives a moment after the app asks for it; expect.poll waits for it without a fixed delay.
  let code = "";
  await expect
    .poll(
      async () => {
        const search = await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
        const messages = ((await search.json()) as { messages?: { ID: string }[] }).messages ?? [];
        if (messages.length <= previousCount) return "";
        const id = messages[0]?.ID;
        if (!id) return "";
        const message = (await (await fetch(`${mailpit}/api/v1/message/${id}`)).json()) as { Text?: string; HTML?: string };
        code = /\b(\d{6})\b/.exec(`${message.Text ?? ""} ${message.HTML ?? ""}`)?.[1] ?? "";
        return code;
      },
      { timeout: 10_000, message: `No sign-in code reached ${email}` },
    )
    .toMatch(/^\d{6}$/);
  return code;
}

/** The newest six-digit code Supabase Auth mailed to this address (Mailpit, local stack only). */
export async function latestCode(email: string): Promise<string> {
  return nextCode(email, 0);
}

/** Signs a new fan in through the app's own screens, starting from the 我的 tab. */
export async function signIn(app: App, screen: Screen, email: string): Promise<void> {
  await app.open("/me");
  await screen.getByRole("button", "绑定同步").tap();
  await enterCode(screen, email);
  // Only the signed-in 我的 tab offers 改名字; the code screen also shows the address, so it proves nothing.
  await expect(screen.getByRole("button", "改名字")).toBeVisible();
}

/** Completes the sign-in screen the app has just opened; it returns to where the fan came from. */
export async function enterCode(screen: Screen, email: string): Promise<void> {
  await screen.getByLabel("邮箱").fill(email);
  await screen.getByRole("button", "获取验证码").tap();
  // The sixth digit signs in on its own.
  await screen.getByLabel("验证码").fill(await latestCode(email));
}
