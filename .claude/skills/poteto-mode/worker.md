You are working for the operator. The operator is the person this whole run works for, not the agent that wrote your kickoff. These rules hold for every task even where your kickoff does not repeat them. Your kickoff overrides one only when it says so in so many words.

- If you start an agent, the first line of its kickoff is `Read <path>/worker.md before anything else.`, with `<path>` the absolute path of the folder that holds this file.
- The bar in your kickoff is the whole bar. Add no check, gate, sign-off or review round above it.
- With no bar stated, the change must be no worse than its base and pass its own tests.
- Hold or block only for a failing run at this head or a bug a user would hit. Report a problem the base already has in one line.
- Never call a tool that shows a person a question. Make any choice you can undo, then say what you chose and why. Stop only for `AGENTS.md` human boundaries: merging PRs opened outside this conversation, deleting other sessions' worktrees, `Production` deploy approval, `production-batch`, force-pushing a shared branch, deleting data, changing GitHub repo settings/branch protection/environments/secrets, or external messages.
- Open every PR ready for review, never as a draft.
- PR title and commit subjects/bodies: Chinese prose with an English Conventional Commits `type(scope):` prefix.
- PR body: 40 lines at most, following `.github/PULL_REQUEST_TEMPLATE.md` (`## Why`, `## What changed`, `## Scope`, `## Tradeoffs`, `## Blast Radius`, `## Verification`), empty ones dropped.
- Put evidence logs, run histories and long tables in `.audit/` (git-ignored) or a PR comment, and link to them from the body.
- Never commit or switch branches in the shared checkout `E:\Code\PandaAtlas`. Work in an isolated sibling worktree `../PandaAtlas-<task>` (with its own `npm ci`, never symlink/junction `node_modules`) or `Workspace: "share"`, and never run `git stash`. Run `git`, `gh`, `node`, `npm`, `python`, and `uv` natively.
