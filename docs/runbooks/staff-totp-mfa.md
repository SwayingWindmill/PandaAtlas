# PandaAtlas staff TOTP enrollment and verification

The staffed governance console uses **Supabase Auth** for email OTP and authenticator-app TOTP. PandaAtlas never generates or stores TOTP secrets itself. NestJS remains the authority for authorization decisions, including the existing AAL2 + recent-auth + live-session requirements for Identity role/account changes and high-risk archive work.

Local Supabase configuration explicitly enables both `auth.mfa.totp.enroll_enabled` and `auth.mfa.totp.verify_enabled`. After changing them, run `npm run infra:stop` and `npm run infra:start` to recreate local Auth **without resetting the database**. Confirm the running Auth container reports `GOTRUE_MFA_TOTP_ENROLL_ENABLED=true` and `GOTRUE_MFA_TOTP_VERIFY_ENABLED=true`. Before staff MFA is used on managed production, enable TOTP in that Supabase project's authentication MFA settings as well.

## First-time staff setup

1. Log in normally at `/auth/login?next=%2Fadmin` using the email OTP. Public panda fans are not asked to enroll staff MFA.
2. Open the **账号安全** item in the Chinese admin sidebar, or select the security prompt from the workbench. The page is only shown when the account's current NestJS capability snapshot contains `admin.shell.access`.
3. Choose **开始设置**. Scan the supplied Supabase Auth TOTP QR in an authenticator app; if scanning is unavailable, enter the one-time setup secret manually. Never send this secret by email or paste it into an issue.
4. Submit the current six-digit code using **绑定并验证**. Supabase verifies the second factor, marks enrollment verified and upgrades the current session to `aal2`. Navigate back to the admin workspace.

## Subsequent staff login

- Email OTP establishes `aal1`. If a verified TOTP factor already exists, the login flow redirects staff to `/admin/security/mfa` for the second-factor challenge.
- Enter the six-digit authenticator code. Supabase `challengeAndVerify` upgrades the **real Supabase session**, which NestJS verifies using its existing JWT, capabilities and authorization snapshot.
- An incorrect code is rejected; it cannot upgrade the session. No TOTP code or secret is written into the URL, any PandaAtlas database table or logs.
- The route query's optional `next` path is accepted only for a local `/admin` route.

## Recovery

Supabase Auth **does not issue general MFA recovery codes**; do not promise them to staff. Staff should register an additional verified factor through an approved future self-service workflow before losing the original authenticator. If the last factor is lost, use a separately authorized, audited recovery procedure through the Supabase operator account; do not weaken NestJS's AAL2 policies or promote a JWT claim manually.

## Acceptance

Automated admin-shell tests cover staff navigation and denied access to this settings page. Real QR enrollment and successful TOTP challenge require a person controlling an authenticator to complete the interactive acceptance; report that step separately rather than treating a mocked browser assertion as proof of `aal2`.

Sources: [Supabase TOTP flow](https://supabase.com/docs/guides/auth/auth-mfa/totp), [Supabase TOTP enroll](https://supabase.com/docs/reference/javascript/auth-mfa-enroll), [Supabase challenge and verify](https://supabase.com/docs/reference/javascript/auth-mfa-challengeandverify).
