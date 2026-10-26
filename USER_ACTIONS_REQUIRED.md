# User actions required

Items that need the owner: credentials, approvals or product decisions. Work that depends on them is skipped until they are done; everything else continues. Newest first within each group.

## Approvals

- **Two-step verification before export and deletion.** The API's `privacy.request.manage` policy requires AAL2 and a recent sign-in, so the app asks fans to set up an authenticator app (Supabase Auth TOTP) before their first data export or account deletion. Keep this, or decide on a lighter step (for example a fresh email code, which gives recent authentication but not AAL2) and change the policy in a migration.

- **Publish content release `2026.10.26.1`.** `release.build` built it from `data/release-manifests/2026.10.26.1.json`; review the change list in the run summary, then run `release.publish` with the same manifest (runbook: `docs/runbooks/production-release.md#publish-a-content-release`). Institutions stay hidden on the website and in the app until then.

## Credentials and accounts

- **App builds and store release.** The app (`com.zhipanda.app`) has no EAS project yet, so it runs only in development. Releasing it needs an Expo account to own the EAS project, an Apple Developer Program membership and a Google Play Console account; then `eas init`, `eas build` and `eas submit` (the same accounts cover the push credentials below).

- **Push notifications.** Reminders (the canvas 提醒 sheet) need Expo/EAS push with an APNs key (Apple Developer account) and an FCM server key (Firebase). The in-app notification inbox and its preferences work without them.
- **Map on Android.** The 找熊猫 map needs either a Google Maps Android API key (react-native-maps) or a chosen MapLibre tile provider and its key. iOS can use Apple Maps without a key; the decision covers both.
- **Sign in with Apple / WeChat / phone.** The canvas login offers them; the app signs in with email codes today. Apple needs an Apple Developer team and a Services ID configured in Supabase Auth (also required by App Review once any third-party login ships); WeChat needs a WeChat Open Platform app; phone codes need an SMS provider (e.g. Twilio) configured in Supabase Auth.

## Legal

- **User agreement and privacy policy.** The canvas login asks fans to accept them, and both app stores require a privacy policy URL, but no such pages exist (website issue #348). The app's sign-in shows no consent line until the documents are written and published.

- **What account deletion keeps.** Deleting an account erases follows, 见过, game records, notifications and the identity, but leaves submitted 纠错 (contributions) in the review records. The app's deletion text names only what is erased. Decide whether contributions are kept, anonymized or deleted, and say so in the privacy policy (#348).

## Product and content decisions

- **Which pandas the welcome suggests.** First launch offers living pandas that can be visited, youngest first, plus search. A curated list (the pandas most fans arrive for) would serve newcomers better; name the list or the rule.
- **Add the first 猜熊猫 questions.** The app's 猜熊猫 answers 404 in production because no question is published. The `curation.guess-questions` batch operation now draws them from the active release (one per living panda with a public cover photo; 433 from the active release), and the manifest `data/curation/guess-questions/2026.10.27.1.json` is merged. Approve a run when you want them live (runbook: `docs/runbooks/production-release.md#add-猜熊猫-questions`), ideally after publishing `2026.10.26.1` so its new pandas are included. Hand-written recognition tips can replace the generated ones later.

- **Learning content (科普, 专题, 认脸指南, 认脸挑战).** No content model or text exists; the canvas uses placeholders such as `[形状和左右差别]`. Decide the content and who writes it before a schema is built for it.
- **Official posts (官方动态, 官方最近说).** The API's updates feed lists release changes, not posts by bases. Quoting official social posts needs a source, its terms of use and an acquisition decision.
- **On-site mode (我在基地) and wild areas (野外保护区).** Need zone maps, panda-area positions and wild-area places, which no data covers yet.
- **iOS lock-screen widget.** Needs a native widget extension and a development build; out of scope for the Expo-managed app until decided.
