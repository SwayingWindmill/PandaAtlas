import { expect, test, type Page } from "@playwright/test";

const verifyUrl = "http://127.0.0.1:65534/auth/v1/verify**";

async function routeStart(page: Page, status = 200): Promise<{ sends: () => number }> {
  let sends = 0;
  await page.route("**/api/auth/email-otp/start", async (route) => {
    sends += 1;
    await route.fulfill({
      status,
      contentType: "application/json",
      body: status === 200 ? '{"message":"ok"}' : '{"code":"rate_limited","detail":"Too many requests"}',
    });
  });
  return { sends: () => sends };
}

async function rejectCodes(page: Page, status: number, code: string): Promise<void> {
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST" };
  await page.route(verifyUrl, (route) =>
    route.request().method() === "OPTIONS"
      ? route.fulfill({ status: 204, headers: cors })
      : route.fulfill({
          status,
          contentType: "application/json",
          headers: cors,
          body: JSON.stringify({ code: status, error_code: code, msg: "Token has expired or is invalid" }),
        }),
  );
}

async function sendCode(page: Page): Promise<void> {
  await page.goto("/auth/login");
  const send = page.getByRole("button", { name: "发送验证码" });
  // A value typed before hydration does not reach React state, so clear and retype until the form accepts it.
  const email = page.getByRole("textbox");
  await expect(async () => {
    await email.fill("");
    await email.fill("fan@example.test");
    await expect(send).toBeEnabled({ timeout: 500 });
  }).toPass();
  await send.click();
  await expect(page.getByRole("button", { name: "验证并登录" })).toBeVisible();
}

async function submitCode(page: Page, code: string): Promise<void> {
  await page.getByRole("textbox", { name: "6 位验证码" }).fill(code);
  await page.getByRole("button", { name: "验证并登录" }).click();
}

test("a new code can be sent once the minute after the last one has passed", async ({ page }) => {
  await page.clock.install();
  const start = await routeStart(page);
  await sendCode(page);
  await expect(page.getByRole("button", { name: /^\d+ 秒后可重新发送$/ })).toBeDisabled();

  await page.clock.fastForward("01:01");
  const resend = page.getByRole("button", { name: "重新发送验证码" });
  await expect(resend).toBeEnabled();
  await resend.click();
  await expect(page.getByRole("status")).toHaveText("新的验证码已发送。");
  expect(start.sends()).toBe(2);
  await expect(page.getByRole("button", { name: /^\d+ 秒后可重新发送$/ })).toBeDisabled();
});

test("a send refused for coming too often says so", async ({ page }) => {
  await routeStart(page, 429);
  await page.goto("/auth/login");
  const send = page.getByRole("button", { name: "发送验证码" });
  const email = page.getByRole("textbox");
  await expect(async () => {
    await email.fill("");
    await email.fill("fan@example.test");
    await expect(send).toBeEnabled({ timeout: 500 });
  }).toPass();
  await send.click();
  await expect(page.getByRole("alert")).toHaveText("请求太频繁，请稍后再试。");
});

test("a refused code is called wrong while it is fresh", async ({ page }) => {
  await routeStart(page);
  await rejectCodes(page, 403, "otp_expired");
  await sendCode(page);
  await submitCode(page, "000000");
  await expect(page.getByRole("alert")).toHaveText("验证码不正确，请检查后重试。");
});

test("a refused code is called expired once its hour has passed", async ({ page }) => {
  await page.clock.install();
  await routeStart(page);
  await rejectCodes(page, 403, "otp_expired");
  await sendCode(page);
  await page.clock.fastForward("01:00:01");
  await submitCode(page, "000000");
  await expect(page.getByRole("alert")).toHaveText("验证码已过期，请重新获取。");
});

test("a code tried too often says so", async ({ page }) => {
  await routeStart(page);
  await rejectCodes(page, 429, "over_request_rate_limit");
  await sendCode(page);
  await submitCode(page, "000000");
  await expect(page.getByRole("alert")).toHaveText("请求太频繁，请稍后再试。");
});
