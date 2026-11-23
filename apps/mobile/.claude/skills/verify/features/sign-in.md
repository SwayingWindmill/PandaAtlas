# Sign-in

A fan signs in with an emailed six-digit code, which signs in as soon as the sixth digit is typed. A new code can be asked for after a 60-second countdown. A wrong code, an expired code and too many requests each get their own message. The fan can rename the account, stays signed in across a reload, and signs out from 设置. A fan who picked pandas on the first-launch welcome and went to sign in comes back to them followed.

## Sub-features

- `sign-in-code` requests a code and signs in with it.
- `sign-in-wrong-code` refuses a wrong code.
- `sign-in-resend` counts down 60 seconds, then sends a new code.
- `welcome-follow-after-sign-in` keeps the welcome picks on the device and follows them once signed in.
- `sign-in-rename` renames the account from 我的.
- `sign-in-persist` keeps the session across a reload.
- `sign-out` signs out from 设置.

## How to get to it (user POV)

- 我的, then `登录`.
- Any action that needs an account while signed out, such as 关注 or 记下到访, sends the fan to `/sign-in`.

## Driving it with e2e

Preconditions:

- The doctor passes for `e2e`. Mailpit is part of local Supabase. The production preview cannot sign in.

- **Sign in, rename, reload, sign out.** Run `npx e2e run tests/sign-in.e2e.ts:6` from `apps/mobile`. `signIn` opens `/me`, taps `button "登录"`, fills `邮箱`, taps `获取验证码`, reads the code from Mailpit and fills `验证码`, which signs in by itself. The test then taps `button "改名字"`, fills `名字` with `竹子爱好者` and taps `保存`. The name stays after `browser.reload()`. `button "设置"` and then `button "退出登录"` leave `link "登录"` visible.
- **Wrong code.** Run `npx e2e run tests/sign-in.e2e.ts:25`. Filling `000000` shows `验证码不对，请检查后再输入。` and empties `验证码`.
- **Resend.** Run `npx e2e run tests/sign-in.e2e.ts:35`. It takes about 70 s: `button "<n> 秒后可重新发送"` stays disabled until `button "重新发送验证码"` is enabled, and the second code signs in.
- **Welcome picks.** Run `npx e2e run tests/onboarding.e2e.ts:8` (follows after sign-in with no second tap) and `tests/onboarding.e2e.ts:28` (picks survive `app.restart()`).

## Gotchas

- Each journey uses its own address from `testEmail("<name>")`. Reusing one across journeys makes Supabase rate-limit the code.
- The session lives in browser storage, so a fresh e2e test starts signed out.
- Supabase answers a wrong and an expired code alike (`otp_expired`). The app calls a code expired only when it is older than `otp_expiry` (3600 s), so a journey cannot reach 已过期 without waiting an hour; the Web spec `apps/web/tests/smoke/email-otp-codes.spec.ts` covers it with a fake clock.
