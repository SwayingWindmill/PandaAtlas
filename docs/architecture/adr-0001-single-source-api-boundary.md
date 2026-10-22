# ADR 0001: Single authoritative API boundary

- Status: accepted (2026-07-13, #4); restated 2026-10 for the V2 runtime

One API owns domain rules and every persistent write; today that is the NestJS V2 API in `services/api`. Every other runtime (the Web app, Workers, Python `panda-data`, batch jobs) reads published projections or calls that API, and never becomes a second fact source.

The decision came from running FastAPI and a Cloudflare Worker over D1 side by side: two implementations of the same contract let field meaning, validation and release behaviour drift apart. The V1 runtimes, D1 projection and their contract checks were retired; git history holds the original migration plan.
