import { expect, test } from "@playwright/test";

test("serves localized panda game routes and lists them in the sitemap", async ({ page, request }) => {
  for (const locale of ["zh", "en"] as const) {
    const hub = await request.get(`/${locale}/games`);
    const random = await request.get(`/${locale}/games/random`);
    const guess = await request.get(`/${locale}/games/guess`);
    expect(hub.status()).toBe(200);
    expect(random.status()).toBe(200);
    expect(guess.status()).toBe(200);
  }

  const sitemap = await request.get("/sitemap.xml");
  const xml = await sitemap.text();
  expect(xml).toContain("/zh/games");
  expect(xml).toContain("/en/games/random");
  expect(xml).toContain("/en/games/guess");

  await page.goto("/zh/games");
  await expect(page.getByRole("heading", { level: 1, name: "轻松玩一会儿，也认识一只新熊猫。" })).toBeVisible();
  await expect(page.getByRole("link", { name: "随机一只" })).toHaveAttribute("href", "/zh/games/random");
  await expect(page.getByRole("link", { name: "开始猜" })).toHaveAttribute("href", "/zh/games/guess");
});

test("Random Panda works anonymously and changes the selected panda", async ({ page }) => {
  await page.route("**/api/identity/**", async (route) => route.abort());
  await page.goto("/en/games/random");

  const profileLink = page.getByRole("link", { name: "Open panda profile" });
  await expect(profileLink).toBeVisible();
  const firstHref = await profileLink.getAttribute("href");
  await page.getByRole("button", { name: "Pick another panda" }).click();
  await expect(profileLink).not.toHaveAttribute("href", firstHref ?? "");
});

test("Guess Panda works anonymously as a curated four-choice round without leaking the answer", async ({ page }) => {
  const questionId = "11111111-1111-4111-8111-111111111111";
  const answerId = "22222222-2222-4222-8222-222222222222";
  let answerRequest: unknown = null;
  await page.route("**/api/identity/**", async (route) => route.abort());
  await page.route("**/api/games/guess/question", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        question_id: questionId,
        image_url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
        image_alt: "Panda question",
        difficulty: "medium",
        options: [
          { panda_id: answerId, name: "Shin Shin" },
          { panda_id: "33333333-3333-4333-8333-333333333333", name: "Bao Xin" },
          { panda_id: "44444444-4444-4444-8444-444444444444", name: "Xiao Xiao" },
          { panda_id: "55555555-5555-4555-8555-555555555555", name: "Lei Lei" },
        ],
      }),
    });
  });
  await page.route("**/api/games/guess/answer", async (route) => {
    answerRequest = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        correct: true,
        answer: { panda_id: answerId, name: "Shin Shin", slug: "shin-shin" },
        recognition_tips: ["Look at the ear and eye-patch shape."],
      }),
    });
  });
  await page.goto("/en/games/guess");

  await page.getByRole("button", { name: "Start guessing" }).click();
  const game = page.locator("main section").last();
  const choices = game.getByRole("button");
  await expect(choices).toHaveCount(4);
  await expect(game.getByText("Look at the ear and eye-patch shape.")).toHaveCount(0);
  await choices.first().click();
  expect(answerRequest).toEqual({ question_id: questionId, selected_panda_id: answerId });
  await expect(game.getByRole("status")).toBeVisible();
  await expect(game.getByText("Look at the ear and eye-patch shape.")).toBeVisible();
  await expect(game.getByRole("button", { name: "Next panda" })).toBeVisible();
  await expect(game.getByRole("link", { name: "Open panda profile" })).toHaveAttribute("href", "/en/pandas/shin-shin");
});

test("Guess Panda only persists after an explicit save and resumes through login", async ({ page }) => {
  let saveRequests = 0;
  const answerId = "22222222-2222-4222-8222-222222222222";
  await page.route("**/api/games/guess/question", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        question_id: "11111111-1111-4111-8111-111111111111",
        image_url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
        image_alt: "Panda question",
        difficulty: "medium",
        options: [
          { panda_id: answerId, name: "Shin Shin" },
          { panda_id: "33333333-3333-4333-8333-333333333333", name: "Bao Xin" },
          { panda_id: "44444444-4444-4444-8444-444444444444", name: "Xiao Xiao" },
          { panda_id: "55555555-5555-4555-8555-555555555555", name: "Lei Lei" },
        ],
      }),
    });
  });
  await page.route("**/api/games/guess/answer", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        correct: true,
        answer: { panda_id: answerId, name: "Shin Shin", slug: "shin-shin" },
        recognition_tips: [],
      }),
    });
  });
  await page.route("**/api/engagement/game-attempts", async (route) => {
    if (route.request().method() === "POST") {
      saveRequests += 1;
      await route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
      return;
    }
    await route.continue();
  });

  await page.goto("/en/games/guess");
  await page.getByRole("button", { name: "Start guessing" }).click();
  const game = page.locator("main section").last();
  await game.getByRole("button").first().click();

  expect(saveRequests).toBe(0);
  await game.getByRole("button", { name: "Save this result" }).click();
  await expect.poll(() => saveRequests).toBe(1);
  await expect(page).toHaveURL(/\/auth\/login\?next=%2Fen%2Fgames%2Fguess/);

  const pending = await page.evaluate(() => window.sessionStorage.getItem("zhipanda:pending-guess-attempt:v1"));
  expect(pending).not.toBeNull();
});

test("saved Guess Panda history can be reviewed and deleted", async ({ page }) => {
  let deletedAttemptId: string | null = null;
  await page.route("**/api/engagement/game-attempts", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              attempt_id: "11111111-1111-4111-8111-111111111111",
              game_type: "guess_panda",
              target_panda_id: "unknown-target",
              selected_panda_id: "unknown-selected",
              correct: false,
              public_release_version: "test-release",
              attempted_at: "2026-08-11T00:00:00Z",
            },
          ],
        }),
      });
      return;
    }
    await route.continue();
  });
  await page.route("**/api/engagement/game-attempts/*", async (route) => {
    if (route.request().method() === "DELETE") {
      deletedAttemptId = route.request().url().split("/").at(-1) ?? null;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ deleted: true }) });
      return;
    }
    await route.continue();
  });

  await page.goto("/en/me/game-history");
  await expect(page.getByRole("heading", { level: 1, name: "Saved Guess Panda results" })).toBeVisible();
  await expect(page.getByText("Incorrect", { exact: true })).toBeVisible();
  await expect(page.getByText("test-release", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete result" }).click();
  await expect.poll(() => deletedAttemptId).toBe("11111111-1111-4111-8111-111111111111");
  await expect(page.getByText("You have not saved a game result yet.")).toBeVisible();
});
