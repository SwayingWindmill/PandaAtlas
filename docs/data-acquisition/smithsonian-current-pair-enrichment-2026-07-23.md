# Smithsonian current-pair enrichment cohort — 2026-07-23

Issue: #131

## Decision

The reviewed Smithsonian exact-URL adapter now has a complete downstream path into the new identity, fact, conflict, and bilingual-summary contracts.

This slice reuses the existing production adapter and fixture-locked parser. It does not add a broader crawler and does not perform a new live network run.

## Reviewed acquisition boundary

Source:

- `smithsonian-national-zoo-panda-pages`

Adapter:

- `smithsonian-panda-profiles`

Approved exact URLs represented by the fixture:

- `https://nationalzoo.si.edu/animals/giant-panda`
- `https://nationalzoo.si.edu/animals/giant-panda-faqs`
- `https://nationalzoo.si.edu/animals/history-giant-pandas-zoo`

The existing adapter still owns HTTP policy, evidence snapshots, semantic HTML anchors, parser drift failure, source-local subject keys, and reconciliation against reviewed curation.

The new bridge begins only after a completed `AcquisitionBundle` exists.

## Cohort scope

The bridge selects exactly two source-local subjects:

- `smithsonian:bao-li`
- `smithsonian:qing-bao`

Selection is based on reviewed source-local keys, not on accepting the old reconciliation match as the final identity decision.

For those two subjects, the bridge verifies that acquisition reconciliation is conservative and then independently constructs `IdentitySubjectExtraction` records from:

- official English name;
- day-precision birth date;
- sex;
- field-level evidence snapshot, body SHA-256, CSS locator, acquisition candidate ID, and parser version.

The resulting identity candidates are sent through #130 again against explicit canonical identity records. Both candidates must resolve as high-confidence `merge` decisions. A review, create, unresolved result, unexpected merge target, or birth-date conflict stops the cohort.

## Canonical provenance

The bridge requires both:

- canonical identity records;
- the complete `SourceEvidence` inventory referenced by those records.

It does not remove existing canonical source IDs when constructing the knowledge bundle. Missing, duplicate, or extra canonical source evidence is rejected.

The acceptance script loads Bao Li and Qing Bao from the repository's content-addressed reviewed reconciliation snapshot rather than duplicating canonical values in the script.

## Candidate partition

The fixture adapter emits 74 candidates. The cohort partitions every candidate exactly once:

| Partition | Count | Meaning |
| --- | ---: | --- |
| Selected | 22 | Consumed by identity extraction or fact enrichment |
| Deferred | 6 | In-scope but intentionally not converted |
| Out of scope | 46 | Other Smithsonian pandas in the three-page bundle |
| **Total** | **74** | Complete acquisition bundle coverage |

The six deferred candidates are:

- two explicit source omissions of current life status;
- four parent-name relationship statements.

Parent names are not converted to `RelationshipAssertion` records because the source provides names, not explicit canonical target panda IDs. The bridge does not use current curation parent slugs to manufacture source-backed relationship targets.

Any selected candidate marked `contradiction` stops the cohort before fact enrichment.

## Fact output

The cohort produces 16 assertions across two panda records:

| Field | Assertions |
| --- | ---: |
| `birth.date` | 4 |
| `birth.place` | 2 |
| `events.arrival` | 2 |
| `events.public_debut` | 2 |
| `identity.sex` | 4 |
| `residence.current` | 2 |

Duplicate official statements from separate reviewed pages remain separate assertions with separate evidence snapshots. Agreement contributes corroboration rather than being silently deduplicated.

Confidence mapping is:

- `unchanged` and `enrichment` → high;
- `new`, `missing-current-value`, and `not-compared` → medium;
- `contradiction` → rejected before enrichment.

This mapping affects conclusion qualification and publication review routing but never changes the original acquisition conflict state or evidence.

## Bilingual output

The deterministic summary generator emits four sentence pairs:

- Bao Li birth date;
- Bao Li sex;
- Qing Bao birth date;
- Qing Bao sex.

Birthplace, residency, and event assertions remain in the knowledge bundle but are not freely paraphrased because v1 has no reviewed bilingual template for those normalized structures.

The final two records contain 24 generated `TranslationValue` records across normalized values and sentence pairs.

## Integrity boundaries

The cohort result verifies:

- all 74 acquisition candidate IDs belong to exactly one partition;
- partitions are sorted, unique, disjoint, and complete;
- identity extraction and #130 resolution use the same candidate records;
- fact enrichment references the exact identity-resolution batch;
- bilingual generation embeds the exact fact-enrichment batch;
- acquisition, identity, fact, bilingual, trusted, and publication write targets remain empty.

No trusted curation, public projection, media, relationship graph, or immutable release is modified.

## Acceptance command

From `services/api`:

```bash
uv run python scripts/check_smithsonian_current_pair_enrichment.py
```

Expected metrics:

```text
acquisition candidates: 74
selected: 22
deferred: 6
out of scope: 46
identity decisions: 2 merge
fact assertions: 16
summary sentences: 4
translations: 24
```

Focused tests:

```bash
uv run pytest -q tests/enrichment/test_smithsonian_current_pair_cohort.py
```

The tests cover:

- the complete fixture-backed path;
- complete canonical source provenance;
- identity birth-date conflict failure;
- acquisition candidate contradiction failure;
- publication eligibility and zero-write boundaries.

## Live replay result and next integration step

The same three reviewed Smithsonian URLs passed a bounded live replay on 2026-07-23. Acquisition candidates, candidate partitions, facts, conclusions, bilingual values, sentences, and translations were semantically equal to the fixture cohort despite new full-page evidence hashes. See `docs/data-acquisition/smithsonian-current-pair-live-replay-2026-07-23.md`.

The next acquisition slice should select a new exact-URL institutional adapter with meaningful overlap against `needs_primary_source` records.

That slice must not broaden path allowlists, infer parent target IDs from names, or bypass #130 and the fact/bilingual semantic revalidation layers.
