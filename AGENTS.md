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
- Impeccable is the default design workflow for user-visible Web frontend work.
  Do not wait for the user to request it explicitly. Before changing a public
  UI/UX surface under `apps/web`, load `.agents/skills/impeccable/SKILL.md`, run
  its context setup for the concrete target, and use `apps/web/PRODUCT.md`,
  `apps/web/DESIGN.md`, plus the nearest persisted surface brief as design
  authority. Use the relevant Impeccable critique/shape/layout/typeset/adapt/
  audit/polish passes for the scope instead of treating the skill as an
  optional final review.
- For Web code changes, run `npm run check:impeccable -w web` (or the normal
  Web lint command, which includes it) before considering the work complete.
  Fix real detector findings rather than adding broad ignores. Only exclude
  generated code, third-party code, fixtures, or intentionally retired design
  prototypes. Admin/operator surfaces may use their own operational visual
  language; do not force the public panda-fan aesthetic onto admin screens, but
  the Impeccable detector and accessibility/craft checks still apply.
