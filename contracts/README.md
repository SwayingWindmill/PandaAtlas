# Machine contract boundary

`contracts/` contains versioned, machine-readable rules for APIs, data, release evidence, runtime separation, and repository operations.

Key structural contracts include:

- [`repository-structure.v1.json`](repository-structure.v1.json) for allowed repository zones and npm workspaces;
- [`delivery-workflow.v1.json`](delivery-workflow.v1.json) for one-Issue branch, worktree, and pull-request delivery;
- [`api-request-runtime-boundary.v1.json`](api-request-runtime-boundary.v1.json) for FastAPI request imports and dependency separation;
- [`api-serverless-runtime.v1.json`](api-serverless-runtime.v1.json) for the Vercel entrypoint, direct runtime dependencies, and deterministic request closure;
- [`batch-operations.v1.json`](batch-operations.v1.json) for bounded batch execution;
- [`research-batch.v1.json`](research-batch.v1.json) for declarative research inputs.

Contract changes must update their validators and tests. A contract file documents and enforces a boundary; it does not by itself authorize deployment, publication, or production writes. Architecture decisions are indexed in [`docs/architecture/README.md`](../docs/architecture/README.md).
