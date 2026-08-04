# Agents

### Avoid excessive defensive programming

- Validate untrusted input at system boundaries, then pass validated types inward.
    
- Give each invariant one primary owner. Do not repeat the same check across multiple layers without a concrete concurrency or state-change reason.
    
- Prefer types, schemas, constructors and database constraints over scattered runtime guards.
    
- Do not add fallback states, retries or error branches for purely hypothetical failures.
    
- Fail fast for programming errors; return typed errors for expected external failures.
    
- Test observable behavior and contracts, not function names, source strings or exact implementation details.
    
- Before adding a guard, identify the specific bug, security issue or data corruption it prevents. If none is concrete, do not add it.
    
- Never remove authorization, isolation, idempotency, concurrency or irreversible side-effect protections merely to reduce code.


## Verification and release-gate policy

### Three verification levels

1. **Tight feedback loop** — while implementing, run the narrowest relevant test file, linter, typecheck, or contract check. Keep this loop under 90 seconds where practical.
2. **Development acceptance** — after the implementation is stable, run `npm run verify:dev`. By default it inspects staged, unstaged, and untracked files and runs only the affected fast scopes. Use `--base <branch-or-commit>` only when a clean worktree needs whole-branch verification. The target is five minutes or less.
3. **Release certification** — full release gates (`release:default`, `release:map-close` when present, `release:extended`, browser matrices, recovery drills, real-database drills, and production/staging release commands) are final-candidate evidence, not development feedback.

### Mandatory agent behavior

- During implementation, prefer targeted commands. Do not repeatedly run the full release gate after each edit.
- Run `npm run verify:dev` once before declaring normal development work complete. Use `npm run verify:dev -- --list` to inspect the selected scopes without executing them. Pull-request automation runs the same changed-scope gate until the PR becomes a non-draft `delivery:map-close` candidate.
- Use explicit scopes when the automatic comparison base is unavailable: `npm run verify:dev -- --scope web`, `--scope api`, `--scope worker`, `--scope curation`, `--scope research`, `--scope data`, or `--scope release`. Multiple `--scope` flags may be combined.
- Use `npm run verify:dev -- --all` only for genuinely cross-cutting changes or when changed-path classification cannot be trusted. It is still not a substitute for release certification.
- Keep feature pull requests in draft during active implementation. Do not add or retain the `delivery:map-close` label until implementation, targeted checks, development acceptance, review, and evidence preparation are complete.
- A full release gate should run at most once for a candidate commit. If it fails, reproduce and fix the failing step with a targeted command; rerun the full gate only after the targeted signal passes.
- Documentation-only, agent-policy-only, or evidence-metadata-only corrections do not justify rerunning browser matrices, recovery drills, or the complete release gate unless they change executable release behavior or invalidate bound evidence.
- Run full browser smoke or automated accessibility during development only when the change affects browser-visible behavior, routing, keyboard interaction, accessibility semantics, Playwright configuration, or browser-runtime infrastructure. Prefer the smallest relevant spec first.
- Never shorten feedback time by weakening authorization, privacy, trust, provenance, idempotency, rollback, recovery, or irreversible-side-effect protections. Move expensive checks to final certification; do not delete their safety guarantees.

### Development scope mapping

- `web`: `apps/web/**` — Web lint and typecheck; targeted Playwright specs are added only when browser behavior changed.
- `api`: `services/api/**` and database infrastructure — FastAPI Ruff and tests without release/recovery drills.
- `worker`: `services/worker-api/**` — Worker typecheck without D1 rollback or HTTP runtime smoke.
- `curation`: reviewed collection and media-processing code/data — bounded curation and media tests.
- `research`: `scripts/research/**` and `data/local-panda-research/**` — bounded research tests and validation.
- `data`: golden-dataset contracts and generators — contract, dataset, and generated-alias consistency checks.
- `release`: release scripts, workflow definitions, hard-gate policies, and release evidence infrastructure — release-gate unit tests only during development.

## Agent skills

### Issue tracker

Issues and engineering work are tracked in GitHub Issues for `SwayingWindmill/PandaAtlas`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default mattpocock/skills triage label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Use a multi-context domain documentation layout with a root `CONTEXT-MAP.md` and context-specific `CONTEXT.md` files. See `docs/agents/domain.md`.
