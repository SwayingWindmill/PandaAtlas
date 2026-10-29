# User actions required

Items that need the owner: credentials, approvals or product decisions. Work that depends on them is skipped until they are done; everything else continues. Newest first within each group.

## Approvals

- **Two-step verification before export and deletion.** The API's `privacy.request.manage` policy requires AAL2 and a recent sign-in, so the app asks fans to set up an authenticator app (Supabase Auth TOTP) before their first data export or account deletion. Keep this, or decide on a lighter step (for example a fresh email code, which gives recent authentication but not AAL2) and change the policy in a migration.

- **Publish content release `2026.10.26.1`.** `release.build` built it from `data/release-manifests/2026.10.26.1.json`; review the change list in the run summary, then run `release.publish` with the same manifest (runbook: `docs/runbooks/production-release.md#publish-a-content-release`). Institutions stay hidden on the website and in the app until then.

## Credentials and accounts

- **Supabase Auth: leaked-password protection.** The Supabase security advisor flags it as off (Authentication → Policies → Password security, which checks passwords against HaveIBeenPwned). Fans sign in with email codes and staff with email codes plus TOTP, so no password is in use today; turning it on costs nothing and covers any future password sign-in. It is an account setting, so it is yours to switch.

- **App builds and store release.** The app (`com.zhipanda.app`) has no EAS project yet, so it runs only in development. Releasing it needs an Expo account to own the EAS project, an Apple Developer Program membership and a Google Play Console account; then `eas init`, `eas build` and `eas submit` (the same accounts cover the push credentials below).

- **Push notifications.** Reminders (the canvas 提醒 sheet) need Expo/EAS push with an APNs key (Apple Developer account) and an FCM server key (Firebase). The in-app notification inbox and its preferences work without them.
- **Sign in with Apple / WeChat / phone.** The canvas login offers them; the app signs in with email codes today. Apple needs an Apple Developer team and a Services ID configured in Supabase Auth (also required by App Review once any third-party login ships); WeChat needs a WeChat Open Platform app; phone codes need an SMS provider (e.g. Twilio) configured in Supabase Auth.

## Legal

- **Fill in the draft user agreement and privacy policy, then take them out of draft.** Drafts are on the website at `/{locale}/terms` and `/{locale}/privacy` (Chinese and English), linked from the footer, the website sign-in page, and `sitemap.xml`. The app's 我的 rows and both sign-in lines open `https://www.zhipanda.com/zh/terms` and `https://www.zhipanda.com/zh/privacy`. A banner on each page says the text is a draft and is not in effect. App stores can use `https://www.zhipanda.com/zh/privacy` as the public privacy policy URL once you accept the text. Replace every placeholder below, then remove the draft banner in the same change.

  Placeholders, written the same way in the pages:

  - `[运营方名称]` / `[Operator name]`
  - `[联系邮箱]` / `[Contact email]`
  - `[生效日期]` / `[Effective date]`

## Product and content decisions

- **Files attached to 纠错.** The API can register an attachment on a report, but the private upload path behind it (bucket, malware scanning, retention) was retired in #633, and the website does not upload either. Fans can cite a link or a book page. Decide whether fans may upload screenshots or documents; if so, the architecture baseline (§14) has them uploaded to R2 through short-lived presigned URLs the API authorizes and verifies, which still needs malware scanning and a retention rule before the app offers it.

- **猜熊猫 tips and difficulty.** 433 questions are live, generated from the active release ([run 40374378674](https://github.com/SwayingWindmill/PandaAtlas/actions/runs/40374378674)): tips come from confirmed birth dates and current homes (201 have one), and 424 are `easy` because few pandas have a recorded current home. Hand-written recognition tips, or a rerun after `2026.10.26.1` is published, would make them richer.

- **Which pandas the welcome suggests.** First launch offers living pandas that can be visited, youngest first, plus search. A curated list (the pandas most fans arrive for) would serve newcomers better; name the list or the rule.

- **Publish the 科普 drafts.** The app reads articles, terms, face guides and the face challenge. Every entry in `data/curation/learning/learning.json` is `draft`, so production builds do not show it (the public API returns published entries only; a development build previews the file). A writer fills each slot listed in `docs/learning-content-brief.md`. Draft sentences do not need a `[草稿]` or `[draft]` mark. After you review the text, set `status` to `published`, add an https source and the day it was checked, then run `python scripts/curation/build_learning_content_migration.py --write` and ship that migration. Until then the production app says 科普还在写. Knowledge-card and topic records can stay in the file; the app no longer has screens for them.
- **Official posts (官方动态, 官方最近说).** The API's updates feed lists release changes, not posts by bases. Quoting official social posts needs a source, its terms of use and an acquisition decision.
- **On-site mode (我在基地) and wild areas (野外保护区).** Need zone maps, panda-area positions and wild-area places, which no data covers yet.
- **iOS lock-screen widget.** Needs a native widget extension and a development build; out of scope for the Expo-managed app until decided.
