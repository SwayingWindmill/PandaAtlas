# ADR 0002: Managed services only

- Status: accepted (2026-08-01); the provider plan in the original record was superseded

ZhiPanda runs only on managed services: no self-managed virtual machine, Docker host, PostgreSQL server or other persistent application server in production. Local Docker and PostgreSQL serve development and recovery drills only. Bounded batch work runs in GitHub Actions; long-running imports, crawls and media processing never run inside request-bound functions.

The owner selected this managed-only operating model; a later proposal should not reintroduce a server to operate. The original record planned a move to Vercel; production instead runs on Cloudflare Workers with Supabase, as `docs/deployment/runtime-status.md` describes.
