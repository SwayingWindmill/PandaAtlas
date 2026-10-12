- Do not preserve backward compatibility. Remove obsolete paths instead of
  adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current
  requirements. Avoid speculative abstractions, configuration, and
  indirection.
- Grow the system in layers. Start from the smallest version that works end
  to end, and add each new capability on top of a product that already
  works. Never trade a working product for unfinished complexity.
- Keep components modular and concerns clearly separated.
- Prefer established, well-maintained libraries when they reduce overall
  complexity or improve reliability. Do not reimplement common
  functionality without a clear reason.
- Before authoring new UI, actively evaluate established component sources
  rather than assuming the repository's existing controls are the right choice.
  For non-UI code, prefer existing dependencies when they remain a good fit.
  Do not assume a library lacks a capability without checking documentation
  and types.

## UI component sourcing — owner requirement

**Do not author a new UI component or interactive control when an appropriate
maintained component already exists.** **First actively search and compare**
official shadcn/ui, ReUI, Kibo UI, Dice UI and other relevant mature registries,
regardless of which dependencies are currently installed. Choose on fit to
the required appearance, interaction, accessibility, maintenance and technical
stack; installation status is never the first selection criterion. Evaluate
reasonable substitution and compositions of upstream primitives before
concluding that a custom component is necessary. Reuse an already installed
component **only when it wins that comparison**, not merely because it exists.
Use the registry's documented installation method (prefer the shadcn CLI);
do not hand-copy or fork an upstream component unnecessarily.

An exception requires evidence in the change's design/PR notes: which
maintained components were evaluated, why direct use and reasonable
substitution both fail the actual product requirements, and what remains
unsupported. The exception must be scoped to the smallest missing behavior.
Routine domain data mapping, backend integration and page-level composition
are application code, not permission to create a parallel primitive library.
Do not install several overlapping UI libraries solely to make a screen look
busy. Keep the project on a coherent component stack; check peer-dependency
and major-version compatibility before installation.

For existing bespoke UI, prioritize replacement during work on that surface
using maintained components; do not propagate the bespoke pattern to new
screens. Preserve accessibility, factual content, IAM, keyboard behavior and
server-backed state during each replacement. Visual review must compare the
rendered page, not just count library imports.
- Make architectural decisions for the long term. Do not accept a stopgap
  that only works for now and is meant to be replaced later.
- On this Windows-hosted repository, run Node.js/npm/NestJS/Vitest/ESLint/build
  commands with the Windows toolchain against the native `E:\` workspace
  (for example via `cmd.exe /d /s /c`). Do not run Node/npm through WSL against
  `/mnt/e`, because mixed Windows/WSL `node_modules`, permissions, native
  binaries, and small-file I/O make installs and verification unreliable.
  Use WSL only for tooling that genuinely requires Linux.

## Agent skills

For Matt Pocock workflows in this repository, explicitly read the tracked `.agents/skills/<skill>/SKILL.md`; user-global duplicate skills are not PandaAtlas authority.

For frontend UX/UI work, also read the user-global `jakubkrehel/skills` instructions under `~/.agents/skills/`. Use `better-interface` with its six domain skills (`better-accessibility`, `better-layout`, `better-writing`, `better-typography`, `better-colors`, `better-ui`) when designing or auditing a complete operator flow. For visual changes, use the `interface-review` skill as a separate change-scoped review alongside Matt's Standards/Spec code review. Global availability is a developer-workstation prerequisite, not an app dependency; do not vendor these skills or introduce new build/runtime dependencies. Product facts, security/capabilities, existing PandaAtlas design contracts and accessibility take precedence over aesthetic suggestions. An automated test pass is not visual sign-off: inspect the rendered desktop page, its real-data semantics and its loading/empty/error states before claiming UI acceptance.

### Issue tracker

Work is tracked in GitHub Issues for `SwayingWindmill/PandaAtlas`. For project-status or next-work questions, use live `main` plus GitHub state as described in `docs/agents/issue-tracker.md`.

For issue implementation, create a branch in the existing `E:\Code\PandaAtlas` checkout. Create a worktree only when the user explicitly requests parallel work.

### Issue completion

When an issue is merged and closed, stop before starting another issue. Report the completed issue and its verification to the user, then run the repo-local `/retro` against the 10 most recent PandaAtlas coding-agent sessions. Start the next issue only after the user explicitly asks to continue.

### Web browser tests

When changing Playwright tests, Web fixtures, or a browser-covered product surface, read `apps/web/tests/README.md`.

### Triage labels

Use the repository's five canonical triage roles. See `docs/agents/triage-labels.md`.

### Domain docs

PandaAtlas uses a multi-context glossary map. See `docs/agents/domain.md`.

### Local state

When creating or retaining ignored build, tool, scratch, or acquisition state, follow `docs/development-operations.md#local-state`. For local Supabase or API integration work, use `docs/development-operations.md`; its Development Operations catalog is authoritative.
