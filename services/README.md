# Service boundary

`services/` contains the production backend runtime:

- [`api`](api/) is the authoritative NestJS/Fastify application boundary running on Vercel.

Business data authority is Supabase PostgreSQL; authentication authority is Supabase Auth. Cloudflare Worker/D1 projection services were retired at the V2 production cutover and are not part of the runtime graph.

`services/api` is an npm workspace. Offline acquisition, enrichment, curation, and data-processing Python code lives under `tools/panda-data`, outside the online API runtime.
