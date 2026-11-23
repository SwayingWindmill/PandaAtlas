# 吱熊猫 verification map

This directory is the maintained source for verifying what a user can see and do in the mobile app. Read this index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- `node apps/mobile/scripts/verify-doctor.mjs --mode e2e` prints only `ok` lines, or `--mode preview` does for a preview-only check.
- The local stack is started by e2e from `apps/mobile/e2e.config.ts`. Every run seeds its own fixture, a zoo, a place and pandas with run-unique names, read in a journey with `fixture()` from `tests/support/fixture.ts`.
- A signed-in journey makes its own `@example.test` user with `signIn(app, screen, testEmail("<name>"))` from `tests/support/session.ts`. Codes are read from Mailpit.
- Never drive a stack this verification run did not start.

## Driving conventions

- Start each recipe on its own route with `app.open("<route>")`, not by tapping through from 探索.
- Find elements by role and accessible name (`screen.getByRole("radio", "攻略")`) or by `getByLabel`, never by position.
- Names are Chinese and exact. Copy them from the recipe.
- The local database is reused across runs. Names repeat with a run suffix (`runSuffix()`), and a marker on the map can hold earlier runs' zoos.

## Proof and skip reporting

- A passing journey is the proof. Run it with `--trace on`, and record the `file:line` you ran and the trace path under `apps/mobile/.e2e/results/`.
- A live look adds a screenshot and an accessibility-tree read of the state after the action.
- A write is proven by reading it back from a second screen.
- Report an entry point you could not reach with the command you tried and the unmet precondition. Never count it as verified through a different entry point.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph on the user-visible behavior, then four H2 sections in this order: `Sub-features`, `How to get to it (user POV)`, `Driving it with e2e`, `Gotchas`.

## Features

- [Photo viewer](./photo-viewer.md) covers a panda's full-screen photos: paging, zoom, immersive mode, drag to close, share and save, and a width change.
- [Explore, live clock & sounds](./explore.md) covers the unified 探索 home tab, Option B star/followed strip, 此刻谁醒着 live clock, 听熊猫 & `/sounds`, and `/play` mini-games.
- [Venue page](./venue-page.md) covers a zoo's page from the map and from 探索, its 概况 / 熊猫 / 攻略 tabs, and 关注.
- [Wild habitat](./wild-habitat.md) covers the map's wild layer, the habitat sheet and a habitat's own page.
- [Sign-in](./sign-in.md) covers email-code sign-in, resending a code, a wrong code, the welcome's follow after sign-in, renaming the account and signing out.
- [Collections and visits](./collections-visits.md) covers making, renaming, emptying and deleting a collection, and recording a visit.
- [Account and data](./account-privacy.md) covers data export, account deletion confirmation, and user-initiated email OTP re-verification on recent-auth expiry.
- [Error pages](./error-pages.md) covers 找不到页面 for an unknown link and the root error page when a screen throws.
- [Find pandas](./find-pandas.md) covers 找熊猫 search by name and pinyin initials, 最近看过, 最近搜索, match highlight, the no-results suggestions and the welcome picks.
- [Sharing a panda](./sharing.md) covers the share card and its QR code, copying and sharing the link, and the 生日卡.
