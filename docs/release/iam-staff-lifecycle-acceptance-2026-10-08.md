# IAM-06 — staff identity and access lifecycle acceptance

Ticket: [#430](https://github.com/SwayingWindmill/PandaAtlas/issues/430); parent map: [#424](https://github.com/SwayingWindmill/PandaAtlas/issues/424). This record covers IAM-01 through IAM-05 without changing production roles or generating a second IAM system.

## Evidence boundaries

1. **Live operator/browser acceptance** (already recorded in #432–#434): the owner verified Supabase email sign-in and TOTP AAL2, reviewer invitation through the Chinese console and Mailpit, acceptance from a distinct browser profile, Review accessibility without Publication/Identity privileges, role grant and revoke, and staff suspension/reinstatement. These are owner-confirmed human observations. The local database later showed the reviewer was active and the invitation accepted, but did **not** contain matching staff-owned state/audit/Outbox records; this prior evidence mismatch must not be represented as independently verified production persistence.
2. **Real NestJS/PostgreSQL seam** (`services/api/test/integration/identity-http.integration.spec.ts`): a scoped reviewer invitation remains unprivileged before email verification and activation; an independent `member` contributes a Panda correction; the invited reviewer accepts and *claims* the Review case, while Publication remains forbidden. The manager grants and revokes `audit_reader` with reasons, and unchanged reviewer JWT observes permissions appear/disappear on the next request. The manager suspends and reinstates the reviewer; same valid JWT is denied during suspension and regains only non-revoked Review rights afterward. Stale AAL2 can read staff details but cannot mutate. State events, authorization audits and Outbox share the exact correlation IDs for each transition.
3. **Committed evidence**: in GitHub's disposable Supabase only, `IAM06_COMMIT_EVIDENCE=1` runs that same HTTP lifecycle after the normal integration suite, **commits** it, then queries from a separate PostgreSQL connection. It asserts two durable account state events, matching authorization audit and Outbox facts, a Review case assigned to the reviewer, and the final account state `active`. The command prints a single `IAM-06 committed evidence` line if all assertions pass. Local developer DBs always use a rollback-only transaction. The synthetic signer/JWKS and test sessions prove authorization and persistence, **not** real email delivery or browser TOTP; those remain separately evidenced by the owner.
4. **Production administration**: [IAM-05 PR #435](https://github.com/SwayingWindmill/PandaAtlas/pull/435) CI executed both positive first-admin and signed recovery cases on an empty disposable Supabase. Local bootstrap documentation and [production operator procedure](../runbooks/production-first-administrator.md) cover separate trusted environments. **No real production bootstrap/recovery has been authorized or executed.**

## Verification commands and results

| Gate | Evidence | Result |
| --- | --- | --- |
| Backend real PostgreSQL suite | `npm run ops -- run api.integration` | 21/21 API integration assertions passed after correcting one unordered SQL test expectation; additional node-based administrator tests passed with previously bootstrapped local positive cases skipped by design. |
| Chinese admin browser and IAM accessibility | `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3400 npm run test:admin-shell -w web` | **28/28 passed**, including axe checks for staff invitations, directory and account details. |
| Existing full-site accessibility | `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3400 npm run test:accessibility -w web` | **30/48 passed, 18 failed** in public Editorial Home, Panda directory/lineage (ARIA / contrast), trusted profile test selectors, and map test selectors/options. See separate [#436](https://github.com/SwayingWindmill/PandaAtlas/issues/436). No staff IAM page appears in these failures. Local report: `.release-gate/accessibility-automated.json` (not tracked). |
| Public fan access and governance independence | Existing `fan-http.integration.spec.ts` and `governance-http.integration.spec.ts` within API suite, plus prior IAM browser acceptance | 2 fan tests and 3 governance tests passed. Member remains unprivileged for staff IAM and does not require staff MFA. |
| OpenAPI, TypeScript, lint and Cloudflare deployability | Project development verification and Cloudflare workflow on the IAM-06 PR | See the associated PR checks for final status. |
| Fresh disposable DB committed evidence | GitHub API integration job's `Verify committed IAM lifecycle evidence in disposable Supabase` step | See the associated PR log. It must show the explicit committed-evidence line, not just a successful first suite. |

## Decision and follow-ups

- Preserve the verified four-eyes invariant: the case contributor and reviewer are **different Supabase subjects**; Review refuses a reviewer claiming their own submission.
- Preserve the `identity.staff.read` split: staff GETs require authorized live session, not recent AAL2; real authority mutations still require AAL2, recent authentication, and valid session.
- Preserve out-of-scope public UI failures in [#436](https://github.com/SwayingWindmill/PandaAtlas/issues/436) rather than changing profile/map implementations as part of IAM.
- Do not claim historical staff audit evidence exists in the owner's local database when it does not. Disposable committed evidence establishes the implementation's persistence path; any fresh live operator audit mismatch should be investigated separately before representing it as production evidence.

No production IAM write was part of this verification.
