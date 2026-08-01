# Research scripts

Research work must separate reusable code from batch-specific inputs.

## Allowed structure

```text
scripts/research/
├─ run_batch.py        # optional stable dispatcher
├─ adapters/           # source-specific reusable access
├─ builders/           # reusable candidate builders
├─ runners/            # bounded orchestration
├─ validators/         # contract and evidence checks
├─ migrations/         # one-time structure/data migrations with durable value
├─ tests/              # bounded tests
└─ archive/            # historical one-off scripts retained for audit only
```

New root-level files such as `build_subject_round21.py`, `discover_rounds171_190.py`, or date-named scripts are prohibited. Put changing batch inputs in `data/research-batches/<batch-id>.json` and keep executable logic in a stable module.

## Batch manifests

Batch manifests follow [`contracts/research-batch.v1.json`](../../contracts/research-batch.v1.json). A valid example is:

```json
{
  "schema_version": 1,
  "batch_id": "2026-08-01-vienna-birthday-media",
  "builder": "official-media",
  "subjects": ["fu-feng", "fu-ban"],
  "sources": ["vienna-zoo"],
  "operations": ["discover", "validate", "build-candidates"],
  "dry_run_default": true,
  "description": "Collect reviewed birthday media candidates"
}
```

The filename must be `2026-08-01-vienna-birthday-media.json`. Builder identifiers describe reusable implementations; they must not encode round numbers or dates.

## Historical scripts

Existing one-off scripts may be retained under `archive/<year>/` when they are required to reproduce an already-frozen evidence package. Archived scripts are not supported entry points and must not receive new feature work.

Before archiving or deleting a historical script, confirm that its outputs, source references, parameters, and relevant hashes are preserved in reviewed data or evidence.

## Verification

Run:

```bash
npm run check:research-script-policy
```

`verify:dev` selects this check whenever research scripts, research batch manifests, or the research-batch contract change.
