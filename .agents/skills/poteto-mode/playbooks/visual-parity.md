### Visual parity

**You own pixel-exact equivalence. The baseline is the spec. Do not tamper with it.** Equivalence is proven by image/DOM comparison, never eyeballed.

1. Establish the baseline first before migrating or refactoring: capture reference screenshots across component states and viewports (via `apps/mobile/.claude/skills/verify/SKILL.md` for mobile 390×844 or Playwright/`npm run smoke:web` for desktop web) into `.audit/verify/baseline/`. No baseline means no parity claim.
2. Hold strict anti-shortcut rules: never weaken tolerance, alter baseline fixtures, or restructure unrelated assertions to force a diff pass. If the baseline itself looks broken, stop and ask the user.
3. Migrate one component/route at a time cleanly (`Workspace: "share"` if parallelizing shared primitives first as a blocking phase; pass the main worktree's explicit `.audit/verify/baseline/` path to shared workers since `Workspace: "share"` does not inherit untracked `.audit/` directories).
4. Compare each migrated surface against baseline using automated pixel/visual diff via Playwright. Any unexpected non-zero diff fails until investigated and fixed.
5. Open a PR per logical batch using [`opening-a-pr.md`](opening-a-pr.md) with before/after visual evidence.

**Reply:** components migrated, pixel-diff verdict for each, baseline artifact location under `.audit/verify/`, and remaining work.
