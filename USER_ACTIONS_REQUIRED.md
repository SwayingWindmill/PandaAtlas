# User actions required

Items that need the owner: credentials, approvals or product decisions. Work that depends on them is skipped until they are done; everything else continues. Newest first within each group.

## Credentials and accounts

- **Ops alert webhook (`OPS_ALERT_WEBHOOK_URL`).** Both `.github/workflows/production-probe.yml` (failed production probes) and the API Worker (`zhipanda-v2-api` for 5xx errors, failed Cron cycles, new community contributions and account-deletion requests) send webhook alerts without PII when configured; leaving it unset keeps alerts off without affecting requests.
  - Set `OPS_ALERT_WEBHOOK_URL` (`https://...` webhook for Feishu, WeCom or generic JSON) as a GitHub Actions repository secret and as a Cloudflare Worker secret (`wrangler secret put OPS_ALERT_WEBHOOK_URL --name zhipanda-v2-api`).
  - Optionally set `OPS_ALERT_WEBHOOK_FORMAT` (`feishu`, `wecom` or `generic`, defaulting to `feishu`) as a GitHub Actions repository variable and Worker environment variable/secret if not using a Feishu bot webhook.

- **Supabase Auth: leaked-password protection.** The Supabase security advisor flags it as off (Authentication → Policies → Password security, which checks passwords against HaveIBeenPwned). Fans sign in with email codes and staff with email codes plus TOTP, so no password is in use today; turning it on costs nothing and covers any future password sign-in. It is an account setting, so it is yours to switch.

- **App builds and store release.** The app (`com.zhipanda.app`) has no EAS project yet, so it runs only in Expo Go and on the web. Releasing it needs an Expo account to own the EAS project, an Apple Developer Program membership and a Google Play Console account; then `eas init`, `eas build` and `eas submit` (the same accounts cover the push credentials below). `apps/mobile/eas.json` already has the build profiles (Xcode 27.1 image via the `sdk-58` alias).

- **iOS development build.** Expo Go runs the app, but it cannot carry the app's own tab and toolbar symbols (`react-native-nano-icons`), so it shows the PNG fallbacks. To see the real build on your iPhone, from `apps/mobile`:
  1. `npx eas-cli login` with the Expo account that should own the app.
  2. `npx eas-cli init`, which creates the EAS project and writes its `extra.eas.projectId` (and `owner`) into `app.json`; commit that change.
  3. `npx eas-cli device:create` and open the link on the iPhone to register it (needs the Apple Developer Program membership; EAS asks for the Apple ID on the first iOS build and manages the certificates).
  4. `npx eas-cli build --profile development --platform ios`, then install it from the link or QR code EAS prints. On iOS 16 or later, turn on Settings → Privacy & Security → Developer Mode when asked.
  5. `npx expo start --dev-client` and open the project from the development build. Rebuild only when native dependencies or `app.json` plugins change; JavaScript changes reload as usual.
  - Without an Apple membership, `npx eas-cli build --profile development-simulator --platform ios` builds for the iOS Simulator on a Mac instead.

- **Push notifications.** Reminders (the canvas 提醒 sheet) need Expo/EAS push with an APNs key (Apple Developer account) and an FCM server key (Firebase). The in-app notification inbox and its preferences work without them.
- **Sign in with Apple / WeChat / phone.** The canvas login offers them; the app signs in with email codes today. Apple needs an Apple Developer team and a Services ID configured in Supabase Auth (also required by App Review once any third-party login ships); WeChat needs a WeChat Open Platform app; phone codes need an SMS provider (e.g. Twilio) configured in Supabase Auth.

## Legal

- **Fill in the draft user agreement and privacy policy, then take them out of draft.** Drafts are on the website at `/{locale}/terms` and `/{locale}/privacy` (Chinese and English), linked from the footer, the website sign-in page, and `sitemap.xml`. The app's 我的 rows and both sign-in lines open `https://www.zhipanda.com/zh/terms` and `https://www.zhipanda.com/zh/privacy`. A banner on each page says the text is a draft and is not in effect. App stores can use `https://www.zhipanda.com/zh/privacy` as the public privacy policy URL once you accept the text. Replace every placeholder below, then remove the draft banner in the same change.

  Placeholders, written the same way in the pages:

  - `[运营方名称]` / `[Operator name]`
  - `[联系邮箱]` / `[Contact email]`
  - `[生效日期]` / `[Effective date]`

## Product and content decisions

- **猜熊猫 tips and difficulty.** 433 questions are live, generated from the active release ([run 40374378674](https://github.com/SwayingWindmill/PandaAtlas/actions/runs/40374378674)): tips come from confirmed birth dates and current homes (201 have one), and 424 are `easy` because few pandas have a recorded current home. Hand-written recognition tips, or a rerun now that `2026.10.31.1` brought more current homes, would make them richer.

- **Which pandas the welcome suggests.** First launch offers living pandas that can be visited, youngest first, plus search. A curated list (the pandas most fans arrive for) would serve newcomers better; name the list or the rule.

- **Official posts (官方动态, 官方最近说).** The API's updates feed lists release changes, not posts by bases. Quoting official social posts needs a source, its terms of use and an acquisition decision.
- **On-site mode (我在基地) and wild areas (野外保护区).** Need zone maps, panda-area positions and wild-area places, which no data covers yet.
- **iOS lock-screen widget.** Needs a native widget extension and a development build; out of scope for the Expo-managed app until decided.
