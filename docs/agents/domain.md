# Domain Docs

Engineering skills should consult the repository's domain documentation before proposing or implementing changes.

## Before exploring

Read the root `CONTEXT-MAP.md` when it exists. It identifies the bounded contexts and points to their respective `CONTEXT.md` files.

Read the context documents relevant to the work being performed.

Also inspect:

- `docs/adr/` for system-wide architectural decisions
- `<context>/docs/adr/` for context-specific decisions

Missing files should not block work or produce warnings. The `domain-modeling`, `grill-with-docs`, and `improve-codebase-architecture` skills create domain documentation lazily when terminology or architectural decisions are resolved.

## Multi-context layout

PandaAtlas uses the following intended domain documentation structure:

```text
/
├── CONTEXT-MAP.md
├── docs/
│   └── adr/
├── apps/
│   └── web/
│       ├── CONTEXT.md
│       └── docs/adr/
├── services/
│   ├── api/
│   │   ├── CONTEXT.md
│   │   └── docs/adr/
│   └── worker-api/
│       ├── CONTEXT.md
│       └── docs/adr/
└── infra/
    ├── CONTEXT.md
    └── docs/adr/
```

The primary contexts are:

- **Web experience** — public atlas UI, panda profiles, lineage browsing, maps, and Next.js BFF routes
- **FastAPI service** — REST API behavior, validation, imports, and PostGIS access
- **Cloudflare Worker read projection** — versioned public GET behavior backed by D1 and R2; no domain writes or admin imports
- **Infrastructure and data** — database migrations, seed data, Cloudflare resources, and deployment infrastructure

The root `CONTEXT-MAP.md` should describe relationships and ownership boundaries between these contexts.

## Vocabulary

When issues, tests, specifications, or refactor proposals name domain concepts, use the terminology defined by the relevant `CONTEXT.md`.

Avoid introducing synonyms for concepts that already have canonical names.

When required terminology is missing, treat that as a potential domain-modeling gap.

## Architectural decisions

Existing ADRs take precedence over undocumented assumptions.

When proposed work conflicts with an ADR, report the conflict explicitly rather than silently overriding the decision.
