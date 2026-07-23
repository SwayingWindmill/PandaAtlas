# Bulk panda enrichment identity intake v1

Issue: #131

Schema version: `panda-atlas-identity-extraction/v1`

## Purpose

This module is the first stage of bulk panda fact extraction and enrichment. It converts structured, source-local identity clues into deterministic `IdentityCandidateRecord` values for the bulk identity resolver introduced by #130.

The stage exists because discovery manifests identify source material, not panda identities. A discovery entry can retain a URL, language, content hash, snapshot reference, and intake candidate ID, but it cannot enter identity resolution until a parser has extracted at least one panda name and any available auxiliary identity features.

This module does not parse live HTML, PDFs, API payloads, or social posts itself. Reviewed source-specific parsers produce `IdentitySubjectExtraction` records through this shared boundary.

## Pipeline position

```text
reviewed discovery provider
  -> discovery manifest and permitted snapshot
  -> source-specific parser
  -> IdentitySubjectExtraction
  -> build_identity_candidate_batch
  -> IdentityCandidateRecord
  -> resolve_identity_batch (#130)
  -> resolved-identity fact and event enrichment
  -> PandaKnowledgeBundle (#128)
```

Identity extraction therefore precedes identity resolution. Full fact reconciliation, conflict selection, translation, and generated summaries occur after a source-local subject has been resolved or explicitly retained as unresolved.

## Public interfaces

Runtime modules live in `services/api/app/enrichment/`.

- `IdentityFieldEvidence`: retains the raw and normalized value, source locator, language, evidence snapshot and body hash, and parser name and version for one identity field.
- `IdentitySubjectExtraction`: represents one source-local panda subject and its normalized identity names and features.
- `IdentityCandidateBatch`: preserves the traceable extractions together with the exact resolver candidates derived from them.
- `build_identity_candidate_batch`: deterministically orders extractions and converts them into #130 `IdentityCandidateRecord` values.

## Source-local subject identity

A source-local subject is identified by:

- a reviewed `source_id`;
- the discovery `intake_candidate_id` that selected the source material;
- a stable parser-defined `subject_key` within that source.

The resolver candidate `record_id` is derived from `source_id` and `subject_key`. It remains stable when the same source-local subject is recollected with changed evidence. The enclosing batch ID is derived from the complete extraction payload, so changed evidence, normalized values, parser versions, or source locators produce a different batch ID.

Model validation recomputes the batch ID when an artifact is loaded. A stale or modified batch ID is rejected.

## Identity fields

The extraction uses the existing #130 identity vocabulary:

- primary, translated, romanized, local, alias, and historical names;
- exact birth date or birth year;
- sex;
- canonical parent IDs when already reviewed;
- source-local parent names when unresolved;
- current and movement institution IDs;
- source relationship IDs;
- stable external identifiers;
- stable wild-individual identifiers;
- captive, released, wild, or unknown population context;
- group-observation state.

Cross-script equivalence is retained only through reviewed `normalized_forms`. The module does not invent equivalence from spelling similarity.

## Field-level evidence requirements

Every normalized value used as an identity-scoring feature must have at least one `IdentityFieldEvidence` record. Required field paths are:

| Identity value | Evidence field path |
| --- | --- |
| Names | `identity.names` |
| Exact birth date | `identity.birth_date` |
| Birth year without an exact date | `identity.birth_year` |
| Sex | `identity.sex` |
| Reviewed parent IDs | `identity.parent_ids` |
| Parent names | `identity.parent_names` |
| Current institutions | `identity.institution_ids` |
| Movement institutions | `identity.movement_institution_ids` |
| Source relationships | `identity.source_relationship_ids` |
| External identifiers | `identity.external_identifiers` |
| Stable wild identifier | `identity.stable_wild_identifier` |
| Non-unknown population context | `identity.population_context` |
| Group observation | `identity.group_observation` |

An extraction with a populated scoring feature but no matching evidence path fails validation. The normalized evidence value must also support the exact extracted scalar or every member of the extracted collection; a path with contradictory normalized evidence is rejected. Evidence records preserve:

- evidence snapshot ID;
- evidence-body SHA-256;
- raw source value;
- normalized value;
- original language;
- exact source locator;
- parser name and version.

## Identity-resolution routing

This module does not duplicate #130 routing rules. Its candidates pass directly to `resolve_identity_batch`:

- a name plus an auxiliary feature can become `create` when no canonical match exists;
- a name-only record becomes `unresolved`;
- a group observation becomes `reject-group`;
- canonical matches, conflicts, confidence, merge, and review behavior remain owned by #130.

The extraction batch validates that every extraction maps to exactly one candidate and that names, features, source ID, and population context cannot drift during conversion.

## Determinism and write boundary

Input extraction order does not affect output order or the generated batch ID. Duplicate source-local subjects are rejected.

The batch declares empty trusted and publication write targets. Source parsers and this conversion stage cannot write canonical identities, trusted facts, publication batches, database rows, or public pages.

## Contract and fixtures

Checked-in files:

- `contracts/panda-identity-extraction.v1.json`;
- `contracts/panda-identity-extraction-fixtures/v1/multilingual.valid.json`;
- `contracts/panda-identity-extraction-fixtures/v1/unresolved-name-only.valid.json`;
- `contracts/panda-identity-extraction-fixtures/v1/group-observation.valid.json`.

The fixtures cover:

- Chinese, English, Japanese, and Korean name forms with reviewed cross-script normalization;
- a named record with auxiliary identity features that can enter the create path;
- a name-only record that remains unresolved;
- a wild group observation that cannot create an individual panda page.

Regenerate the schema and fixtures from `services/api`:

```bash
uv run python scripts/generate_identity_extraction_contract.py
```

## Verification

```bash
uv run pytest -q tests/enrichment
uv run ruff check app/enrichment tests/enrichment scripts/generate_identity_extraction_contract.py
uv run python -m compileall -q app/enrichment
```

Broad integration, real provider execution, publication-batch verification, Linux and Windows clean-checkout CI, browser testing, accessibility testing, release evidence, and rollback drills remain deferred to the #127 map-closing ticket.

## Deferred #131 work

This slice does not yet implement:

- live source parsers or provider network access;
- general fact and event extraction after identity resolution;
- source-quality and assertion-confidence scoring;
- conflict reconciliation and default-value selection;
- direct versus inferred assertion derivations;
- synchronized Chinese and English normalized presentation;
- generated summaries and sentence-level assertion traceability.

Those capabilities should build on this identity-intake boundary rather than bypassing #130 identity resolution.
