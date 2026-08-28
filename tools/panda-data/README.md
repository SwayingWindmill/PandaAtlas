# panda-data

`panda-data` is the independent Python batch/data runtime for PandaAtlas V2. It is not an HTTP backend and it does not own PandaAtlas business truth.

## What belongs here

- reviewed source acquisition and crawler adapters
- research/discovery helpers
- identity-resolution assistance
- enrichment and curation assistance
- media processing and offline artifact construction
- technical pipeline job/attempt/artifact bookkeeping

The extracted data code lives under `src/panda_data` and must not import `services/api/app` or any FastAPI module.

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
```

Database-backed commands use `PANDA_DATA_DATABASE_URL`, whose login should be a member of `zhipanda_pipeline`. R2 artifact producers use immutable object keys derived from content SHA-256; replacing an object at an existing artifact key is not a supported workflow.

## Deliberately not migrated

- FastAPI routes, request auth, or an HTTP server
- activity/notification/privacy/audit business workers now owned by NestJS
- publication/public-read projection builders or D1/Worker release replay
- V1 recovery drills and legacy server-management scripts
- a shared Python/TypeScript domain-model package
- pickle/joblib or an ad-hoc database protocol

Legacy V1 code remains only where the bounded migration still needs it; V2 data jobs should enter through this project.
