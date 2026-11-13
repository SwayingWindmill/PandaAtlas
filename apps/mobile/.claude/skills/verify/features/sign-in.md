# Sign-in

A fan signs in with an emailed six-digit code, can rename the account, stays signed in across a reload, and signs out from 设置. A wrong code is refused with a message.

## Sub-features

- `sign-in-code` requests a code and signs in with it.
- `sign-in-wrong-code` refuses a wrong code.
- `sign-in-rename` renames the account from 我的.
- `sign-in-persist` keeps the session across a reload.
- `sign-out` signs out from 设置.

## How to get to it (user POV)

- 我的, then `登录`.
- Any action that needs an account while signed out, such as 关注 or 记下到访, sends the fan to `/sign-in`.

## Driving it with e2e

Preconditions:

- The doctor passes for `e2e`. Mailpit is part of local Supabase. The production preview cannot sign in.

- **Sign in, rename, reload, sign out.** Run `npx e2e run tests/sign-in.e2e.ts:6` from `apps/mobile`. `signIn` opens `/me`, taps `button "登录"`, fills `邮箱`, taps `获取验证码`, reads the code from Mailpit and fills `验证码`. The test then taps `button "改名字"`, fills `名字` with `竹子爱好者` and taps `保存`. The name stays after `browser.reload()`. `button "设置"` and then `button "退出登录"` leave `link "登录"` visible.
- **Wrong code.** Run `npx e2e run tests/sign-in.e2e.ts:25`. Filling `000000` shows `验证码不对或已过期，请检查或重新获取。`.

## Gotchas

- Each journey uses its own address from `testEmail("<name>")`. Reusing one across journeys makes Supabase rate-limit the code.
- The session lives in browser storage, so a fresh e2e test starts signed out.
