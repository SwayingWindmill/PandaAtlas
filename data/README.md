# Governed data boundary

`data/` contains both Git-tracked governed material and an explicitly ignored local research workspace. Reviewed inputs, immutable release material, evidence, and declarative batch manifests may be committed; raw fetches, caches, temporary operation output, and media binaries may remain inside the repository under `data/local-panda-research/` but must stay outside Git history.

Important tracked areas include:

- [`collector`](collector/) for the collector's targets and panda nicknames (`services/collector`);
- [`curation`](curation/) for source-backed working records;
- [`release-manifests`](release-manifests/) for reviewed intents to publish or roll back a database public release, governed by [`contracts/release-manifest.v1.json`](../contracts/release-manifest.v1.json) and run by the `release.publish` batch operation;
- [`research-batches`](research-batches/) for declarative research inputs governed by [`contracts/research-batch.v1.json`](../contracts/research-batch.v1.json).

The ignored `local-panda-research/` workspace may hold original responses, intermediate imports, caches, temporary query output, audit scratch files, and media binaries. Promote only reviewed, bounded material into a governed tracked area; do not force-add the local workspace wholesale. It is backed up to private R2 instead ([runbook](../docs/runbooks/research-backup.md)).

The production database is the source of truth for published data; files here are inputs to it, and the [release export](../docs/runbooks/production-release.md#back-up-the-published-data) is the readable copy of what it publishes. A committed data file is not automatically authoritative or publishable. Publication and runtime responsibility remain governed by contracts, release checks, and the [deployment status page](../docs/deployment/runtime-status.md).
