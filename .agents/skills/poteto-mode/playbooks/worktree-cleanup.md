### Worktree and workspace cleanup

**This playbook deletes user state, so every safety gate below is mandatory.** Remember `AGENTS.md` §7: clean up only the worktree and local branch created by this task after merge; whenever `git worktree list` shows worktrees left behind by other sessions, list their statuses and obtain explicit user consent before removing any of them. Never touch the shared checkout `E:\Code\PandaAtlas`.

1. **Snapshot and audit.** Run natively:
   ```sh
   node --disable-warning=ExperimentalWarning .agents/skills/poteto-mode/scripts/worktree-audit.ts
   ```
   It enumerates worktrees from `git worktree list --porcelain -z` and classifies each into `hold-locked`, `hold-wip`, `hold-untracked`, `hold-reflog`, `hold-ignored`, `hold-open-pr`, `verify-recent-chat`, `safe`, or `review`.
2. **Treat buckets as advice, not blind deletion permission.** Cross-check against active/pinned chats, other sessions' worktrees, or subagent workspaces (`manage_subagents` with `Action: "list"`).
3. **Verify `verify-recent-chat` and `review` rows before pruning.** Inspect referenced recent transcripts (`<appDataDir>/brain/<id>/.system_generated/logs/transcript.jsonl` or `~/.claude/projects/`) inside read-only subagents so bulk transcripts stay out of main context. For any `review` row, inspect `git -C <path> status` and `git -C <path> log` natively before deciding.
4. **Pause and get explicit user approval before removing any other session's worktree or anything with state at risk:**
   - `wip:N` / `untracked:N`: inspect with `git -C <path> status --porcelain --untracked-files=all --ignore-submodules=none` and `git -C <path> diff HEAD --ignore-submodules=none --submodule=log`.
   - `ignored:N`: inspect non-disposable ignored files (like `.env`) with `git -C <path> status --porcelain --ignored=matching`.
   - `reflog:N`: commits reachable only via that worktree's HEAD reflog; rescue wanted ones with `git branch <name> <sha>` first.
   - `hold-locked`: inspect lock reason and do not delete around git locks.
   Only confirmed clean + merged + inactive worktrees (with explicit approval if owned by another session) can be removed.
5. **Prune confirmed clean worktrees cleanly.** Stop processes inside the worktree and leave its directory first (Windows locks open handles in `node_modules`). Run `git worktree remove <path>` (only add `--force` when confirmed to contain only `.audit/` or disposable build artifacts; delete any leftover empty `node_modules` directory if Windows leaves one), `git branch -D <branch>` if merged/abandoned, then `git worktree prune` and `git fetch --prune origin` (if WSL is ever used, never run `git worktree prune` inside WSL while Windows worktrees exist).
6. **Optional cache cleanup.** Reclaim stale `.audit/` artifacts or unused build/Playwright caches only when confirmed unneeded.

**Reply:** worktrees removed, kept worktrees with exact one-line hold reasons, and `git worktree list` / branch cleanup status.
