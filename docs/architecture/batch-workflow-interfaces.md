# Bounded batch workflow interfaces

- Status: Phase 3 control-plane foundation
- Governing deployment decision: [ADR 0002](adr-0002-managed-cloud-deployment-target.md)
- Operation catalog: [`contracts/batch-operations.v1.json`](../../contracts/batch-operations.v1.json)
- Manual workflow: [`.github/workflows/batch-operations.yml`](../../.github/workflows/batch-operations.yml)
- Local interface: `npm run batch:plan -- --operation <id>`

## Purpose

Crawler, research, curation, media, release, and recovery work must not run inside FastAPI request handlers or through unrelated one-off GitHub Actions files. The bounded batch interface provides one reviewed control plane for these tasks while the repository migrates toward GitHub Actions as its managed batch runtime.

The workflow is manual-only. Its default behavior is to validate the catalog and write a dry-run plan. It has `contents: read`, does not push commits, does not create or merge pull requests, does not run on schedules or repository events, and does not cancel an in-progress operation with the same concurrency identity.

## Standard operation IDs

| Operation | Current status | Effect | Approval |
|---|---|---|---|
| `research.validate` | Ready | Read-only | No |
| `research.build` | Planned | Generated output | No |
| `curation.validate` | Ready | Read-only | No |
| `curation.apply` | Planned | Authoritative write | `production-batch` |
| `media.process` | Ready | Generated output | No |
| `media.publish` | Planned | External write | `production-batch` |
| `release.build` | Planned | Generated output | No |
| `release.publish` | Planned | Production write | `production-batch` |
| `recovery.drill` | Planned | Isolated state | No |

A planned operation can produce a reviewed plan when its required JSON manifest exists, but an execution request fails closed. Changing an operation from planned to ready requires both a catalog change and a matching code-level command allowlist change in `scripts/batch/operations.mjs`.

## Execution safety

Commands are arrays executed with `shell: false`. The workflow does not accept an arbitrary command, script name, or shell fragment from an input. Only the fixed adapters in the operation catalog and code-level allowlist can run.

Manifest paths must:

- be repository-relative;
- reference an existing JSON file;
- remain inside the repository after symlink resolution;
- be present whenever the selected operation requires one.

Approval-gated execution also requires a change reference and the GitHub Environment named `production-batch`. The protected job is the only workflow job that receives that environment. No currently ready operation uses the protected job.

## Plans, results, and summaries

Every plan writes `.batch-work/plan.json`. Execution additionally writes `.batch-work/result.json`; operation-specific generated output must also stay below `.batch-work/`. GitHub Actions uploads the plan or result directory even when an execution fails, and the runner writes the selected operation, effect, manifest, approval state, idempotency statement, and blocking reason to the job summary.

`.batch-work/` is ignored locally and rejected by repository hygiene if it becomes tracked or otherwise unignored.

## Ready adapters

The first ready adapters intentionally have bounded effects:

- `research.validate` runs the research-script policy checker;
- `curation.validate` validates reviewed curation records;
- `media.process` creates isolated local media derivatives with network access disabled by default.

The interface does not expose cohort-specific curation apply scripts, source-specific media upload scripts, D1 release activation, managed production publication, or environment-specific recovery commands as generic operations.

## Enabling a planned operation

A future PR that enables an operation must include:

1. a stable manifest contract and validator;
2. a generic adapter with no batch identity encoded in its filename;
3. deterministic or explicitly idempotent behavior;
4. isolated artifact and evidence output;
5. rollback or replay behavior appropriate to its effect;
6. a fixed command entry in the code-level allowlist;
7. targeted tests and `npm run check:batch-workflow-interface` acceptance;
8. `production-batch` environment ownership and reviewer configuration for any write effect.

Secrets must be read only by the protected job and only after environment approval. The workflow must not write directly to the default branch.

## Verification

```bash
npm run check:batch-workflow-interface
node --test scripts/release/tests/batch-workflow-interface.test.mjs
npm run batch:plan -- --operation research.validate --json
```

Changes to the workflow, catalog, runner, or checker select the `release` development scope. This foundation does not declare ADR 0002 Phase 3 complete; generic build, apply, publish, and recovery adapters remain separate reviewed work.
