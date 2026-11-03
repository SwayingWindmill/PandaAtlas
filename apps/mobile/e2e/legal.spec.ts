import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.context().route("https://www.zhipanda.com/**", (route) => route.fulfill({ status: 200, body: "legal" }));
});

test("设置 opens the user agreement and the privacy policy", async ({ page }) => {
  await page.goto("/settings");
  const terms = page.waitForEvent("popup");
  await page.getByRole("link", { name: "用户协议" }).click();
  expect((await terms).url()).toBe("https://www.zhipanda.com/zh/terms");

  const privacy = page.waitForEvent("popup");
  await page.getByRole("link", { name: "隐私政策" }).click();
  expect((await privacy).url()).toBe("https://www.zhipanda.com/zh/privacy");
});

test("sign-in says logging in agrees to the user agreement and the privacy policy", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByText("登录即表示同意《用户协议》和《隐私政策》")).toBeVisible();

  const terms = page.waitForEvent("popup");
  await page.getByRole("link", { name: "《用户协议》" }).click();
  expect((await terms).url()).toBe("https://www.zhipanda.com/zh/terms");

  const privacy = page.waitForEvent("popup");
  await page.getByRole("link", { name: "《隐私政策》" }).click();
  expect((await privacy).url()).toBe("https://www.zhipanda.com/zh/privacy");
});
