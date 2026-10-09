# Admin UX/UI V2 — all screens, task-first acceptance

**Tracking:** [#444](https://github.com/SwayingWindmill/PandaAtlas/issues/444). Implementation follows Matt Pocock's issue → TDD → implement → Standards/Spec review → PR process, and the global Jakub `better-interface` / six domain skills. The separately user-invoked `interface-review` applies to changed surfaces. A functional green CI result **never** substitutes for viewing the real page.

## Shared contract

All Admin screens must answer, in ordinary language: **What am I reviewing? Why does it matter? What evidence can I check? What am I allowed to do next? What happens after I do it?**

- Prioritize the operator's task, case/release/invitation status and next step; keep UUIDs, hashes, capabilities and technical codes available as secondary details.
- Reuse Kiranism layout patterns and CLI-provided shadcn primitives, existing TanStack Query/Table, forms and nuqs. Never create a parallel Admin design system or a generic operation runner.
- All counts and statuses must originate in the authorized V2 API; never invent a panda name, old value, evidence confirmation, actor, release impact or queue KPI.
- Keep dangerous or irreversible actions separate from inspection. Tell the user what will change and preserve IAM permissions, AAL2, independent approval and NestJS enforcement.
- Verify loading, empty, network error, read-only, no permission, active selection, keyboard focus and desktop 1440px states. Provide a real user journey and before/after screenshots. Desktop is the product design priority; accessible controls and responsive overflow still matter.

## Route-by-route user tasks

| Route | Operator question and primary task | Main UX risk | Delivery |
|---|---|---|---|
| `/admin` | What requires attention now? Open actionable queues | Account IDs and duplicate navigation instead of tasks | [#442](https://github.com/SwayingWindmill/PandaAtlas/issues/442), Draft PR #443 |
| `/admin/reviews` | What did the contributor propose? Check original source; claim, decide, hand off | Raw fields/JSON, UUID headers, duplicate claim, requirements revealed only by backend errors | [#445](https://github.com/SwayingWindmill/PandaAtlas/issues/445), first Review slice in progress |
| `/admin/moderation` | What happened to the account? Is an appeal valid? What is the impact of this action? | Technical state and sanction vocabulary ahead of evidence and consequences | #445 |
| `/admin/curation` | Which facts are proposed and supported? Can a different approver accept them? | Source IDs, no trustworthy old-value comparison available; four-eyes meaning unclear | [#446](https://github.com/SwayingWindmill/PandaAtlas/issues/446) |
| `/admin/publication` | Which version is live? What changes? Is activation, suspension or rollback appropriate? | Construction form precedes current public state; high-impact actions mixed with reading | #446 |
| `/admin/audit/evidence` | Which event occurred, when, and what object is involved? | Raw internal event codes and UUIDs hide business meaning | [#447](https://github.com/SwayingWindmill/PandaAtlas/issues/447) |
| `/admin/staff/invitations` | Whom can I invite, and how do I know the invitation worked? | Invitation and enrollment state vocabulary | #447 |
| `/admin/staff/roles` | Which roles are active and why? Can I grant or revoke safely? | Raw permission strings, privileged operations near read-only data | #447 |
| `/admin/capabilities` | Which workflows am I allowed to do, and who can grant access? | A flat list of technical capability keys | #447 |
| `/admin/security/mfa` | How can I finish identity verification and return to my task? | Technical assurance-level terms and unclear next action | #447 |

## Release discipline

Changes are completed per **whole user task**, not by changing colors everywhere at once. Each slice retains its own tests, exact source data, local desktop screenshot and issue/PR review. The parent issue remains open until all routes above have recorded visual and task-based acceptance, including a cross-route consistency pass.

### Review first-slice inspection (#445)

The local desktop review uses `.release-gate/admin-visual-review/review-viewport.jpg` as the earlier page reference and `.release-gate/admin-review-ux/review-after-1440.jpg` as the new 1440px screenshot, with a **synthetic assigned review case**, not production facts. The visual review identified a half-empty case list beside a crowded evidence panel. The layout now allocates more width to the case evidence and reduces the queue to a target panda reference, state and waiting duration. It does not manufacture panda names from IDs.

- `better-layout` / `better-typography`: makes the current submission and source contents first-class and moves raw case/assignee IDs behind a disclosure. Uses shadcn `Card` and `Badge` from the project's official CLI-installed primitives, not new copy-pasted domain widgets.
- `better-writing`: renders supported field values like `profile.sex = female` as `性别：雌性`, explicitly labels unrecognized internal fields, and explains the actor's current ownership/next steps.
- `better-accessibility` / `better-ui`: keyboard-reachable external original-source links with safe HTTP(S) URLs, active-state affordances, read-only browsing when another reviewer owns the case. WCAG axe is tested at the Review surface.
- `better-colors`: replaces the incongruous dark case header with the existing light shadcn/Kiranism visual language; status uses a neutral Badge.
- **Backend parity**: evidence verification requires both canonical source ID and normalized locator when approved; UI no longer invites invalid empty submissions. A review decision requires the current assignee: the button stays disabled without ownership. No authorization logic was moved out of NestJS.

**Unfinished:** moderation remains within #445. Full lifecycle and error-state UX of other routes is still open in #446/#447; the screenshots and tests for this Review first slice are not acceptance of those surfaces.
