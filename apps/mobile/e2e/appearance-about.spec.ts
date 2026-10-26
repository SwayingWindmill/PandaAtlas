import { expect, test } from "@playwright/test";

// The browser reports a light system theme, so 深色 is a visible change of the screen's colours.
test.use({ colorScheme: "light" });

test("外观 switches the app to dark, stays dark after a restart, and follows the system again", async ({ page }) => {
  await page.goto("/me");
  const heading = page.getByRole("heading", { name: "我的", exact: true });
  const ink = () => heading.evaluate((element) => getComputedStyle(element).color);
  const light = await ink();

  await page.getByRole("radio", { name: "深色" }).click();
  await expect.poll(ink).not.toBe(light);
  const dark = await ink();

  await page.reload();
  await expect(page.getByRole("radio", { name: "深色", checked: true })).toBeVisible();
  await expect.poll(ink).toBe(dark);

  await page.getByRole("radio", { name: "跟随系统" }).click();
  await expect.poll(ink).toBe(light);
});

test("关于 shows what the published release holds", async ({ page }) => {
  await page.goto("/me");
  await page.getByRole("button", { name: "内容和照片从哪来" }).click();
  await expect(page.getByRole("heading", { name: "内容和照片从哪来" })).toBeVisible();
  await expect(page.getByText(/^[\d,]+ 只$/)).toBeVisible();
  await expect(page.getByText("资料版本")).toBeVisible();
});
