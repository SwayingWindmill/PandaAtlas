# User actions required

Items that need the owner: credentials, approvals or product decisions. Work that depends on them is skipped until they are done; everything else continues. Newest first within each group.

## Approvals

- **Publish content release `2026.10.26.1`.** `release.build` built it from `data/release-manifests/2026.10.26.1.json`; review the change list in the run summary, then run `release.publish` with the same manifest (runbook: `docs/runbooks/production-release.md#publish-a-content-release`). Institutions stay hidden on the website and in the app until then.

## Credentials and accounts

- **Push notifications.** Reminders (the canvas 提醒 sheet) need Expo/EAS push with an APNs key (Apple Developer account) and an FCM server key (Firebase). The in-app notification inbox and its preferences work without them.
- **Map on Android.** The 找熊猫 map needs either a Google Maps Android API key (react-native-maps) or a chosen MapLibre tile provider and its key. iOS can use Apple Maps without a key; the decision covers both.
- **Sign in with Apple / WeChat / phone.** The canvas login offers them; the app signs in with email codes today. Apple needs an Apple Developer team and a Services ID configured in Supabase Auth (also required by App Review once any third-party login ships); WeChat needs a WeChat Open Platform app; phone codes need an SMS provider (e.g. Twilio) configured in Supabase Auth.

## Legal

- **User agreement and privacy policy.** The canvas login asks fans to accept them, and both app stores require a privacy policy URL, but no such pages exist (website issue #348). The app's sign-in shows no consent line until the documents are written and published.

## Product and content decisions

- **猜熊猫 questions.** The app's 猜熊猫 works end to end, but production has no published question (the question endpoint answers 404), so it shows 现在还没有可以猜的题目。 There is no authoring tool or import for questions. Decide who picks the photo, the three wrong options and the recognition tips; a curated JSON plus a migration (like `data/curation/institutions`) or an admin form are both small once the source of questions is decided.

- **Learning content (科普, 专题, 认脸指南, 认脸挑战).** No content model or text exists; the canvas uses placeholders such as `[形状和左右差别]`. Decide the content and who writes it before a schema is built for it.
- **Official posts (官方动态, 官方最近说).** The API's updates feed lists release changes, not posts by bases. Quoting official social posts needs a source, its terms of use and an acquisition decision.
- **On-site mode (我在基地) and wild areas (野外保护区).** Need zone maps, panda-area positions and wild-area places, which no data covers yet.
- **iOS lock-screen widget.** Needs a native widget extension and a development build; out of scope for the Expo-managed app until decided.
