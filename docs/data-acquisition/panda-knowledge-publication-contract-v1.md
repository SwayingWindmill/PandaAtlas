# Panda knowledge and publication contract v1

Issue: #128

Schema version: `panda-atlas-knowledge-bundle/v1`

## Purpose

`PandaKnowledgeBundle` is the canonical boundary between discovery/review work and immutable public publication batches. It preserves exact evidence and uncertainty while allowing breadth-first publication of sparse panda profiles.

The contract does not let collectors write canonical or public data. A collector, parser, curator, contribution review, or migration step emits a validated knowledge bundle. The publication-batch workstream consumes only validated bundles and their deterministic publication decisions.

## Files

- Runtime contract: `services/api/app/knowledge/contracts/v1.py`
- Public imports: `services/api/app/knowledge/contracts/__init__.py`
- Legacy patch migration: `services/api/app/knowledge/migration.py`
- Generated JSON Schema: `contracts/panda-knowledge.v1.json`
- Acceptance fixtures: `contracts/panda-knowledge-fixtures/v1/*.json`
- Generator: `services/api/scripts/generate_panda_knowledge_contract.py`

Regenerate the checked-in schema and fixtures from `services/api`:

```bash
uv run python scripts/generate_panda_knowledge_contract.py
```

## Identity contract

Every resolved public panda has:

- an immutable internal identity key;
- a canonical panda ID and stable canonical slug;
- at least one sourced primary name;
- a high-confidence identity resolution before automatic publication.

Names, aliases, historic slugs, and external identifiers retain their own source IDs. A newly created identity requires at least one auxiliary feature in addition to its name, such as a facility, date, parent, sex, field identifier, or studbook identifier.

Unresolved records retain candidate panda IDs internally, but cannot expose canonical IDs, slugs, or public pages. Merge and split states require explicit predecessor identifiers so their decisions can be reversed.

## Source quality and assertion confidence

Source quality and fact confidence are separate dimensions.

`SourceAssessment` records an independent source band plus authority, recency, specificity, consistency, and corroboration scores. Newly discovered sources default to low source confidence until assessed.

Each `FactAssertion` independently records high, medium, or low confidence. This permits later reconciliation to raise an assertion through corroboration without rewriting the original source assessment.

Publication routing is deterministic:

| Item | High | Medium | Low |
| --- | --- | --- | --- |
| Resolved identity | automatic | review required | review required |
| Active fact | public | public | review only |
| Active relationship | confirmed/public | tentative/public | review only |
| Panda-image match | public eligible | public gallery eligible, not main image | internal candidate only |

## Facts, derivations, conflicts, corrections, and withdrawals

Facts preserve raw and normalized values separately. Extensible field paths allow new information to be retained before it becomes a dedicated first-class field.

Direct and inferred facts are distinct:

- inferred assertions require a named derivation rule, input assertion IDs, and explanation;
- derivation inputs must exist, remain active, and be at least medium confidence;
- an inferred assertion cannot replace an active direct assertion as the primary value for the same field.

A `FactConclusion` selects the public primary assertion. A disputed conclusion retains at least one alternative assertion. Assertions are never silently overwritten:

- corrected values supersede prior assertions through `superseded_by`;
- withdrawn assertions require a withdrawal reason;
- superseded and withdrawn assertions remain in history but are excluded from automatic publication.

Medium-confidence death causes require a `reported` or `unconfirmed` qualifier. Dates and causes remain separate assertions and can have different confidence.

## Evidence and legacy migration

`EvidenceReference` can retain the complete acquisition trail:

- source and evidence snapshot IDs;
- evidence-body SHA-256;
- source locator;
- acquisition bundle and run IDs;
- candidate, decision, and proposal IDs;
- parser name and version;
- complete legacy proposal payload.

`migrate_curation_patch_proposal` converts an accepted `CurationPatchProposal` into a v1 fact assertion without dropping raw values, normalized values, locators, hashes, review decisions, or legacy payload data.

`migrate_trusted_profile` converts the legacy `TrustedIdentity` and `EvidenceAssertion` projection. It preserves the complete legacy records with deterministic payload hashes and maps legacy publication status explicitly: `published` becomes public, `draft` becomes review-only, and `restricted` remains restricted. Migration therefore cannot accidentally promote previously non-public data.

## Relationships and lineage

High-confidence relationships use `confirmed`; medium-confidence relationships use `tentative`. Both can enter the public lineage projection, where the frontend must render them with distinct styles. Low-confidence relationships use `review-only` and cannot publish.

Disputed, superseded, and withdrawn relationship history remains auditable. A replacement relationship must address the same subject, object, and relationship type.

## Media dual-library contract

Panda identity confidence and media rights are independent.

The internal candidate library may hold discovered media with unknown rights. The public library accepts only:

- public-domain media;
- open-license media with license name and URL;
- explicitly authorized media with an authorization reference.

A public main image additionally requires high-confidence panda matching. A profile with no cleared media remains publishable and receives the `missing-cleared-media` warning. This is an informational warning, not a publication blocker.

Withdrawn media cannot remain in the public library and must retain a withdrawal reason.

## Translations and generated summaries

Source-language text retains source IDs. Generated translations and summaries require:

- the exact active high- or medium-confidence assertion IDs used;
- a generator version;
- a generation timestamp.

Low-confidence, superseded, or withdrawn assertions cannot feed generated public text. Reviewed, outdated, and withdrawn translation states preserve reviewer, replacement, or withdrawal metadata.

## Sensitive locations

Captive locations may publish at supported precision when sourced. Wild and released pandas cannot expose exact or facility-level activity locations through the public contract.

Generalized and restricted location records preserve the restricted value internally while exposing at most locality-, region-, country-, or unknown-level public information.

## Public contributions

Corrections, source suggestions, media-rights leads, and photo uploads remain reviewable contributions. They never directly alter public data.

Photo uploads require a rights declaration containing the declarant, ownership or authorization basis, license scope, evidence references, and declaration time. Approved and rejected contributions require reviewer, decision time, and reason. Withdrawn contributions require a withdrawal reason.

Approved contributions must re-enter the same identity, evidence, confidence, rights, and immutable publication-batch gates as automated discovery.

## Minimum public profile

A resolved identity with a stable ID, stable slug, sourced primary name, and at least one traceable source can auto-publish when identity confidence is high.

Additional facts, relationships, translations, and cleared media are enrichments rather than prerequisites. This v1 bulk-publication rule supersedes the photo-required gate in `contracts/panda-expansion.v1.json` for the new #127 pipeline. The older contract remains unchanged for reproducibility of legacy releases.

## Fixtures

The checked-in fixture set covers:

- direct evidence;
- inferred values;
- conflicting values with a selected primary;
- corrected/superseded values;
- withdrawn values;
- tentative lineage;
- unresolved identity;
- a publishable profile with no cleared media.

Targeted verification:

```bash
uv run pytest -q tests/knowledge
uv run ruff check app/knowledge tests/knowledge scripts/generate_panda_knowledge_contract.py
uv run python -m compileall app/knowledge
```
