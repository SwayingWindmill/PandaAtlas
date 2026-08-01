# Research batch manifests

This directory contains declarative inputs for bounded research work. Batch-specific subject lists, source lists, and operation selections belong here instead of being encoded in new Python filenames.

Each JSON file must follow [`contracts/research-batch.v1.json`](../../contracts/research-batch.v1.json) and be named exactly `<batch_id>.json`.

Rules:

- `batch_id` uses `YYYY-MM-DD-kebab-case`.
- `builder` names a reusable implementation, not a round or date.
- `subjects`, `sources`, and `operations` are non-empty and unique.
- `operations` must use the contract allowlist.
- `dry_run_default` must be `true`.
- Production deployment and release activation are not research batch operations.

Validate all manifests with:

```bash
npm run check:research-script-policy
```

Research outputs remain subject to the normal intake, evidence, review, curation, and immutable release boundaries. A valid manifest does not make its output authoritative or publishable.
