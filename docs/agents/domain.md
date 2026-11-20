# Domain Docs

Engineering skills should consult the repository's domain documentation before proposing or implementing changes.

## Before exploring

Read the root `GLOSSARY-MAP.md` when it exists. It identifies the bounded contexts and points to their respective `GLOSSARY.md` files.

Read the context documents relevant to the work being performed.

Also inspect `docs/architecture/` for system-wide architectural decisions.

Missing files should not block work or produce warnings. The `domain-modeling`, `grill-with-docs`, and `improve-codebase-architecture` skills create domain documentation lazily when terminology or architectural decisions are resolved.

## Multi-context layout

PandaAtlas uses the following domain documentation structure:

```text
/
├── GLOSSARY-MAP.md
├── docs/
│   └── architecture/
│       └── GLOSSARY.md
└── contracts/
    └── golden-dataset/
        └── GLOSSARY.md
```

The primary contexts are:

- **Trusted Archive**: stable identities, sourced assertions, relationships, residencies, domain events, publication readiness, and the golden dataset
- **Curation Intake**: incomplete or contradictory working records awaiting review
- **Public Projection & Fan Product**: reviewed, versioned, public-safe data consumed by the public API, snapshots, and fan experiences

The root `GLOSSARY-MAP.md` describes relationships and ownership boundaries across all bounded contexts.

## Vocabulary

When issues, tests, specifications, or refactor proposals name domain concepts, use the frozen canonical terminology defined by `docs/architecture/GLOSSARY.md` and `contracts/golden-dataset/GLOSSARY.md`.

Avoid introducing new synonyms for concepts that already have canonical names (for example, do not introduce `venue`/`site` for `Place`, `favorite`/`bookmark` for `Follow`, or reuse bare `checkin` across `Place Visit` and `Daily Check-in`).

When required terminology is missing, treat that as a potential domain-modeling gap.

## Architectural decisions

Existing ADRs take precedence over undocumented assumptions.

When proposed work conflicts with an ADR, report the conflict explicitly rather than silently overriding the decision.
