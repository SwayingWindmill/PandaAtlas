import { test as base } from "@e2e-dev/web";

// The fixture photos stack.ts publishes point at media objects that exist nowhere, so the media host would
// answer every one with an error. A list of failing images also trips a render loop in expo-image on the web.
// Every journey gets one local picture for any photo instead, and never reaches production media.
// The fixture callbacks are named `run`, not `use`: the React hooks lint rule reads `use` as a hook.

/** A journey on a fresh install: the first-launch welcome still shows. */
export const freshInstallTest = base.extend<{ photos: void }>({
  photos: async ({ browser }, run) => {
    await browser.route("https://api.zhipanda.com/media/**", (route) =>
      route.fulfill({ path: "assets/images/android-icon-background.png" }),
    );
    await run();
  },
});

/** The journeys' `test`: every page starts past the first-launch welcome, as a returning fan's device does. */
export const test = freshInstallTest.extend<{ welcomed: void }>({
  welcomed: async ({ browser }, run) => {
    await browser.addInitScript(() => {
      try {
        localStorage.setItem("welcome.seen", "1");
      } catch {
        // Storage can be blocked; the welcome then shows, and the test says where.
      }
    });
    await run();
  },
});
