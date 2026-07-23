# Bulk panda fact and relationship enrichment v1

Issue: #131

Schema version: `panda-atlas-fact-enrichment/v1`

## Purpose

This module is the second stage of bulk panda enrichment. It consumes high-confidence `merge` and `create` identities from #130 together with structured facts and explicitly resolved relationships, then produces the existing `PandaKnowledgeBundle` contract from #128.

It is deliberately downstream of identity resolution. Facts belonging to `review`, `unresolved`, or `reject-group` identity decisions cannot enter a knowledge bundle.

Runtime modules live in `services/api/app/enrichment/`:

- `fact_contracts.py` defines the versioned extraction, score, and batch models;
- `fact_enrichment.py` converts extraction records into canonical assertions, conclusions, relationships, and a deterministic knowledge bundle.

## Pipeline position

```text
reviewed source material and snapshots
  -> source-specific parser
  -> identity extraction v1
  -> bulk identity resolution (#130)
  -> ExtractedFact / ExtractedRelationship
  -> build_fact_enrichment_batch
  -> PandaKnowledgeBundle (#128)
  -> translation and summary generation
  -> immutable publication batch (#133)
```

Collectors and parsers still have no trusted, database, or publication write target.

## Public interfaces

### `ExtractedFact`

One source-local fact retains:

- resolved identity record ID;
- source and discovery intake candidate IDs;
- extensible field path;
- raw and normalized values;
- original language;
- assertion confidence and publication scope;
- direct or inferred evidence mode;
- qualifier where required;
- assertion lifecycle;
- evidence snapshot ID and body SHA-256;
- exact source locator;
- parser name and version;
- explicit derivation rule and input fact IDs for inferred values.

The fact ID is derived from the source-local evidence identity, values, locator, and parser version. Confidence rescoring and lifecycle transitions are retained in the enclosing immutable batch without silently changing the evidence identity.

### `ExtractedRelationship`

A relationship requires an explicit target panda ID. Parsers cannot emit a relationship from a parent name alone and cannot infer an object ID from spelling, sex, cohort membership, dates, existing lineage fields, or graph structure.

The extraction retains the original relationship text, language, source locator, evidence hash, parser version, relationship type, confidence, and status. Default routing is:

| Confidence | Default status | Publication route |
| --- | --- | --- |
| High | `confirmed` | Public eligible |
| Medium | `tentative` | Public eligible with tentative lineage styling |
| Low | `review-only` | Internal review only |

High- or medium-confidence relationships may be explicitly marked `disputed`. Low-confidence relationships cannot be promoted beyond `review-only`.

### `build_fact_enrichment_batch`

The builder:

1. accepts only validation candidates from high-confidence #130 `merge` and `create` decisions;
2. validates every fact and relationship source against the supplied `SourceEvidence` inventory;
3. converts source-local evidence into canonical `FactAssertion` and `RelationshipAssertion` records;
4. retains low-confidence material while routing it to review;
5. builds one conclusion for every fact field;
6. calculates inspectable default-value scores;
7. creates a deterministic `PandaKnowledgeBundle`;
8. returns an immutable `FactEnrichmentBatch` with empty trusted and publication write targets.

Input source, fact, and relationship order does not affect output ordering or IDs.

## Extensible facts and events

Dedicated core fields may use stable paths such as:

- `identity.sex`;
- `birth.date` and `birth.year`;
- `status.current`;
- `residence.current`;
- `death.date` and `death.cause`.

Additional profile material is not discarded. Parsers may use extensible paths such as:

- `events.transfer`;
- `events.release`;
- `events.breeding`;
- `health.weight`;
- `health.condition`;
- `behavior.favorite_food`;
- `awards.<award-key>`.

An event normalized value should be a JSON object containing only explicitly sourced fields, for example event date or date precision, institution IDs, related panda IDs, and source-local event labels. The enrichment boundary does not infer missing event dates, locations, or participants.

## Confidence and publication routing

When publication scope is omitted:

- high- and medium-confidence facts default to `public`;
- low-confidence facts default to `review-only`.

A parser cannot explicitly mark a low-confidence fact public. Restricted or otherwise policy-limited facts may explicitly use a non-public scope regardless of confidence.

The canonical publication evaluator remains the final source of truth. This module does not create a parallel publication policy.

## Default-value scoring

Every assertion receives a `FactSelectionScore`. The score is inspectable and recomputed when an artifact is loaded.

| Component | Points |
| --- | ---: |
| High assertion confidence | 1000 |
| Medium assertion confidence | 600 |
| Low assertion confidence | 0 |
| Direct evidence | 120 |
| High source confidence | 200 |
| Medium source confidence | 100 |
| Low source confidence | 0 |
| At least one first-hand source | 100 |
| Source authority | 0–100 |
| Source recency | 0–100 |
| Source specificity | 0–100 |
| Source consistency | 0–100 |
| Source assessment corroboration | 0–100 |
| Each additional independent source supporting the same value | 75 |

Independent corroboration is scoped to the same resolved panda, field path, and normalized value. Identical values belonging to different pandas never corroborate one another.

For assertions with multiple sources, each source-quality component uses the highest reviewed value. v1 parser output normally produces one assertion per source; independent sources therefore remain independently inspectable assertions.

Score ties are resolved by stable assertion ID.

## Conclusions and conflicts

For each field:

- no active public high- or medium-confidence assertion produces `unknown`;
- one selected high-confidence value produces `confirmed`;
- one selected medium-confidence value produces `tentative`;
- multiple distinct publishable normalized values produce `disputed`.

A disputed conclusion retains its selected primary assertion and every distinct alternative assertion. Minority assertions are never deleted.

A direct active assertion always remains primary over a conflicting inferred assertion, even when the inferred assertion has a higher numeric score. This enforces the #128 rule that a derived value cannot replace direct evidence.

Assertions supporting the same normalized value increase corroboration but are not mislabeled as conflicting alternatives.

## Inferred values

An inferred fact requires:

- a named derivation rule;
- sorted unique input fact IDs;
- a human-readable explanation.

Every input must:

- belong to the same resolved panda;
- exist in the same batch;
- remain active;
- have high or medium confidence.

Direct facts cannot carry derivation metadata.

## Corrections, supersession, and withdrawal

Corrections preserve both records:

- the old fact uses lifecycle `superseded` and points to the replacement fact ID;
- the replacement remains active;
- both assertions retain their original evidence and parser metadata;
- conclusions select only active assertions.

A superseded fact must identify a replacement fact addressing the same field and cannot supersede itself.

Withdrawn facts require an explicit withdrawal reason. Withdrawn and superseded assertions remain auditable but cannot become public conclusions or generated-text inputs.

## Death-cause qualifiers

A medium-confidence `death.cause` fact requires either:

- `reported`; or
- `unconfirmed`.

The extraction contract rejects an unqualified medium-confidence death cause before knowledge-bundle construction. Death date and death cause remain separate assertions and may carry different confidence values.

## Evidence and relationship provenance

Canonical fact assertions receive `EvidenceReference` values containing:

- source ID;
- evidence snapshot ID;
- evidence-body SHA-256;
- exact source locator;
- discovery intake candidate ID;
- parser name and version.

The current #128 `RelationshipAssertion` contract has source-level provenance but no field-level `EvidenceReference`. `FactEnrichmentBatch.relationships` therefore retains the complete source-local relationship evidence alongside the canonical relationship projection. The one-to-one relationship ID mapping is validated when an artifact is loaded.

## Determinism and integrity

The following values are content-derived and recomputed during validation:

- fact assertion IDs;
- relationship assertion IDs;
- selection score totals and components;
- knowledge bundle ID;
- fact enrichment batch ID.

The batch verifies:

- exact one-to-one fact-to-assertion mapping;
- exact one-to-one extracted-to-canonical relationship mapping;
- sorted unique resolved record IDs;
- sorted unique source-local facts and relationships;
- knowledge records matching #130 public candidate record IDs;
- score recomputation;
- zero trusted and publication write targets.

Changing evidence, values, parser versions, conclusions, scores, relationships, or bundle content while retaining an old ID causes validation failure.

## Contract and fixtures

Checked-in files:

- `contracts/panda-fact-enrichment.v1.json`;
- `contracts/panda-fact-enrichment-fixtures/v1/direct-and-review.valid.json`;
- `contracts/panda-fact-enrichment-fixtures/v1/conflict.valid.json`;
- `contracts/panda-fact-enrichment-fixtures/v1/inferred.valid.json`;
- `contracts/panda-fact-enrichment-fixtures/v1/correction.valid.json`;
- `contracts/panda-fact-enrichment-fixtures/v1/tentative-relationship.valid.json`.

Regenerate from `services/api`:

```bash
uv run python scripts/generate_fact_enrichment_contract.py
```

Targeted verification:

```bash
uv run pytest -q tests/enrichment
uv run ruff check app/enrichment tests/enrichment scripts/generate_identity_extraction_contract.py scripts/generate_fact_enrichment_contract.py scripts/generate_bilingual_summary_contract.py
uv run python -m compileall -q app/enrichment
```

## Downstream bilingual generation

Deterministic bilingual normalized values and sentence-level summaries are implemented by `panda-atlas-bilingual-summary/v1`. See `docs/data-acquisition/bilingual-panda-summary-generation-v1.md`.

## Deferred integration work

The Smithsonian current-pair cohort now exercises one reviewed production parser through identity resolution, fact enrichment, bilingual generation, and a bounded live replay. Remaining integration work includes:

- additional source-specific production parsers and a second institutional cohort targeting `needs_primary_source` records;
- replacement links for translations from an older published summary batch;
- automatic relationship conflict grouping across multiple object IDs.

Those additions must consume these contracts rather than bypassing identity resolution, assertion confidence, conflict preservation, or evidence provenance.
