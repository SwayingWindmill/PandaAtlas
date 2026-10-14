# Machine contract boundary

`contracts/` contains versioned, machine-readable rules that code reads or validates. Each contract has a consumer:

- [`batch-operations.v1.json`](batch-operations.v1.json): bounded batch execution, read by `scripts/batch/operations.mjs`;
- [`research-batch.v1.json`](research-batch.v1.json): declarative research inputs, checked by the research-script policy;
- [`beta-hard-gates.v1.json`](beta-hard-gates.v1.json): public release integrity and privacy boundary, read by the Beta hard-gate check;
- [`golden-dataset/`](golden-dataset/): the reviewed Mei Xiang family dataset, validated by `scripts/golden-dataset` and the Web golden-dataset smoke test;
- [`panda-data/`](panda-data/): panda-data pipeline job, result and artifact schemas, validated by the panda-data tool.

A contract with no reader is deleted rather than kept as documentation. Contract changes must update their validators and tests. A contract file documents and enforces a boundary; it does not by itself authorize deployment, publication, or production writes. Architecture decisions are indexed in [`docs/architecture/README.md`](../docs/architecture/README.md).
