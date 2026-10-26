# Machine contract boundary

`contracts/` contains versioned, machine-readable rules that code reads or validates. Each contract has a consumer:

- [`batch-operations.v1.json`](batch-operations.v1.json): bounded batch execution, read by `scripts/batch/operations.mjs`;
- [`research-batch.v1.json`](research-batch.v1.json): declarative research inputs, checked by the research-script policy;
- [`release-manifest.v1.json`](release-manifest.v1.json): one public release intent under `data/release-manifests/`, read by the API's release command (`services/api/src/release-command.ts`) and kept in step with it by `services/api/test/release-command.spec.ts`;
- [`golden-dataset/`](golden-dataset/): the reviewed Mei Xiang family dataset, validated by `scripts/golden-dataset` and the Web golden-dataset smoke test, and read by panda-data reconciliation;
- [`panda-data/`](panda-data/): panda-data pipeline job, result and artifact schemas, validated by the panda-data tool.

A contract with no reader is deleted rather than kept as documentation. Contract changes must update their validators and tests. A contract file documents and enforces a boundary; it does not by itself authorize deployment, publication, or production writes. Architecture decisions are indexed in [`docs/architecture/README.md`](../docs/architecture/README.md).
