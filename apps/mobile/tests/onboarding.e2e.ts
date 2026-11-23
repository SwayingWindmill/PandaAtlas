import { expect } from "e2e";

import { freshInstallTest as test } from "./support/test.ts";

test("first launch opens 探索 directly without a blocking welcome screen", async ({ app, screen, browser }) => {
  await app.open("/");
  await expect(screen.getByRole("heading", "探索")).toBeVisible();
  await expect(screen.getByText("明星熊猫")).toBeVisible();

  await browser.reload();
  await expect(screen.getByRole("heading", "探索")).toBeVisible();
});

test("legacy /welcome deep link redirects cleanly to 探索", async ({ app, screen }) => {
  await app.open("/welcome");
  await expect(screen.getByRole("heading", "探索")).toBeVisible();
});
