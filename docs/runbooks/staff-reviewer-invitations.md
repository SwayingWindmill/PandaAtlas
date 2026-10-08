# Staff reviewer invitations — PandaAtlas IAM-02

Staff identities are authenticated by **Supabase Auth** and authorized by the private PostgreSQL `identity` schema behind NestJS; an email address or JWT metadata is never a role grant. This vertical slice deliberately invites one **reviewer** role, not a configurable administrator/publisher.

## Invite a reviewer

1. A verified staff administrator signs in to PandaAtlas, completes TOTP step-up to AAL2 and has recent interactive authentication. The server requires both `identity.account.manage` and `identity.role.manage`, plus a live Supabase session.
2. In the Chinese admin console, visit **治理 → 工作人员**, enter the colleague's email and select **发送邀请**.
3. The NestJS server uses the **Supabase Auth Admin SDK**, not an application password or a browser token, to create an *unconfirmed* Supabase identity and deliver its invitation email. The server securely stores a pending invitation bound to the returned **Supabase user UUID**; a pending invite confers **no reviewer role**.
4. Only after the invited individual verifies that address by following the invitation link does the login flow call `POST /api/v2/me/staff-invitation/accept` through the authenticated Next.js proxy. NestJS matches the JWT UUID to the invited UUID and the verified Auth email, and atomically records the `member` and `reviewer` grants, append-only authorization audit, outbox events and accepted invitation status.
5. The reviewer reaches the existing review queue. They cannot access publishing, Curation approval, privacy operations or Identity management APIs. Application authorization is checked from PostgreSQL on every protected request.

## Managed runtime configuration

- Set the trusted **`SUPABASE_SECRET_KEY`** in the **NestJS API / Cloudflare Worker secret bindings**. Never place it in `NEXT_PUBLIC_*`, source control, the database, web responses or logs. It is deliberately optional at application startup, but the invite operation fails closed if absent.
- `SUPABASE_URL` is the same managed Auth project used by the API's JWT verifier. The staff email invite redirects to `/auth/login?next=/admin/reviews` relative to the first configured `CORS_ALLOW_ORIGINS` origin, which must be listed in Supabase Auth's redirect allowlist.
- In local Windows development, `npm run dev:admin` passes the pinned local Supabase's server-only secret into the NestJS API; the browser sees only the public publishable key. Invitations are delivered to Mailpit at `http://127.0.0.1:54324`, not a real mailbox.

## Collision, retry and recovery rules

- Supabase rejects sending a new invitation to an already-confirmed identity. Treat this as a conflict; this flow never upgrades an existing account simply because an operator typed its email.
- Duplicate or already-pending invites are conflicts, not additional role grants. The login acceptance command is idempotent after the invitation is accepted and cannot resurrect revoked role assignments.
- If Supabase sends an invite but PostgreSQL persistence fails, **no PandaAtlas staff role is granted**. A trusted operator must investigate the orphan unconfirmed Auth record and retry only after resolving it, rather than automatically inventing identity links or deleting unrelated users.
- An invalid, unverified, suspended or different Auth identity cannot accept somebody else's invitation; logs and audit entries contain identifiers and reasons, not access tokens, link tokens or OTPs.

## Checks

Use NestJS HTTP integration tests to prove ordinary users cannot list or send invitations, and cannot activate themselves without a pre-existing invitation. Use the Chinese Kiranism admin Playwright suite for visible invite and capability-gated routes. A real invitation and verified recipient login remain a separate operator acceptance step; **a mocked email provider or UI test is not proof of actual email delivery**.

Sources: [Supabase Auth inviting users](https://supabase.com/docs/guides/auth/users), [inviteUserByEmail](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail), [redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls).
