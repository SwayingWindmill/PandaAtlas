# Immutable collection release compiler — first slice — 2026-07-24

Issue: [#133 — Add risk-tiered validation and immutable automatic publication batches](https://github.com/SwayingWindmill/PandaAtlas/issues/133)

## Outcome

This slice replaces the manual `curation CSV → reviewed batch → Public Release` assembly step with a deterministic compiler.

The compiler:

1. starts from an immutable reviewed-batch base version;
2. reads the current panda curation CSVs;
3. selects `reviewed` or `approved` panda rows whose evidence is `verified`;
4. classifies every selected profile as high, medium, or blocked risk;
5. preserves richer records already present in the base release;
6. creates new `complete_first_pass` or `identity_first_pass` profile revisions;
7. imports only reviewed exact-date events;
8. removes semantic event duplicates by panda, event type, and date;
9. creates current residency only when a matching reviewed arrival or transfer event supplies an honest start date;
10. emits designed empty-media states when a profile has no processed release media;
11. runs the existing Public Release projection before any output can be installed;
12. writes reviewed and public candidate directories atomically only after explicit `--apply`.

The compiler never activates D1, uploads R2 objects, or deploys API/Web workers.

## Entry point

```bash
npm run build:collection-release -- \
  --base-version 2026.07.23.1 \
  --release-version 2026.07.24.1 \
  --publication-batch-id collection-curation-2026-07-24 \
  --released-at 2026-07-24T04:00:00Z
```

The default is dry-run. Installation requires `--apply`. Reproduction verification uses `--check`.

The npm command uses an isolated, frozen `uv` environment and does not touch the repository `.venv`.

## Candidate release

Base version: `2026.07.23.1`

Candidate version: `2026.07.24.1`

Publication batch: `collection-curation-2026-07-24`

Report ID:

```text
collection-release-8e86feda1ad77ae07ee739a5a86e4ba39cc33d005d22d625d0e73038629932b0
```

Curation selection:

| Measure | Count |
| --- | ---: |
| Base release profiles | 16 |
| Reviewed/verified curation profiles | 28 |
| Preserved base profiles | 10 |
| New profiles | 18 |
| Deferred profiles | 0 |
| Candidate release profiles | 34 |

Risk tiers:

| Tier | Count | Meaning |
| --- | ---: | --- |
| High | 10 | Existing release profile with richer reviewed release semantics preserved byte-for-byte. |
| Medium | 18 | New identity-first profile with explicit completeness gaps. |
| Blocked | 0 | No currently eligible row lacked names or source records. |

All eighteen new profiles are `identity_first_pass`. The compiler does not claim complete publication readiness merely because a curation row contains a current-location string.

Fourteen profiles contain a current-location value but no reviewed arrival/transfer event matching that location. They are marked with the `reviewed_current_residency_start` gap and receive no fabricated residency row.

## Candidate changes

| Collection | Change |
| --- | ---: |
| Sources | 14 added |
| Pandas | 18 added; 10 preserved |
| Facts | 54 added; 0 replaced |
| Events | 15 added; 30 semantic duplicates skipped |
| Residencies | 0 added; 14 withheld for missing reviewed start date |
| Parentage assertions | 0 added or replaced |
| Media | 18 designed empty states added |

The compiler accepts parentage only when curation already contains an explicit canonical parent slug. It never resolves a parent from a display name.

## Public Release projection

Manifest record counts:

| Entity | Count |
| --- | ---: |
| Sources | 42 |
| Institutions | 5 |
| Places | 7 |
| Facilities | 8 |
| Pandas | 34 |
| Facts | 104 |
| Parentage assertions | 20 |
| Residencies | 26 |
| Events | 38 |
| Media | 34 |
| API pandas | 34 |
| API distribution revisions | 4 |
| API habitat revisions | 6 |
| API snapshots | 3 |
| API stats | 1 |

Release metadata:

```text
dataset_release_version: 2026.07.24.1
public_schema_version: 1.2.0
database_migration_version: 0007
projection_code_version: collection-release-v1
publication_batch_id: collection-curation-2026-07-24
released_at: 2026-07-24T04:00:00Z
```

## Immutable artifacts

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `data/reviewed-batches/2026.07.24.1/source.json` | 283,216 | `e300acc2a50b1bfcdaa78f7d9527c91fb34a94b4776440df17160882946a0e0e` |
| `data/reviewed-batches/2026.07.24.1/risk-report.json` | 13,460 | `d2f2b848ab2f27f848d10532da750f816be10c5f31e7dbcb89acf2fce9fea12c` |
| `data/public-releases/2026.07.24.1/manifest.json` | 1,297 | `3c20c9a9c85a6969d0704a2a7c59ac745dfda5afe4d0ff3616bfbeb1ffa09df9` |
| `data/public-releases/2026.07.24.1/api.json` | 279,895 | `44021c1eef2df303fb21c22d1bbb0b236477067eb6db019bc1728bf9b3e2c58a` |
| `data/public-releases/2026.07.24.1/d1.sql` | 387,986 | `b9470196cf58084db571c456e82bf9464cc8511f0fcdeb0c6e27dd71b6c7a772` |

The tracked candidate also contains `pandas.json` and `pandas.csv`, both covered by `manifest.json`.

## Failure isolation

A profile with missing names, no primary source IDs, or missing referenced source rows is placed in a blocked decision and excluded without blocking unrelated profiles.

The focused contract test removes Bao Xin's source IDs and verifies that:

- Bao Xin is deferred;
- the other 27 eligible rows continue;
- 17 other new profiles remain in the release candidate;
- the resulting candidate contains 33 profiles.

## Write boundary

```json
{
  "reviewed_batch": "local-only-until-explicit-apply",
  "public_release": "local-only-until-explicit-apply",
  "d1_activation": false,
  "r2_upload": false,
  "deployment": false
}
```

No D1 preflight or activation, R2 upload, API deployment, Web deployment, or production pointer update was performed in this slice.

## Verification

- Ruff focused check: passed.
- Compiler contract tests: 3 passed.
- Real curation dry-run: passed.
- Atomic local apply: passed.
- Independent `--check`: passed with the same report ID and record counts.
- Existing Public Release projection accepted the generated reviewed source and produced 34 archive/API panda revisions.

## Next slice

The next #133 slice should consume this immutable candidate through a guarded activation plan:

1. verify manifest and D1 preflight against the current pointer;
2. install the candidate in a non-production or explicit target database;
3. verify 34 API panda revisions and coherent version headers;
4. exercise pointer-only rollback to `2026.07.23.1`;
5. keep D1 activation separate from compilation so collectors still have no direct production write path.
