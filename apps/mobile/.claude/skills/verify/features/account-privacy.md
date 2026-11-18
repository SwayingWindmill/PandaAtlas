# Account and data

A signed-in fan opens 账号与数据 (`/account`) directly with a recent email-code session to request a JSON data export or account deletion. When interactive authentication has lapsed (`auth.recentAuthRequired`), the app asks for explicit email-code verification (`发送验证码` -> `邮箱验证码` -> `验证`), refreshes the session token, and retries any interrupted request automatically.

## Sub-features

- `privacy-export` requests a JSON data export, waits for the scheduled cycle, and downloads the file.
- `privacy-deletion` confirms account deletion with an optional reason before submitting.
- `privacy-recent-email-otp` shows the user-triggered email-code card (`发送验证码`) on `auth.recentAuthRequired`, verifies without auto-sending on mount, and replays the interrupted action.

## How to get to it (user POV)

- Sign in on `/me`, then open `/account` (我的 -> 设置 -> 账号与数据).

## Driving it with e2e

Preconditions:

- The doctor passes for `e2e`. Mailpit is part of local Supabase, and `ageInteractiveAuth` connects to `DATABASE_URL` via Postgres.

- **Recent-auth lapse unlocks data export and downloads JSON.** Run `npx e2e run tests/account.e2e.ts:79` from `apps/mobile`. `expireRecentAuth(browser, email)` backdates `auth.sessions` and `auth.mfa_amr_claims` by 20 minutes and expires the cached access token so Supabase refreshes a stale-auth JWT. `app.open("/account")` receives `403 auth.recentAuthRequired`, renders `button "发送验证码"` without auto-sending (`mailCount(email)` stays `1`), sends and verifies the second code (`邮箱验证码` -> `验证`), taps `申请导出`, runs `runScheduledCycles()`, reloads, and downloads `zhipanda-export-YYYY-MM-DD.json`.
- **Account deletion confirmation and mid-action re-verification retry.** Run `npx e2e run tests/account.e2e.ts:101`. `/account` opens directly to `button "申请注销账号"`; tapping `取消` dismisses `确定要注销吗？`; entering `注销原因`, expiring recent auth before tapping `确认注销`, and completing `发送验证码` -> `邮箱验证码` -> `验证` automatically retries the interrupted deletion POST (`已提交，等待处理` visible, `申请注销账号` count 0).

## Gotchas

- `GoTrue` enforces `max_frequency = "1s"` between OTP emails to the same address; wait slightly over 1 second between initial sign-in and tapping `发送验证码` in fast browser runs.
- Because sign-in already places one email in Mailpit, wait for `messages.length > 1` with `nextCode(email, 1)` rather than `latestCode(email)`.
