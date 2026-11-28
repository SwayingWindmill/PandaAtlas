### Opening a PR

Invoked at the end of every other playbook (unless the task forbids opening a PR). Follow `AGENTS.md` §7.

Work from an isolated sibling git worktree (`../PandaAtlas-<task>` off `origin/main`, never the shared checkout `E:\Code\PandaAtlas`), stop child subagents (`manage_subagents`), keep unrelated work, `.audit/`, and temporary `apps/mobile/package.json` debug edits out of git, and never run `git stash`. Rebase into small, landable commits (`type(scope): subject`, LF line endings). Before committing, run [`deslop`](../../deslop/SKILL.md) over the diff, [`no-comments`](../../no-comments/SKILL.md) over touched code paths, [`make-pr-easy-to-review`](../../make-pr-easy-to-review/SKILL.md), [`unslop`](../../unslop/SKILL.md) on PR copy/docs, and `npm run verify:dev` (or `npm run verify:dev -- --base origin/main` after committing).

Title and commit messages: write commit subjects, commit bodies, PR titles, and PR bodies in Chinese, keeping the Conventional Commits `type(scope):` prefix in English. Fill the sections of `.github/PULL_REQUEST_TEMPLATE.md` (`## Why`, `## What changed`, `## Scope`, `## Tradeoffs`, `## Blast Radius`, `## Verification`), dropping empty ones if needed.

Push (`git push -u origin <branch>`) and open the PR ready (never `--draft`) via `gh pr create`. Post the URL.

#### Landing gate (PRs opened in this conversation)

`main` has the ruleset "main: CI must pass": the three Development Verification checks and the two Mobile E2E checks are required, and nobody can bypass them. Merging any PR opened outside this conversation requires the user's explicit consent. For a PR you opened in this conversation:

- Do NOT run `gh pr merge --auto` and do NOT enable auto-merge in GitHub (an armed auto-merge could land an unreviewed head if another commit is pushed).

1. Wait for the PR's `Development Verification` and `Mobile E2E` checks to finish green (`gh pr checks <n> --watch` or `gh run watch <id> --exit-status`).
2. Get an independent `PASS` from a reviewer that did not write the change (for example, a fresh `thermo-nuclear-review` subagent on the PR diff). Your own review, tests, and CI do NOT count. Wait for every reviewer started on this PR (including ones briefed on an older head) before merging; any `FAIL` on the head you will merge blocks it. Record the reviewer and verdict in `## Verification`.
3. Confirm the PR's base is `main` (`gh pr view <n> --json baseRefName`). If the base is not `main`, stop and ask the user. Merge immediately with `gh pr merge <n> --squash --match-head-commit <reviewed-head-sha>` (do NOT pass `--delete-branch`; GitHub deletes the remote branch on merge). If you pushed after the review, steps 1 and 2 start over.
4. Clean up ONLY the worktree and local branch created for this task per `AGENTS.md` §7 (`git worktree remove`, `git branch -D`, `git worktree prune`, `git fetch --prune origin`). Never remove worktrees created by other sessions without explicit user consent.
5. Watch the `Development Verification` run on `main` for the merge commit.
6. Stop. A production deploy waits on the `Production` environment approval; approve it only when the user explicitly agrees in this conversation.
