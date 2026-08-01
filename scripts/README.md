# Operational script boundary

`scripts/` contains repository operations, validators, generators, and bounded batch tooling. It is not an application runtime.

- [`development`](development/) provides the shared command catalog.
- [`release`](release/) provides policy and acceptance checks.
- [`research`](research/) contains reusable research modules governed by declarative manifests.
- [`batch`](batch/) contains the fixed-command batch control plane.

Routine commands must be registered in [Development Operations](../docs/development-operations.md). Batch and research execution must remain behind their machine-readable contracts and fail-closed validators.
