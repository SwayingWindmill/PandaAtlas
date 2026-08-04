# Governed data boundary

`data/` contains both Git-tracked governed material and an explicitly ignored local research workspace. Reviewed inputs, immutable release material, evidence, and declarative batch manifests may be committed; raw fetches, caches, temporary operation output, and media binaries may remain inside the repository under `data/local-panda-research/` but must stay outside Git history.

Important tracked areas include:

- [`reviewed-batches`](reviewed-batches/) for curator-reviewed source material;
- [`public-releases`](public-releases/) for immutable published release files;
- [`research-batches`](research-batches/) for declarative research inputs governed by [`contracts/research-batch.v1.json`](../contracts/research-batch.v1.json).

The ignored `local-panda-research/` workspace may hold original responses, intermediate imports, caches, temporary query output, audit scratch files, and media binaries. Promote only reviewed, bounded material into a governed tracked area; do not force-add the local workspace wholesale.

A committed data file is not automatically authoritative or publishable. Publication and runtime responsibility remain governed by contracts, release checks, and the [deployment status page](../docs/deployment/runtime-status.md).
