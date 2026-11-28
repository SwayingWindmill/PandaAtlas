# Antigravity & Claude Code tool mapping for pstack (PandaAtlas)

This repository runs dual-harness pure-Markdown skills under `.agents/skills/` (Antigravity) and `.claude/skills/` (Claude Code), kept byte-for-byte identical via `npm run check:repository-hygiene` (also executed by `npm run verify:dev`). Resolve Cursor/pstack idioms named in skills here.

## Antigravity tool actions

| pstack / Cursor action | Antigravity equivalent |
|------------------------|------------------------|
| Read a file | `read_file` (use `StartLine` / `EndLine` slices per guidelines) |
| Create / edit a file | `write_file` / `edit_file` (mirror `.agents/skills/` and `.claude/skills/` byte-for-byte when editing skills) |
| Run a shell command | `run_command` and `manage_task` (run `git`, `gh`, `node`, `npm`, `python`, and `uv` natively) |
| Search code & call graph | `codegraph_explore` first (see `docs/agents/codegraph.md`), then `git grep -n` / `git ls-files` |
| Fetch web / docs | `search_web` or `curl` via `run_command` |
| Invoke a skill (`Skill`, `/name`) | `read_file` on its `<skills>` path (`poteto-mode/SKILL.md` is kept well under `24,000` bytes to avoid loader truncation) |
| Dispatch subagents (`Agent` / `Task`) | `invoke_subagent` with `TypeName`, `Role`, `Prompt`, `Model`, and `Workspace` (`"inherit"`, `"share"` isolated worktree, or `"branch"` clone; multiple calls run in parallel; end turn to await). Note `"share"` does not inherit untracked main-repo `.audit/` files |
| Steer or stop subagents | `send_message` (`Recipient: conversationId`) and `manage_subagents` (`Action`: `"list"`, `"kill"` with required `ConversationIds: [...]`, `"kill_all"`) |
| Track tasks (`TaskCreate` / `TodoWrite`) | Use `update_steps` / `update_focus` or keep an untracked checklist in `.audit/<task-slug>.todo.md` or `<appDataDir>/brain/<conversation-id>/scratch/todo.md` |
| Ask user (`AskUserQuestion` / `AskQuestion`) | `ask_question` (`questions: [{ question, options, is_multi_select }]`) |
| Recurring/delayed check (`loop`) | `schedule` (`Prompt` plus `DurationSeconds` or `CronExpression`; returns immediately so end turn to receive wakeups; never shell `sleep`) |
| MCP tool (`mcp__<server>__<tool>`) | `mcp_<serverName>_<toolName>` or `call_mcp_tool` after reading `<appDataDir>/mcp/<serverName>/<toolName>.json` (`~/.gemini/config/mcp_config.json`) |
| Session transcript lookup | `<appDataDir>/brain/<conversation-id>/.system_generated/logs/transcript.jsonl` (`transcript_full.jsonl` when `truncated_fields` is present) |

## Antigravity subagent policy

- **Worker kickoff**: Start every subagent prompt with `Read <abs-path-to-poteto-mode>/worker.md before anything else.` plus `AGENTS.md` and required `SKILL.md` paths (not full file dumps).
- **Writable / shell / network work**: Use `TypeName: "self"`. Pass `Workspace: "share"` (or create an isolated sibling worktree `../PandaAtlas-<task>` with its own `npm ci`) whenever multiple workers edit code or run builds concurrently. Never commit or switch branches in `E:\Code\PandaAtlas`, never symlink `node_modules`, and never run `git stash`.
- **Read-only inspection / review**: Use `TypeName: "research"` (has `read_file`, `codegraph_explore`, read-only `run_command`, and MCP read tools; cannot edit/write files or access external network). When a reviewer needs `write_file`, `.audit/` temp files, or network (`gh`), use `TypeName: "self"` with explicit instructions not to modify application code outside scope.
- **Model selection**: Default to `Model: "inherit"` unless the user explicitly asks for another model (`flash`, `flash_lite`, `pro`) or explicitly configures `~/.gemini/config/pstack-models.md` (included from `~/.gemini/config/GEMINI.md`) via [`../../setup-pstack/SKILL.md`](../../setup-pstack/SKILL.md). Keep `"inherit"` whenever no override sheet exists.
- **Cleanup**: Always list and stop subagents holding shared/branched workspaces via `manage_subagents` before committing or merging, and clean up task worktrees created in `../PandaAtlas-<task>` after PR merge.

## Claude Code harness parity

When running this repo in Claude Code:

- **Subagent dispatch**: Map `Task` -> `Agent` (runs in background by default; omit `run_in_background`). Map `readonly: true` -> `subagent_type: "Explore"` (still instruct `"do not edit files"` and check `git status` afterward because `Explore` keeps Bash). Map `readonly: false` -> `subagent_type: "general-purpose"` (keeps MCP servers). Map `environment: "cloud"` -> `isolation: "worktree"`. Map `resume` -> spawn a fresh `Agent` with the prior output in its brief.
- **Models & rules**: Claude Code auto-loads `~/.claude/rules/pstack-models.md` (and `.claude/rules/pstack-models.md` if present). Map `<model> <effort>` values (for example `opus xhigh`) to `Agent` `model` (`opus`, `sonnet`, `haiku`, `fable`) and `effort` (`low`, `medium`, `high`, `xhigh`), and omit `model` for `inherit-parent` or `auto`.
- **Cursor-only steps**: Skip Cursor Automations, `update_state`, or Bugbot dashboard waits with one line (`Skipped in Claude Code: <step>. <reason>.`), and triage GitHub PR comments via `gh` + `bugbot-triage.md`.

## Repository skill equivalents

| Upstream reference | Repository equivalent |
|--------------------|-----------------------|
| App UI driver / `control-ui` | Mobile driver [`apps/mobile/.claude/skills/verify/SKILL.md`](../../../../apps/mobile/.claude/skills/verify/SKILL.md) (390×844 local stack e2e, preview, or CI `mobile-e2e.yml`); Web UI via `docs/agents/frontend-review.md` & `npm run smoke:web` |
| `comment-sicko` agent (`no-comments`) | Read [`../../no-comments/references/comment-sicko-prompt.md`](../../no-comments/references/comment-sicko-prompt.md) and pass it to `invoke_subagent` |
| `principle-*` leaf directories | [`../references/principles/`](principles/) (`24` principle guides) |
| Skill authoring guidance | Built-in `agy-customizations` skill, keeping `AGENTS.md` + `npm run check:repository-hygiene` mirror & LF rules |
| Governance & static gates | `npm run verify:dev`, `npm run check:repository-hygiene`, `npm run check:doc-references`, `npm run test:development-gate` |
| Skill helper scripts (Node 24+ / Bash) | `scripts/{resume.ts,worktree-audit.ts}`, `show-me-your-work/scripts/log.sh`, `statechart/scripts/statechart.ts` |

## Instructions & skill sync rule

- Workspace instructions live in `AGENTS.md` (and `CLAUDE.md` -> `@AGENTS.md`).
- Whenever creating or updating any skill under `.agents/skills/`, mirror the exact bytes (LF line endings) to `.claude/skills/`.
