# Admin UX V3 — Staff invitations and bounded desktop review (#467)

## Delivery boundary

This is a **stacked Draft UX slice** under #444 and #465, not a production deployment or a claim of final Kiranism equivalence. The invitation route remains `/admin/staff/invitations`; the staff directory remains `/admin/staff/roles`. Backend permissions, invitation lifecycle and API contracts are unchanged.

## Invitation workflow

The previous route rendered an invitation form and an unsorted, non-searchable email/status list. The 1440px fixture review showed an oversized empty records area with no path to find a specific invitation after the list grows. The updated route:

- Keeps one primary task: send an invite to an **archive reviewer** when the server grants `identity.account.manage`. Staff with only `identity.staff.read` see the full progress list but **never** the mutation form. The existing route-level capability boundary is preserved.
- Shows an address-confirming success message after the POST response, retaining the existing login/recent-auth/TOTP recovery links. A failure keeps the address intact, gives a recovery action or retriable explanation, and does not claim success. No optimistic fake invitation.
- Filters **server-returned** invitations by email and `pending`, `accepted` or unrecognized status. The operator can clear filters and sees the true matched/total count. Unknown status is **not** interpreted as expired, revoked or rejected.
- Uses the backend's `createdAt` when present, formatted explicitly in Beijing time. When missing/invalid, the page reports that creation time was not provided rather than inventing it.
- Does **not** offer resend, cancel, invitation expiry or manual activation, because those operations do not exist in the current endpoint. The login flow continues to accept the invite server-side.
- Reuses project Button, Input, Badge and Skeleton, plus native form and select controls. No additional runtime or shadcn registry dependency.

### New visual evidence

Actual 1440×900 Edge capture with **synthetic fixture** records: `.release-gate/admin-ux-467/invitations-1440.png`. Previous invitation reference: `.release-gate/admin-ux-461/staff-invitations-1440.png`. Screenshots were opened and compared. Neither is proof of the production data distribution.

## Cross-page visual check — what was actually inspected

The six existing 1440px visual artifacts below were inspected alongside the freshly captured invitation page. They are **historical branch artifacts** produced during the individual V3 slices, not new end-to-end captures of all routes after #467. A visual judgment about the current global shell or all data states cannot be inferred from them.

| Route | Evidence reviewed | Finding / remaining work |
| --- | --- | --- |
| `/admin` | `admin-ux-unified-v3/overview-v3-1440.png` | Work queue and latest action are substantially clearer than the original card grid; screenshot predates later sidebar consolidation, so global shell needs one final synchronized capture |
| `/admin/reviews` | `admin-ux-455/review-action-viewport-1440.png` | Evidence review and decision forms still compete vertically in the right column; prioritize a single visible next operation and test long case/evidence scroll at 1440px |
| `/admin/curation` | `admin-ux-457/curation-after-1440.png` | Queue/detail split and explicit unknown current fact are good; source and verification identifiers must remain discoverable but less visually prominent than the actual fact change |
| `/admin/publication` | `admin-ux-459/publication-after-1440.png` | Current vs candidate state reads well; aggregate delta counts do not substitute for field-level difference inspection and high-impact release understanding |
| `/admin/audit/evidence` | `admin-ux-463/audit-refined-1150.jpg` | Compact recent-event/detail layout; historic capture at 1150px, **not** proof of final 1440px behavior or dense audit data |
| `/admin/staff/roles` | `admin-ux-465/staff-directory-1440.png` | Directory + readable role detail now has clear information hierarchy; current screenshot is synthetic and covers the filtered state, not every permission combination |
| `/admin/staff/invitations` | `admin-ux-467/invitations-1440.png` | New capture reviewed: email search, state select, count, creation time and short progress rows align with the staff directory; no extra nested-card stack |
| `/admin/capabilities` | `admin-ux-461/account-1440.png` | Account grouping artifact predates newer navigation; permissions remain dependent on actual capability data |
| `/admin/moderation`, `/admin/security/mfa` | No fresh visual capture in this pass | **Not visually verified**. Existing Playwright flows protect route behavior but do not establish visual acceptance |

## Remaining acceptance gaps under #444

1. **High:** Complete a fresh, same-commit, 1440px desktop capture for every Admin route including Moderation/MFA, with representative data, long records, empty/error/read-only and action-confirmation states. The historical artifacts above are not interchangeable with a current full review.
2. **Medium:** Review's evidence/decision forms need a short, unambiguous task flow at 1440px, without simultaneously exposing every multi-stage form.
3. **Medium:** Publication needs operator-readable impact exploration beyond aggregate counts before any irreversible activation; data must come from real typed facts.
4. **Medium:** Validate shared top navigation/breadcrumb wording, focus and consistent row/button density in one cross-page live walkthrough; prior snapshots have different sidebar states and different revisions.

The new invitation page alone was captured at the final component revision; keyboard behavior and axe checks are covered by the Admin browser tests. Impeccable Operate and Jakub's six-domain principles were used in this in-thread review; this is **not** an independent designer or owner acceptance sign-off.
