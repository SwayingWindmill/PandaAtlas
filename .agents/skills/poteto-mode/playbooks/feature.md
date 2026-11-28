### Feature

**You own the design. Plan, review, verify.** Delegate implementation where beneficial and stay in the lead.

1. Trace the affected subsystem directly (`codegraph_explore`, `read_file`, `GLOSSARY-MAP.md`, `docs/architecture/GLOSSARY.md`, `contracts/golden-dataset/GLOSSARY.md`, `docs/architecture/` ADRs, plus [`why`](../../why/SKILL.md) if touching historical defenses or thresholds).
2. Run [`architect`](../../architect/SKILL.md) when crossing function or module boundaries (or [`arena`](../../arena/SKILL.md) for a large or contested design), plus [`blast-radius`](../../blast-radius/SKILL.md) when touching shared contracts or existing invariants.
3. **UI layout mockup gate (`AGENTS.md` 「UI 与内容」)**: When a change alters the layout of a screen in `apps/mobile` or `apps/web`, draw a mockup of the changed screen first with real data and show it to the user BEFORE delegating or writing layout code. Write no layout code until the user approves the mockup. Put icons directly on the surface, never inside a tinted square or circle.
4. Write the throughput checkpoint as four todo items (write `n/a: <reason>` if single-file/no fan-out rather than dropping items):
   - **Blocking first steps.** Gates/grounding before fan-out.
   - **Independent workstreams.** Disjoint files/services/layers parallelize; shared writes serialize.
   - **Shared mutable state.** Split the target cleanly before parallelizing (**Separate Before Serializing Shared State** in `poteto-mode`).
   - **Smallest safe decomposition.** If one worker is best, name why.
5. Delegate coding with an explicit scope: file paths, named data shape and organizing structure (**Model the Domain**: discriminated union / state machine / table / typed boundary chosen before implementation), and success criteria.
   - When multiple valid implementation shapes exist, run the sibling `arena` skill and pick a coherent base.
   - Give parallel writers isolated workspaces (`Workspace: "share"` or separate sibling `git worktree add ../PandaAtlas-<task> -b <branch> origin/main` with its own `npm ci`). Never rely on prose alone to prevent concurrent writes to the same working tree, and never touch shared checkout `E:\Code\PandaAtlas`.
   - Follow **Comments** rules and keep edits minimal; align shared primitives across consumers and verify each.
6. Verify on the matching surface:
   - Mobile UI: [`apps/mobile/.claude/skills/verify/SKILL.md`](../../../../apps/mobile/.claude/skills/verify/SKILL.md) (`verify` at 390×844 local stack e2e, preview, or CI `mobile-e2e.yml`).
   - Web UI: `docs/agents/frontend-review.md` and `npm run smoke:web` / `npm run smoke:web:matrix`.
   - Backend / Data / Collector / Scripts: `npm run verify:dev` (or `npm run verify:dev -- --base origin/main` after committing).
   - "Inconclusive" or wrong-surface is not a pass.
7. Rebase/organize into small verifiable commits (**Sequence Work into Verifiable Units**).
8. If the design is contested or risky, run `interrogate` before opening/merging.
9. Run [Opening a PR](opening-a-pr.md).

Code-coupled work (one feature, one migration) belongs to one owner who fans out internally after blocking steps. Use fresh subagents at phase boundaries.

**Reply:** what changed for operators/maintainers, what you chose and why, the throughput checkpoint, open decisions or follow-ups, and verified evidence.
