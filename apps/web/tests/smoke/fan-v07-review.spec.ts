import { expect, test } from "@playwright/test";

const routes = [
  ["/zh/prototype/fan-v07-review", "V0.7 子页面恢复"],
  ["/zh/prototype/fan-v07-review/pandas", "熊猫图鉴"],
  ["/zh/prototype/fan-v07-review/families", "熊猫家族"],
  ["/zh/prototype/fan-v07-review/moments", "熊猫时光"],
  ["/zh/prototype/fan-v07-review/me", "把喜欢、见过和去过"],
] as const;

for (const [route, heading] of routes) {
  test(`recovered fan V0.7 review renders ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page.getByTestId("fan-v07-review")).toBeVisible();
    await expect(page.getByRole("heading", { name: new RegExp(heading) }).first()).toBeVisible();
  });
}
