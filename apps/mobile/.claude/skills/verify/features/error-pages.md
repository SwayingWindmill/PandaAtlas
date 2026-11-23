# Error pages

A link to a route the app does not have shows 找不到页面 with a 回首页 button. A screen that throws while rendering is replaced by the root error page, 页面出了点问题, with 重试 and 回首页. Neither leaves the fan on a blank screen.

## Sub-features

- `not-found` shows 找不到页面 for an unknown route and 回首页 leads to the app's root.
- `error-boundary` shows 页面出了点问题 when a screen throws, with 重试 and 回首页.
- `error-reporting` sends the error to Sentry only when `EXPO_PUBLIC_SENTRY_DSN` is set.

## How to get to it (user POV)

- A shared or old link to a page that no longer exists, for example `/no-such-page`.
- Any screen that fails while rendering.

## Driving it with e2e

Preconditions:

- The doctor passes for `e2e`, or `--mode preview` for a look with production data.

- **Not found.** Run `npx e2e run tests/not-found.e2e.ts:5` from `apps/mobile`. It opens `/no-such-page/at-all`, reads 这个链接可能已经失效，或者页面已经搬走了。, taps `button "回首页"` and sees `heading "今天"`.
- **Error page.** No journey drives it, because nothing in the app throws on purpose. For a live look, add a temporary `throw` at the top of a screen (for example `about.tsx`), open that route in the preview, check 页面出了点问题, 重试 and 回首页, then remove the throw.

## Gotchas

- In a development build Expo also shows its own red error toast over the error page. A store build shows only the page.
- On a fresh browser 回首页 lands on the first-launch welcome, because `/` sends a fan who has not seen it there.
