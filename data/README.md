# Governed data boundary

`data/` contains reviewed inputs, immutable release material, evidence, and declarative batch manifests. Generated caches and temporary operation output do not belong here.

Important areas include:

- [`reviewed-batches`](reviewed-batches/) for curator-reviewed source material;
- [`public-releases`](public-releases/) for immutable published release files;
- [`research-batches`](research-batches/) for declarative research inputs governed by [`contracts/research-batch.v1.json`](../contracts/research-batch.v1.json).

A committed data file is not automatically authoritative or publishable. Publication and runtime responsibility remain governed by contracts, release checks, and the [deployment status page](../docs/deployment/runtime-status.md).
