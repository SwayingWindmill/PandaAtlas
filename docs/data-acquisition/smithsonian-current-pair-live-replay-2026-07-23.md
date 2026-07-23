# Smithsonian current-pair live replay — 2026-07-23

Issue: #131

## Decision

The reviewed Smithsonian current-pair acquisition and enrichment path passed one bounded live replay against the three exact allowlisted National Zoo URLs.

The live run completed without a stop state, authentication flow, challenge, rate limit, cross-host redirect, parser-anchor failure, candidate contradiction, identity-resolution downgrade, fact drift, conclusion drift, or bilingual-output drift.

The result supports advancing #131 from fixture-backed production-parser integration into a curator review and publication-preparation stage before a second institutional cohort is added. It does not authorize broader Smithsonian crawling or path expansion.

## Live request boundary

Source:

- `smithsonian-national-zoo-panda-pages`

Adapter:

- `smithsonian-panda-profiles`

Cohort:

- `issue-131-current-pair-live-replay`

Exact live requests:

- `https://nationalzoo.si.edu/animals/giant-panda`
- `https://nationalzoo.si.edu/animals/giant-panda-faqs`
- `https://nationalzoo.si.edu/animals/history-giant-pandas-zoo`

The existing reviewed request policy remained unchanged:

- public HTTPS GET only;
- one request at a time;
- at most two requests per minute;
- identified Panda Atlas bot user agent;
- no cookies or authentication;
- no browser impersonation or JavaScript rendering;
- no query strings;
- same-host redirects only;
- no media acquisition;
- stop on policy, challenge, rate-limit, authorization, and reviewed HTTP failures.

## Immutable local artifact

The live acquisition bundle was written below the local review-only acquisition root:

- local path: `.acquisition/bundles/issue-131-smithsonian-live-replay-2026-07-23.json`
- run ID: `run-smithsonian-national-zoo-panda-pages-smithsonian-panda-profiles-20260723T075205Z-836ea694172a`
- bundle ID: `bundle-a3425fc9e921b86e70bb69d21620af02c5a66f52d27a3ff289c599aa910fe296`
- started: `2026-07-23T07:52:05.589380Z`
- completed: `2026-07-23T07:53:22.654806Z`
- duration: approximately 77.07 seconds
- file bytes: `187051`
- file SHA-256: `b6ff364c360a41ef38e5423b25e50af62ce412286b94fbd8f95876b519167fcb`

The artifact is local evidence and is not a trusted curation write, public projection, release artifact, or committed repository fixture.

## HTTP and evidence result

| URL | HTTP | Block state | Live bytes | Live body SHA-256 |
| --- | ---: | --- | ---: | --- |
| Giant panda profile | 200 | `clear` | 151033 | `882edb6bea3f8a7b42ec70655d5f7eba8e1466155947348d609c90423e7e7232` |
| Giant panda FAQs | 200 | `clear` | 157159 | `cc120384b283a64ce2b2e302101f75cd1dfbac062644ee7b74023e0172dcab29` |
| Smithsonian panda history | 200 | `clear` | 131816 | `de2ca141b22773b43018c949c41686ed8d293d62e2b43f2ad501f90a708ce32b` |

All three full-page hashes differ from the compact checked-in parser fixtures. This is expected: evidence hashes identify captured bytes, while semantic replay determines whether the reviewed facts changed.

## Acquisition result

The live parser emitted the same candidate counts as the fixture baseline:

| Measure | Fixture | Live |
| --- | ---: | ---: |
| Requests | 3 | 3 |
| Evidence snapshots | 3 | 3 |
| Candidates | 74 | 74 |
| Matched identities | 74 | 74 |
| Ambiguous identities | 0 | 0 |
| Unmatched identities | 0 | 0 |

Conflict-state distributions were identical:

| Conflict state | Fixture | Live |
| --- | ---: | ---: |
| `unchanged` | 39 | 39 |
| `enrichment` | 4 | 4 |
| `new` | 9 | 9 |
| `missing-current-value` | 8 | 8 |
| `not-compared` | 14 | 14 |
| `contradiction` | 0 | 0 |

## Semantic comparison layers

The replay comparator intentionally excludes content-derived IDs and evidence hashes that must change when live bytes change. It compares stable domain meaning at nine boundaries:

1. all acquisition candidates;
2. selected candidate partition;
3. deferred candidate partition;
4. out-of-scope candidate partition;
5. extracted fact semantics;
6. field conclusion semantics;
7. bilingual normalized values;
8. bilingual sentence text;
9. generated translation semantics.

Each comparison passed.

The acquisition candidate projection includes:

- source-local subject key;
- matched canonical slug;
- candidate kind;
- field path;
- raw value;
- normalized value;
- conflict state;
- current trusted comparison value;
- parser name and version.

It excludes evidence snapshot IDs, body hashes, and candidate IDs because those are content-addressed evidence identities rather than semantic values.

## Current-pair enrichment result

Both fixture and live bundles produced the same downstream result:

| Measure | Result |
| --- | ---: |
| Selected pandas | 2 |
| #130 merge decisions | 2 |
| Selected acquisition candidates | 22 |
| Deferred in-scope candidates | 6 |
| Out-of-scope candidates | 46 |
| Fact assertions | 16 |
| Bilingual summary sentence pairs | 4 |
| Generated translations | 24 |

Fact field counts remained identical:

- `birth.date`: 4;
- `birth.place`: 2;
- `events.arrival`: 2;
- `events.public_debut`: 2;
- `identity.sex`: 4;
- `residence.current`: 2.

Both Bao Li and Qing Bao remained high-confidence #130 merges into the reviewed canonical records. Parent-name relationship candidates remained deferred and were not converted into canonical relationship targets.

## Acceptance commands

The live acquisition was executed from `services/api` with:

```bash
uv run python scripts/run_source_adapter.py \
  --source-id smithsonian-national-zoo-panda-pages \
  --adapter-id smithsonian-panda-profiles \
  --mode live \
  --cohort issue-131-current-pair-live-replay \
  --output-bundle issue-131-smithsonian-live-replay-2026-07-23.json
```

The existing artifact was then compared with a newly generated fixture cohort without further network access:

```bash
uv run python scripts/check_smithsonian_current_pair_enrichment.py \
  --live-bundle issue-131-smithsonian-live-replay-2026-07-23.json
```

The comparison command reported:

```text
acquisition_semantics_equal: true
partition_semantics_equal: true
fact_semantics_equal: true
conclusion_semantics_equal: true
bilingual_semantics_equal: true
```

## Safety and write boundary

The live replay produced no targets for:

- trusted curation writes;
- public projection writes;
- relationship graph writes;
- media writes;
- database writes;
- immutable release publication.

The source registry, exact URL allowlist, request policy, parser anchors, identity threshold, fact confidence rules, and bilingual semantic revalidation were not relaxed to obtain a passing result.

## Next publication and acquisition steps

The immediate next step is the curator review plan documented in `docs/data-acquisition/smithsonian-current-pair-curation-review-2026-07-23.md`. A real curator must decide the 16 proposed fact assertions and explicitly defer the six source omissions or name-only parent statements before a curation patch can be exported.

After the Smithsonian publication path is closed, the next source-expansion slice should choose one additional exact-URL institutional source with meaningful overlap against records marked `needs_primary_source`.

Selection should prefer pages with:

- explicit individual names or stable identifiers;
- day-precision dates or structured profile fields;
- explicit parent identities rather than name-only prose;
- clear facts-only public access;
- small exact path allowlists;
- sufficient unresolved-inventory overlap to justify parser work.

A second institution must repeat the same fixture-first, bounded-live, #130, fact-conflict, bilingual, and zero-write boundaries.
