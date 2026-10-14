# Service boundary

`services/` contains the production backend runtime:

- [`api`](api/) is the authoritative NestJS application (Express adapter) running as a Cloudflare Worker.

Business data authority is Supabase PostgreSQL; authentication authority is Supabase Auth.

`services/api` is an npm workspace. Offline acquisition, curation and media Python code lives under `tools/panda-data`, outside the online API runtime.
