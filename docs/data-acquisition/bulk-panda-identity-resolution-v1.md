# Bulk panda identity resolution and duplicate control v1

Issue: #130

Schema version: `panda-atlas-identity-resolution/v1`

## Purpose

This module resolves multilingual discovery and extraction records against canonical panda identities without allowing ambiguous identities to create duplicate public pages. It produces immutable decisions and batch-validation candidates; it does not directly write trusted identity storage or public pages.

Runtime code lives in `services/api/app/identity_resolution/`.

## Public interfaces

- `canonical_record_from_panda_identity`: convert the existing canonical `PandaIdentity` knowledge contract into resolver input.
- `resolve_identity_batch`: resolve a bulk candidate set using deterministic indexed matching.
- `plan_identity_merge`: describe a reviewed canonical merge with complete before/after snapshots and rollback data.
- `plan_identity_split`: describe a reviewed canonical split with complete before/after snapshots and rollback data.
- `build_identity_resolution_package`: combine one resolution batch and reviewed high-risk changes into an immutable package.
- `write_identity_resolution_package`: write a deterministic, atomic package artifact.

## Input model

A canonical or candidate identity includes sourced names and a structured feature set:

- names, aliases, romanizations, translated names, historical names, and local names;
- external identifiers and stable wild-individual identifiers;
- exact birth date or birth year;
- sex;
- parent IDs and parent names;
- institutions and movement institutions;
- source relationship IDs;
- captive, released, wild, or unknown population context;
- a group-observation flag.

`IdentityNameClaim.normalized_forms` records reviewed cross-script equivalences. For example, Chinese, Japanese, Korean, and Latin-script forms may all carry the same normalized romanized form. The resolver does not invent cross-language equivalence from spelling alone.

## Candidate index

The resolver builds an inverted index over canonical records. Keys are generated from normalized name forms, stable identifiers, birth information, parents, institutions, movements, and source relationships. A candidate is scored only against canonical identities reached through this index.

This prevents a Cartesian candidate-by-canonical scan. Output ordering is independent of input ordering, and stable IDs are generated from canonical JSON and SHA-256.

## Deterministic score

Positive evidence weights are:

| Evidence | Weight |
| --- | ---: |
| Stable external identifier | 900 |
| Name, alias, translated name, or historical-name match | 400 |
| Exact birth date | 260 |
| Birth year | 180 |
| Parent ID | 180 |
| Parent name | 140 |
| Source relationship | 100 |
| Institution | 90 |
| Movement institution | 60 |
| Sex | 60 |
| Population context | 30 |

Hard conflicts are:

| Conflict | Weight |
| --- | ---: |
| Different exact birth dates | -450 |
| Different birth years | -260 |
| Different sex values | -150 |

A hard conflict prevents a high- or medium-confidence match even when the remaining numeric score is high.

Thresholds:

- high: at least 550 with no hard conflict;
- medium: at least 350 with no hard conflict;
- low: below 350 or any hard conflict.

A high match must also be uniquely separated from the second result by at least 75 points before automatic merge. Otherwise it enters review.

Every score retains human-readable evidence with code, label, signed weight, detail, and conflict status.

## Decision routing

- `merge`: a unique high-confidence match; enters batch validation.
- `review`: medium confidence or high-confidence ambiguity; internal only.
- `create`: no plausible canonical match, with a sourced name and at least one auxiliary identity feature; enters batch validation under a stable new panda ID.
- `unresolved`: name-only identity or missing auxiliary evidence; internal only.
- `reject-group`: group sighting rather than an identifiable individual; internal only.

Only `merge` and `create` decisions become `PandaIdentity` validation candidates. The batch model verifies that validation candidate keys exactly match the public-eligible decisions. Unresolved, review, and group records cannot be inserted into that projection.

## Wild individuals

A wild panda may be created when it has a sourced stable name or identifier and at least one auxiliary identity feature. Group sightings are explicitly blocked from individual creation. This module stores no public location coordinates.

## Reversible merge and split operations

Canonical merge and split operations are high risk. Each `IdentityChangeSet` retains:

- all complete pre-operation records;
- all complete post-operation records;
- SHA-256 hashes for every snapshot;
- actor, timestamp, and human-readable evidence;
- an immutable audit ID derived from the complete audit payload;
- a rollback plan that removes all post-operation IDs and restores all pre-operation records.

Model validation recomputes snapshot hashes, audit ID, rollback payload, operation direction, and record ordering. A modified snapshot, reason, hash, or rollback plan is rejected.

## Artifacts

`write_identity_resolution_package` writes:

- `panda-identity-resolution.v1.json`.

The file uses canonical JSON and atomic replacement. Rewriting identical content is idempotent; replacing different content requires explicit overwrite.

Checked-in contract files:

- `contracts/panda-identity-resolution.v1.json`;
- `contracts/panda-identity-resolution-fixtures/v1/alias.valid.json`;
- `contracts/panda-identity-resolution-fixtures/v1/changed-name.valid.json`;
- `contracts/panda-identity-resolution-fixtures/v1/exact.valid.json`;
- `contracts/panda-identity-resolution-fixtures/v1/merge.valid.json`;
- `contracts/panda-identity-resolution-fixtures/v1/same-name-different-panda.valid.json`;
- `contracts/panda-identity-resolution-fixtures/v1/split.valid.json`;
- `contracts/panda-identity-resolution-fixtures/v1/translated-name.valid.json`;
- `contracts/panda-identity-resolution-fixtures/v1/unresolved-name-only.valid.json`.

Regenerate from `services/api`:

```bash
uv run python scripts/generate_identity_resolution_contract.py
```

## Verification

```bash
uv run pytest -q tests/identity_resolution
uv run ruff check app/identity_resolution tests/identity_resolution scripts/generate_identity_resolution_contract.py
uv run python -m compileall -q app/identity_resolution
```
