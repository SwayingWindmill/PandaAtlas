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
- Lean on the dependencies already in the project before writing your own
  implementation or adding packages. Do not assume a library lacks a
  capability without checking its documentation and types.
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

### Issue tracker

Work is tracked in GitHub Issues for `SwayingWindmill/PandaAtlas`. For project-status or next-work questions, use live `main` plus GitHub state as described in `docs/agents/issue-tracker.md`.

### Issue completion

When an issue is merged and closed, stop before starting another issue. Report the completed issue and its verification to the user, then run the repo-local `/retro` against the 10 most recent PandaAtlas coding-agent sessions. Start the next issue only after the user explicitly asks to continue.

### Web browser tests

When changing Playwright tests, Web fixtures, or a browser-covered product surface, read `apps/web/tests/README.md`.

### Triage labels

Use the repository's five canonical triage roles. See `docs/agents/triage-labels.md`.

### Domain docs

PandaAtlas uses a multi-context glossary map. See `docs/agents/domain.md`.

### Local state

When creating or retaining ignored build, tool, scratch, or acquisition state, follow `docs/development-operations.md#local-state`.
