### Shipping

Resolve the repo driver/verification surface first (`apps/mobile/.claude/skills/verify/SKILL.md`, `npm run smoke:web`, or `npm run verify:dev`).

**You own what lands. Verify each PR independently, land only the contiguous verified run from the bottom up, then keep your hands off the stack.** Landing requires merge authority: only PRs opened in this conversation may be merged directly (merging any PR opened outside this conversation requires explicit user consent), and auto-merge (`gh pr merge --auto`) is forbidden.

1. **Resolve and inspect the chain before merging.** Capture bottom-to-top PR numbers, head branches, head SHAs, base branches, base SHAs, and destination (`main`). Read [`merge-safety.md`](../references/merge-safety.md) before merging, rebasing, or retargeting. Assign an independent verifier/reviewer subagent per PR (`invoke_subagent`, `TypeName: "research"` or read-only `"self"`) that did not write the change to review the PR diff and verify real behavior (`apps/mobile/.claude/skills/verify/SKILL.md`, `npm run smoke:web`, `npm run verify:dev -- --base origin/<base>`) and record `PASS`, `PASS+NOTES`, or `FAIL` along with head SHA, base SHA, base branch, and stable `git patch-id` (`git diff <base>..<head> | git patch-id --stable`). Green CI, own review, and tests alone are NOT sufficient.
2. **Land only the contiguous verified prefix from the bottom PR up.** Stop before the first PR without independent `PASS` / `PASS+NOTES` (if an independent higher PR wants to land alone, retarget it onto `main` and re-verify cleanly).
3. **Re-check verdicts after restacks.** Compare `git patch-id` against the verified SHA after rebasing a child onto updated `origin/main`. Re-run checks and independent review on the new head SHA before merging.
4. **Merge bottom-up one PR at a time with head guard** (using native `gh` and `git`):
   - Inspect live state via `gh pr view <pr> --json number,state,headRefName,headRefOid,baseRefName,autoMergeRequest,mergeStateStatus` right before merging. Confirm `baseRefName === "main"` (if not `main`, stop and ask the user).
   - Cancel any accidental auto-merge or queue entry before rewriting/retargeting (`gh pr merge <desc> --disable-auto`).
   - Wait for `Development Verification` and `Mobile E2E` to finish green (`gh pr checks <pr> --watch`).
   - Merge with `gh pr merge <pr> --squash --match-head-commit <verified-head>` (do NOT pass `--delete-branch`; GitHub deletes the remote branch on merge).
   - Read back `gh pr view <pr> --json state,headRefOid,baseRefName,mergeCommit`, fetch `origin/main`, verify `git merge-base --is-ancestor <merge-commit> origin/main`, clean up only the local worktree and local branch created for that PR, and watch `Development Verification` on `main`.
   - Retarget the next child PR to `main` (`gh pr edit <next-pr> --base main`), rebase onto `origin/main` cleanly from the recorded old parent tip, push with `--force-with-lease=refs/heads/<child>:<captured-remote-head>`, wait for green CI (`gh pr checks <next-pr> --watch`), and re-verify on the new head before advancing.
5. **Leave uninvolved stack branches untouched while a frontier PR lands.** Watch CI with `gh pr checks --watch` (plus `schedule` only if asynchronous bots remain).
6. **Stop at the verified ceiling.** Extending further starts a fresh pass from step 1. Stop before triggering any `Production` environment deploy unless the user explicitly approves it in this conversation.

**Reply:** verified run and ceiling, per-PR verdicts/reviewers, landed PRs and merge commits verified on `main`, and what remains unmerged.
