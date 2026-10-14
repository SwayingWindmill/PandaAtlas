# panda-data

`panda-data` is the independent Python batch/data runtime for PandaAtlas V2. It is not an HTTP backend and it does not own PandaAtlas business truth.

## What belongs here

- reviewed source acquisition and crawler adapters
- research/discovery helpers
- identity-resolution assistance
- enrichment and curation assistance
- media processing and offline artifact construction
- technical pipeline job/attempt/artifact bookkeeping

The code lives under `src/panda_data` and never imports the NestJS API.

## Authority boundary

NestJS business modules remain authoritative. `panda-data` may:

1. read module-owned versioned export views exposed specifically to the pipeline role;
2. write only the private `pipeline` technical schema;
3. exchange typed jobs/results through PGMQ/Outbox and immutable content-addressed R2 artifacts.

It must not insert, update, or delete authoritative `evidence`, `panda`, `lineage`, `place`, `life_history`, `media`, `identity`, `engagement`, `game`, `publication`, or other business tables. PostgreSQL grants for the `zhipanda_pipeline` group role enforce this boundary.

## Contracts

Cross-runtime contracts are hand-authored JSON Schema Draft 2020-12 files in `contracts/panda-data/`. They are the canonical wire/storage contracts. Python validates instances with `jsonschema`; the repository contract check also compiles and validates them with Ajv 2020 strict mode.

Pydantic classes inside this project are implementation representations, not a second contract authority.

## Running

```sh
uv sync --directory tools/panda-data --all-extras
uv run --directory tools/panda-data panda-data contracts check
uv run --directory tools/panda-data panda-data source run
uv run --directory tools/panda-data panda-data crawler compare
uv run --directory tools/panda-data panda-data curation validate
uv run --directory tools/panda-data panda-data media process
uv run --directory tools/panda-data panda-data artifact manifest <path> --bucket <bucket> --artifact-kind <kind> --job-id <id>
```

The root scripts `npm run check:panda-curation`, `npm run process:panda-media` and `npm run test:panda-data` wrap the common ones.

Database-backed commands use `PANDA_DATA_DATABASE_URL`, whose login should be a member of `zhipanda_pipeline`. R2 artifact producers use immutable object keys derived from content SHA-256; replacing an object at an existing artifact key is not a supported workflow.

## Out of scope

- HTTP routes, request auth or an HTTP server
- activity, notification, privacy, audit and publication work, which NestJS owns
- a shared Python/TypeScript domain-model package
- pickle/joblib or an ad-hoc database protocol
