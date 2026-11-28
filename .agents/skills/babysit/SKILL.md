---
name: babysit
description: Watch an open PR — fix failing CI, handle review comments, resolve conflicts, and drive it to a mergeable green state. Use after opening a PR or when asked to shepherd CI/comments on a PR.
---

# Babysit a PR

On Antigravity, read [`../poteto-mode/references/agy-tools.md`](../poteto-mode/references/agy-tools.md) before running background checks (`schedule` replaces `loop`, `ask_question` replaces `AskUserQuestion`; run `gh` and `git` natively per `AGENTS.md`).

Drive an open PR to green checks and resolved review threads using `gh`.

## Steps

1. **Fetch PR state (`gh`).**

   ```bash
   gh pr view <number> --json number,title,state,mergeable,reviewDecision,statusCheckRollup,mergeStateStatus,comments,reviews,baseRefName,headRefOid,autoMergeRequest
   ```

2. **Triage in priority order.**
   - **Merge conflicts** (`mergeStateStatus == DIRTY`): run sibling `../fix-merge-conflicts/SKILL.md`. Only force-push (`--force-with-lease`) on an isolated branch you own.
   - **Failing CI checks** (`statusCheckRollup` failure): run sibling `../fix-ci/SKILL.md`. Root-cause the failure cleanly, verify locally, commit, and `git push`.
   - **Human review comments**: run sibling `../get-pr-comments/SKILL.md`, then fix genuine defects/issues cleanly and quote what changed. If a comment hinges on an ambiguous product decision, stop and ask the user via `ask_question`.
   - **Automated review bots**: triage `fix` / `dismiss` / `ask` skeptically per [`../poteto-mode/references/bugbot-triage.md`](../poteto-mode/references/bugbot-triage.md). Default to asking the user on security, auth, migration, data-integrity, or high-severity findings.

3. **Watch checks cleanly.**
   - Active CI run: watch via `gh pr checks --watch` (blocks until completion, avoiding unnecessary timer chatter).
   - Asynchronous follow-ups: use Antigravity's `schedule` tool rather than shell `sleep`.

4. **When to stop / merge (`AGENTS.md` §7).**
   - Do NOT enable auto-merge (`gh pr merge --auto`).
   - Only merge PRs opened in this conversation (any PR opened outside this conversation requires explicit user consent).
   - Before merging a PR opened in this conversation: confirm all required CI checks (`Development Verification` and `Mobile E2E`) are green, conflicts and review blockers are resolved, an independent reviewer (that did not write the change) gave `PASS` on the exact head SHA, and `baseRefName === "main"` (stop and ask if not `main`). Then merge with `gh pr merge <number> --squash --match-head-commit <reviewed-head>` (do NOT pass `--delete-branch`), clean up only the local worktree and branch created for this task, and watch `Development Verification` on `main`.
   - After 3 failed fix -> push -> recheck cycles without turning green -> stop, summarize remaining failures with exact logs/outputs, and ask the user.

5. **Report.** Summarize fixes committed (SHAs), review comments addressed or dismissed with evidence, independent reviewer verdict, and final PR / merge status.

## Hard rules

- Never weaken assertions just to turn a red test green.
- Never bypass git hooks (`--no-verify`) or skip required CI gates.
- Never mark a draft PR ready (`gh pr ready`) while checks fail or unaddressed review blockers remain.
- Apply `interrogate` before pushing if a fix introduces a non-trivial design shift, and `unslop` on any PR comments written.
