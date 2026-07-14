# Domain Docs

Engineering skills should consult the repository's domain documentation before proposing or implementing changes.

## Before exploring

Read the root `CONTEXT-MAP.md` when it exists. It identifies the bounded contexts and points to their respective `CONTEXT.md` files.

Read the context documents relevant to the work being performed.

Also inspect:

- `docs/architecture/` for system-wide architectural decisions
- context-specific architecture documents linked by the root context map

Missing files should not block work or produce warnings. The `domain-modeling`, `grill-with-docs`, and `improve-codebase-architecture` skills create domain documentation lazily when terminology or architectural decisions are resolved.

## Multi-context layout

PandaAtlas uses the following domain documentation structure:

```text
/
├── CONTEXT-MAP.md
├── docs/
│   └── architecture/
└── contracts/
    └── golden-dataset/
        └── CONTEXT.md
```

The primary contexts are:

- **Trusted Archive** — stable identities, sourced assertions, relationships, residencies, domain events, publication readiness, and the golden dataset
- **Curation Intake** — incomplete or contradictory working records awaiting review
- **Public Projection** — reviewed, versioned, public-safe data consumed by APIs, D1, snapshots, and browser experiences

The root `CONTEXT-MAP.md` should describe relationships and ownership boundaries between these contexts.

## Vocabulary

When issues, tests, specifications, or refactor proposals name domain concepts, use the terminology defined by the relevant `CONTEXT.md`.

Avoid introducing synonyms for concepts that already have canonical names.

When required terminology is missing, treat that as a potential domain-modeling gap.

## Architectural decisions

Existing ADRs take precedence over undocumented assumptions.

When proposed work conflicts with an ADR, report the conflict explicitly rather than silently overriding the decision.
