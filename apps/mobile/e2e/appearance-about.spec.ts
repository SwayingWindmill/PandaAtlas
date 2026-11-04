import { expect, test } from "@playwright/test";

// The browser reports a light system theme, so 深色 is a visible change of the screen's colours.
test.use({ colorScheme: "light" });

test("外观 switches the app to dark, stays dark after a restart, and follows the system again", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "外观，跟随系统" }).click();
  const heading = page.getByRole("heading", { name: "外观", exact: true });
  const ink = () => heading.evaluate((element) => getComputedStyle(element).color);
  const light = await ink();

  await page.getByRole("button", { name: "深色" }).click();
  await expect.poll(ink).not.toBe(light);
  const dark = await ink();

  await page.reload();
  await expect.poll(ink).toBe(dark);

  await page.getByRole("button", { name: "跟随系统" }).click();
  await expect.poll(ink).toBe(light);
});

test("关于 shows what the published release holds", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "数据来源" }).click();
  await expect(page.getByRole("heading", { name: "内容和照片从哪来" })).toBeVisible();
  await expect(page.getByText(/^[\d,]+ 只$/)).toBeVisible();
  await expect(page.getByText("资料版本")).toBeVisible();
});
