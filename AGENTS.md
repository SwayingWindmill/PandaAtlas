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
- Before authoring, replacing or restyling any UI component or interactive
  control, read and follow the owner requirement in
  `docs/design/ui-component-sourcing-policy.md`.
  For non-UI code, prefer existing dependencies when they remain a good fit.
  Do not assume a library lacks a capability without checking documentation
  and types.

- Make architectural decisions for the long term. Do not accept a stopgap
  that only works for now and is meant to be replaced later.
- On this Windows-hosted repository, run Node.js/npm/NestJS/Vitest/ESLint/build
  commands with the Windows toolchain against the native `E:\` workspace:
  from PowerShell, or from Git Bash as `cmd.exe //d //s //c "npm ..."`.
  Git Bash rewrites a single-slash `/d` into a path, so `cmd.exe /d /s /c`
  there starts an empty shell and runs nothing. Do not run Node/npm through
  WSL against `/mnt/e`: mixed Windows/WSL `node_modules`, permissions,
  native binaries, and small-file I/O make installs and verification
  unreliable. Use WSL only for tooling that genuinely requires Linux.

## Agent skills

Matt Pocock skills are tracked under `.agents/skills/` as the synced release (v1.3.1) for agents without the plugin. The installed `mattpocock-skills` plugin of the same release is equivalent; use whichever your harness loads.

For frontend UX/UI work (designing, restyling or accepting a visual change), read `docs/agents/frontend-review.md` plus the design system for the surface: `DESIGN.md` (the single source of truth for the app, generated from `apps/mobile/src/design/tokens.ts`) or `docs/design/zhipanda-design-system.md` §1–9 for the website.

Every frontend PR (any change to a screen, component, design token or motion) must run the skill checks in `.agents/skills` before merging: `impeccable`, `break-ui`, `make-interfaces-feel-better`, `review-animations` when motion changes, and `apple-design` / `emil-design-eng` where relevant. Fix real findings in the same PR, list anything out of scope, and attach a review record at `docs/design/reviews/YYYY-MM-DD-pr<number>-skill-review.md`, linked from the PR description. See DESIGN.md → Governance.

### Issue tracker

Work is tracked in GitHub Issues for `SwayingWindmill/PandaAtlas`. For project-status or next-work questions, use live `main` plus GitHub state as described in `docs/agents/issue-tracker.md`.

For issue implementation, create a branch in the existing `E:\Code\PandaAtlas` checkout. Create a worktree only when the user explicitly requests parallel work.

### Issue completion

When an issue is merged and closed, report it and its verification to the user. Start the next issue when the user asks to continue or has already named the order to work through. Run the repo-local `/retro` only when the user asks for one.

### Production

Before merging anything that ships a migration or changes how production is deployed, read `docs/runbooks/production-release.md`; only its workflow migrates production.

### Web browser tests

When changing Playwright tests, Web fixtures, or a browser-covered product surface, read `apps/web/tests/README.md`.

### Triage labels

Use the repository's five canonical triage roles. See `docs/agents/triage-labels.md`.

### Domain docs

PandaAtlas uses a multi-context glossary map. See `docs/agents/domain.md`.

### Local state

When creating or retaining ignored build, tool, scratch, or acquisition state, follow `docs/development-operations.md#local-state`. For local Supabase or API integration work, use `docs/development-operations.md`; its Development Operations catalog is authoritative.
