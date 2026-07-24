# Chengdu bounded cohort plan — 2026-07-23

## Objective

Implement the first breadth-first acquisition slice for the Chengdu official source family.

## Scope

- Cohort: 64 unique pandas.
- Priority: 21 `needs_primary_source` and 31 `partial` records.
- Output: review-only acquisition bundles and candidate facts.
- No direct trusted or publication writes.

## Adapter boundary

The adapter must use an exact reviewed URL manifest.

It should produce:

- source-local identity keys;
- name candidates;
- birth facts;
- parent-name candidates;
- location candidates;
- dated event candidates;
- evidence snapshots.

It must not:

- infer parent IDs from names;
- overwrite existing trusted facts;
- crawl unrelated site areas;
- create public records directly.

## Execution slices

1. Source review and exact URL manifest.
2. Fixture-first parser implementation.
3. Bounded live cohort replay.
4. Identity resolution through #130.
5. Fact enrichment through #131.
6. Curator patch generation.

## Success criteria

- deterministic fixture parsing;
- live replay semantic equality;
- complete acquisition bundle;
- zero trusted writes during acquisition;
- measurable yield against the 64 panda cohort.
