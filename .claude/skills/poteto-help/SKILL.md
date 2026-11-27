---
name: poteto-help
description: Guides users through pstack setup, /poteto-mode, and picking the right installed skill or playbook in PandaAtlas. Type /poteto-help with a question.
disable-model-invocation: true
---

# Poteto help

Answer the user's question about `pstack` in `PandaAtlas`, hand them a prompt they can send, and link the local file under `.agents/skills/` that the answer came from. For a pure help question, do not start the task itself; let the user send the prompt.

A message asking for real work (e.g. "use poteto-mode to fix this bug") is not a help question: read [`poteto-mode`](../poteto-mode/SKILL.md) and execute the matching playbook.

This file maps questions to the local skills and playbooks in `.agents/skills/`. Read the file you route to before quoting it, and trust it when it disagrees with this map.

## Find out what they need

Infer the need from the message. If unclear, ask one multiple-choice question with `ask_question` using these options, then answer only the section they pick:

- Get set up
- Start a task with `poteto-mode`
- Pick a skill for a situation
- Fix a run that went wrong
- Make `pstack` my own

Check repository/user state and mention it only when relevant:

- Absence of `~/.gemini/config/pstack-models.md` (or `~/.claude/rules/pstack-models.md` / `.claude/rules/pstack-models.md` in Claude Code) means `/setup-pstack` has not run, so Antigravity defaults every subagent to `Model: "inherit"`.
- `PandaAtlas` ships its mobile driver skill at [`apps/mobile/.claude/skills/verify/SKILL.md`](../../../apps/mobile/.claude/skills/verify/SKILL.md) (`verify`) with feature docs under `apps/mobile/.claude/skills/verify/features/README.md`. Remind users of [`maintain-verification-skill`](../maintain-verification-skill/SKILL.md) when verified code or mobile routes drift.

## Get set up

All `pstack` and complementary skills in `PandaAtlas` are already checked into `.agents/skills/` (mirrored byte-for-byte to `.claude/skills/` by `npm run check:repository-hygiene`):

1. By default, no model override sheet is required — Antigravity runs subagents with `Model: "inherit"`. Run [`/setup-pstack`](../setup-pstack/SKILL.md) only if you want per-role model overrides (such as `flash` or `pro` in Antigravity, or `large/medium/small` reasoning budgets and Claude slugs in `~/.claude/rules/pstack-models.md`).
2. `PandaAtlas` does not install an external `pstack@pstack-claude` plugin or `SessionStart` routing hook; mention `poteto-mode` (or `/poteto-mode` / a specific skill name) when starting non-trivial tasks.
3. Frame your prompt with a goal and a pass/fail verification check, per [`references/prompting.md`](references/prompting.md).

## Start a task with `poteto-mode`

[`poteto-mode`](../poteto-mode/SKILL.md) matches your task to one of 22 playbooks, copies its steps into your checklist (marking unused steps `skip: <reason>`), and orchestrates sibling skills as needed. State the goal and done check rather than hand-coding a skill sequence. Read [`references/prompting.md`](references/prompting.md) before helping word a prompt.

Note that `PandaAtlas`'s subagent tool mapping lives in [`agy-tools.md`](../poteto-mode/references/agy-tools.md): every subagent kickoff starts with `Read <abs-path-to-poteto-mode>/worker.md before anything else.` and uses `invoke_subagent` (`TypeName: "self"` for writable/shell work or `"research"` for read-only reading) instead of Cursor's `poteto-agent`.

## Pick a skill (49 mirrored skills installed)

The default entry point for non-trivial work is [`poteto-mode`](../poteto-mode/SKILL.md). Name a specific skill directly when you want focused execution:

| The user wants to | Skill |
|---|---|
| Run end-to-end tasks following pstack playbooks | [`poteto-mode`](../poteto-mode/SKILL.md) |
| Check understanding of goal, problem, and smallest change first | [`in-your-own-words`](../in-your-own-words/SKILL.md) |
| Learn expert terms for what they're building (with verified sources) and rewrite their description | [`reframe`](../reframe/SKILL.md) |
| Stress-test an open plan/idea round-by-round along a design tree | [`grilling`](../grilling/SKILL.md) |
| Turn a decision blocked on someone else into an async questionnaire | [`to-questionnaire`](../to-questionnaire/SKILL.md) |
| Generate an interactive bash wizard for human-only setup/secrets | [`wizard`](../wizard/SKILL.md) |
| Scan active hot spots for deepening opportunities (visual HTML report) | [`improve-codebase-architecture`](../improve-codebase-architecture/SKILL.md) |
| Apply deep-module vocabulary, seam rules, and deepening patterns | [`codebase-design`](../codebase-design/SKILL.md) |
| Make a prompt deeper (raw sources, methods, outside checks, prototype forks) without running it | [`sharpen`](../sharpen/SKILL.md) |
| Understand how code works or which layer/package owns something | [`how`](../how/SKILL.md) |
| Research why code or a threshold exists (git, docs, ADRs, specs, PRs) | [`why`](../why/SKILL.md) |
| Learn a change or subsystem plainly (`how` + `why` + diagrams) | [`teach`](../teach/SKILL.md) |
| Reconstruct recent context from transcripts, git, and PRs/issues | [`recall`](../recall/SKILL.md) |
| Summarize authored commits in a time window (status update) | [`what-did-i-get-done`](../what-did-i-get-done/SKILL.md) |
| Catch up on this chat in plain words + visuals + waiting calls | [`ketchup`](../ketchup/SKILL.md) |
| Catch up like `/ketchup` in a subtitled slide video (requires `ffmpeg`) | [`ketchup-video`](../ketchup-video/SKILL.md) |
| Hear the last reply restated in plain human language | [`bro`](../bro/SKILL.md) |
| Find what a change could break outside its diff and prove safety | [`blast-radius`](../blast-radius/SKILL.md) |
| Settle types, signatures, and module structure before coding | [`architect`](../architect/SKILL.md) |
| Spawn N parallel attempts and graft the strongest parts | [`arena`](../arena/SKILL.md) |
| Fan out N parallel workers over slices or a race | [`swarm`](../swarm/SKILL.md) |
| Run adversarial multi-angle review proven by live code runs | [`interrogate`](../interrogate/SKILL.md) |
| Fix a bug test-first when a cheap local test exists | [`tdd`](../tdd/SKILL.md) |
| Apply TypeScript rules (`no any`, strict narrowing) to `.ts`/`.tsx` | [`typescript-best-practices`](../typescript-best-practices/SKILL.md) |
| Remove AI-generated code clutter and over-engineering | [`deslop`](../deslop/SKILL.md) |
| Audit/remove ungrounded comments via an independent reviewer | [`no-comments`](../no-comments/SKILL.md) |
| Cut AI tells and fluff from prose and docs | [`unslop`](../unslop/SKILL.md) |
| Write/review technical docs, PRs, commits, or specs (Diataxis + clarity) | [`technical-writing`](../technical-writing/SKILL.md) |
| Prepare clean commits and a fast-to-review PR description | [`make-pr-easy-to-review`](../make-pr-easy-to-review/SKILL.md) |
| Shepherd an open PR to merge-ready green CI | [`babysit`](../babysit/SKILL.md) |
| Diagnose and fix failing GitHub Actions checks | [`fix-ci`](../fix-ci/SKILL.md) |
| Resolve merge conflicts non-interactively and validate | [`fix-merge-conflicts`](../fix-merge-conflicts/SKILL.md) |
| Fetch and triage PR review comments | [`get-pr-comments`](../get-pr-comments/SKILL.md) |
| Deep security, breakage, devex regression, and leak audit on a branch | [`thermo-nuclear-review`](../thermo-nuclear-review/SKILL.md) |
| Harsh maintainability, file-size, and abstraction audit | [`thermo-nuclear-code-quality-review`](../thermo-nuclear-code-quality-review/SKILL.md) |
| Run both thermo reviews in parallel and synthesize | [`thermos`](../thermos/SKILL.md) |
| Run a large or ambiguous multi-part migration with auditable log | [`figure-it-out`](../figure-it-out/SKILL.md) |
| Record/audit an append-only TSV decision trail | [`show-me-your-work`](../show-me-your-work/SKILL.md) |
| Model-check a TLA+ state spec and render Mermaid bug-path charts | [`statechart`](../statechart/SKILL.md) |
| Vet performance benchmarks (limiters, tuning, bounds, repeatability) | [`benchmark-checklist`](../benchmark-checklist/SKILL.md) |
| Encode repeated mistakes structurally (schema -> types -> lint -> test -> docs) | [`correct`](../correct/SKILL.md) |
| Generate a repo-local app verification skill | [`create-verification-skill`](../create-verification-skill/SKILL.md) |
| Audit and sync the repo's verification skill and feature map | [`maintain-verification-skill`](../maintain-verification-skill/SKILL.md) |
| Generate a repo-local formal verification skill | [`create-formal-verification-skill`](../create-formal-verification-skill/SKILL.md) |
| Sync formal verification models after verified code changes | [`maintain-formal-verification-skill`](../maintain-formal-verification-skill/SKILL.md) |
| Configure per-role pstack model overrides | [`setup-pstack`](../setup-pstack/SKILL.md) |
| Capture user habits into a personal `-mode` skill | [`automate-me`](../automate-me/SKILL.md) |
| Turn session transcripts into approved skill improvements | [`reflect`](../reflect/SKILL.md) |
| Navigate installed pstack skills and playbooks | [`poteto-help`](SKILL.md) |

### Additional repo & external skills

- **Mobile app driver (`verify`)**: [`apps/mobile/.claude/skills/verify/SKILL.md`](../../../apps/mobile/.claude/skills/verify/SKILL.md) drives the Expo app at 390×844 across local stack e2e, preview, or CI `mobile-e2e.yml`.
- **UI & animation skills**: External UI/motion skills (`emilkowalski/skills`, `make-interfaces-feel-better`, etc.) are pinned in `skills-lock.json` and loaded via installed harness plugins (`AGENTS.md`, `DESIGN.md`, `docs/agents/frontend-review.md`).
- **24 standalone `principle-*` directories**: Installed as 24 leaf reference sheets under [`poteto-mode/references/principles/`](../poteto-mode/references/principles/) and indexed inside [`poteto-mode`](../poteto-mode/SKILL.md).

## Close calls

- `/reframe` teaches expert terms and borrows from neighboring fields before rewriting a vague description; `/sharpen` deepens an existing prompt with raw sources, methods, outside checks, and prototype-first instructions.
- `/how` explains what code does; `/why` explains decisions/history; `/teach` runs both and teaches plainly.
- `/arena` races parallel complete solutions and grafts the best parts; `/swarm` splits slices or independent workers into one report.
- `/interrogate` challenges a diff/design with adversarial runs; `/blast-radius` traces breakage outside the diff and proves safety.
- `/thermos` launches both `/thermo-nuclear-review` (security/breakage) and `/thermo-nuclear-code-quality-review` (maintainability) in parallel.
- `/recall` mines across past chats and shared records; `/ketchup` summarizes only what changed in this chat since your last message.
- `/grilling` runs an explicit multi-round interview over an open plan; normal `poteto-mode` coding tasks keep `in-your-own-words` + `Never Block on the Human`.
- `/improve-codebase-architecture` surveys active `git log` hot spots into an HTML Before/After report using [`codebase-design`](../codebase-design/SKILL.md), then hands selected interface design/refactoring to [`architect`](../architect/SKILL.md) and [`refactoring.md`](../poteto-mode/playbooks/refactoring.md).
- `/codebase-design` supplies deep-module vocabulary, dependency categories, and seam/test rules; `/architect` sketches two candidate shapes before coding (escalating large/contested designs to [`arena`](../arena/SKILL.md)).

## Phase boundaries (context transitions)

A **phase** is one chunk of work inside a session (exploration, planning, implementation, QA). At a boundary between two phases, evaluate these five options in order (first **yes** wins; mid-phase, continue or dispatch subagents instead of compacting):

1. **Continue**: the next phase needs this conversation as a **primary source** (verbatim reasoning) and enough smart zone remains (~150k tokens). Costs nothing, loses nothing.
2. **`/clear`**: the current exploration or dead ends are disposable to what comes next. Cleanest reset.
3. **`pause-safely` / global `handoff`**: pause cleanly on the same repo/branch with [`pause-safely.md`](../poteto-mode/playbooks/pause-safely.md) (`resume.ts`); reach for personal global `handoff` when context must travel across harnesses, directories, colleagues, or mid-phase side forks.
4. **Subagent**: the next unit runs AFK with a tight scope (`invoke_subagent`). Keeps the main context untouched.
5. **`/compact`**: relevant context, same harness and repo, staying in the loop past the smart zone. Always pass what the summary must preserve (`/compact keep the verified seam contracts`); avoid making `/compact` your first reach because summaries are lossy secondary sources.

## Playbooks

Playbooks live in `../poteto-mode/playbooks/` (22 total). Describe the task with `poteto-mode` to match one automatically, or name it explicitly ("run the `prototype` playbook", "run the `babysit` playbook", "land the stack with `shipping`", "pause safely", "pick up this branch with `session-pickup`").

Note on principles inside `PandaAtlas`: refer to [`poteto-mode`](../poteto-mode/SKILL.md) "Non-negotiables" and "Principles", the 24 leaf sheets in [`poteto-mode/references/principles/`](../poteto-mode/references/principles/), and `AGENTS.md` (worktree isolation, UI mockup before layout code, independent reviewer `PASS` before merge, and real-surface verification).

## Fix a run that went wrong

| Symptom | Fix |
|---|---|
| `poteto-mode` drifted mid-chat | Re-state `poteto-mode` or name the exact playbook step checklist you want followed. |
| Model override change had no effect | Start a new chat and check `~/.gemini/config/pstack-models.md` (or `~/.claude/rules/pstack-models.md`). |
| Parallel workers stepped on each other's files | Require `Workspace: "share"` in `invoke_subagent` (or separate sibling git worktrees `../PandaAtlas-<task>`). |
| Scheduled/autonomous loop ran without finishing | Require a concrete pass/fail check predicate and decision log (`.audit/` TSV), never just a time budget. |
| Reply declared done from `build`/`typecheck` alone | Demand real repro, mobile `verify` / web `smoke:web` screenshots, or `npm run verify:dev` output per `prove-it-works`. |

For more steering lines and reusable prompts, see [`references/prompting.md`](references/prompting.md) and [`references/recipes.md`](references/recipes.md).

## Make pstack my own

- [`/automate-me`](../automate-me/SKILL.md) mines your workspace history into a personal `-mode` skill.
- [`/reflect`](../reflect/SKILL.md) turns session lessons into concrete skill edits (mirrored `.agents/skills/` <-> `.claude/skills/` and validated with `npm run check:repository-hygiene`).
- Authoring new skills: use `poteto-mode` -> [`authoring-a-skill.md`](../poteto-mode/playbooks/authoring-a-skill.md) + built-in `agy-customizations`. Test skill edits with [`eval.md`](../poteto-mode/playbooks/eval.md).

## Reply

Lead with the answer. Give at most one example prompt in a code block, adapted from [`references/recipes.md`](references/recipes.md) when one fits, plus the file link(s). Keep it short unless the user asks for the full skill catalog.
