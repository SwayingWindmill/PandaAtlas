# Smithsonian first institutional cohort — 2026-07-22

Issue: [Run the first institutional cohort and measure candidate yield](https://github.com/SwayingWindmill/PandaAtlas/issues/103)

## Decision

**Expand the approved institutional adapter pattern, but revise target selection and curator workflow before scaling.**

The adapter and runner behaved correctly: all three reviewed pages were captured without a block, all 74 fixture candidates reproduced from live HTML, all identities matched conservatively, and no contradiction appeared. The limiting factor is coverage efficiency. This cohort reached 8 records currently marked `partial`, but none of the 543 records marked `needs_primary_source`.

The next cohort should therefore prioritize institutions and pages tied to `needs_primary_source` records rather than another already well-sourced flagship-panda cohort. Curator batching for event proposals and explicit parent-name resolution should also be improved before high-volume expansion.

## Run boundary

The run used source `smithsonian-national-zoo-panda-pages` with adapter `smithsonian-panda-profiles` and cohort label `smithsonian-first-institutional-cohort`.

The registry allowed exactly three public HTTPS GET requests:

- `https://nationalzoo.si.edu/animals/giant-panda`
- `https://nationalzoo.si.edu/animals/giant-panda-faqs`
- `https://nationalzoo.si.edu/animals/history-giant-pandas-zoo`

The runner enforced:

- one request at a time;
- at most two requests per minute;
- `PandaAtlasBot/0.1` identification;
- `Accept: text/html`;
- no cookies, authentication, browser impersonation, JavaScript, proxy rotation, query strings, or media acquisition;
- same-host redirects only, with at most one redirect;
- stop states for policy, authentication, challenge, rate-limit, legal, and reviewed HTTP failures.

The source review was current from `2026-07-22` through `2026-10-22`.

## Local immutable artifacts

The commands did not use `--overwrite`. Content-addressed IDs and file SHA-256 values below pin the local outputs.

| Artifact | Local path | Stable ID | Bytes | File SHA-256 |
| --- | --- | --- | ---: | --- |
| Fixture baseline bundle | `.acquisition/bundles/issue-103-smithsonian-fixture.json` | `bundle-732f87fcfde54b2e1f4af97b3f57533e9dcc48a5bbe33709f79441e36e7c0876` | 175,457 | `ff0676cd7cf4ba283c2690ec6cc3988f8c129913394ee723755c4e0fcf6afe40` |
| Live cohort bundle | `.acquisition/bundles/issue-103-smithsonian-live.json` | `bundle-954b3b37d0246de887b67a16321df81b559609df8f741ea2bc9a50e2b71f3a18` | 187,652 | `3f8c8bf9d9009fa9ccfa189db67d288ea7f1dcfa7dc9d521bb87d132ab666273` |
| Curator decision log | `.acquisition/decisions/issue-103-smithsonian.decisions.json` | `decision-log-f72072ba4148ac2c867c4edf1382455f809390b664ec6297262062e94f957ce5` | 1,067 | `55b04f21f2eb0054279fb5ff10b6bea3501299a8bf213d61739abd3cb19ff401` |
| Curation patch proposal | `.acquisition/curation-patches/issue-103-smithsonian.patch.json` | `curation-patch-70e43aada31fb54b6926cf7f1826ae9d781c312afe343d107153cea52bfe9f6b` | 5,271 | `432abd86805ee27eded839663d5f8016b959a69dc2adc144bdfaeac412dc1776` |

The live run started at `2026-07-22T11:18:04.775481Z` and completed at `2026-07-22T11:19:19.265638Z`, a runner duration of approximately 74.49 seconds.

## Request and evidence result

| Page | Requested | Captured | Final URL changed | HTTP | Block state | Bytes | Evidence body SHA-256 |
| --- | ---: | ---: | ---: | ---: | --- | ---: | --- |
| Giant panda profile | 1 | 1 | No | 200 | `clear` | 151,165 | `a1338f20e450ae5ceee3dea32fa806f759662fff2871fb6125b1ca64048e4ed4` |
| Giant panda FAQs | 1 | 1 | No | 200 | `clear` | 157,153 | `e446415df71f92b07f80e0008d204d71b2a5ae41c3ccabe4803aefae847a7fda` |
| Smithsonian panda history | 1 | 1 | No | 200 | `clear` | 131,786 | `81f89821024088e19f72e03edbde40dd4fbd2e55dbdfa62ad5b537a9f5b444ee` |
| **Total** | **3** | **3** | **0** | **3 × 200** | **3 × clear** | **440,104** | — |

No stop state, cross-host redirect, authentication flow, human challenge, or parser-drift terminal state occurred.

## Fixture-to-live stability

The fixture and live bundles each produced 74 candidates. Their semantic projections were equal when compared by:

- matched canonical slug;
- candidate kind;
- field path;
- raw value;
- normalized value;
- conflict state.

The live body byte counts were identical to the source-review observations, but all three body SHA-256 values changed. This is expected for dynamically generated Drupal HTML and confirms the source-review rule that body hashes are evidence identities, not permanent expected-page hashes.

| Page | Source-review body SHA-256 | Live body SHA-256 | Semantic drift |
| --- | --- | --- | --- |
| Giant panda profile | `1ca7a6faf4439ff9540ae9370bccca6e8682ea1c37719db9c541b4e8df9ddaf9` | `a1338f20e450ae5ceee3dea32fa806f759662fff2871fb6125b1ca64048e4ed4` | None detected |
| Giant panda FAQs | `f2dd362d69cbad2c36ab3dd64a406625dcc14be83b6141efaff3a3c897eca816` | `e446415df71f92b07f80e0008d204d71b2a5ae41c3ccabe4803aefae847a7fda` | None detected |
| Smithsonian panda history | `d6b5141b91c40c3c02e865a2319a4b86af57464762a87098bc2868519b0d82d8` | `81f89821024088e19f72e03edbde40dd4fbd2e55dbdfa62ad5b537a9f5b444ee` | None detected |

## Identity coverage

The cohort matched 13 existing curation records:

- `an-an`
- `bao-bao`
- `bao-li`
- `bei-bei`
- `hsing-hsing`
- `jia-mei`
- `ling-ling-smithsonian`
- `mei-xiang`
- `qing-bao`
- `qing-qing`
- `tai-shan`
- `tian-tian`
- `xiao-qi-ji`

Identity result:

| State | Candidates | Unique pandas |
| --- | ---: | ---: |
| `matched` | 74 | 13 |
| `ambiguous` | 0 | 0 |
| `unmatched` | 0 | 0 |
| `not-attempted` | 0 | 0 |

The yield was 24.67 candidates per captured page and 5.69 candidates per matched panda.

## Candidate yield

### By fact kind

| Candidate kind | Count | Share |
| --- | ---: | ---: |
| Identity | 39 | 52.7% |
| Event | 21 | 28.4% |
| Relationship | 9 | 12.2% |
| Residency | 5 | 6.8% |
| **Total** | **74** | **100%** |

### By comparison state

| Comparison state | Count | Share | Interpretation |
| --- | ---: | ---: | --- |
| `unchanged` | 39 | 52.7% | Official source agrees with current curation. |
| `enrichment` | 4 | 5.4% | Source adds compatible birthplace or facility detail. |
| `new` | 9 | 12.2% | Source-backed event is not represented in current curation. |
| `missing-current-value` | 8 | 10.8% | Matched panda has no current comparable event value. |
| `not-compared` | 14 | 18.9% | Parent name is unresolved or source explicitly omits the requested current value. |
| `contradiction` | 0 | 0% | No conflicting value was detected. |

There were 35 non-unchanged candidates, or 47.3% of the bundle.

### Field-level gaps

| Candidate group | Count | State |
| --- | ---: | --- |
| Event proposals absent from current curation | 9 | `new` |
| Event proposals for pandas with no current event value | 8 | `missing-current-value` |
| Father names without canonical parent identity | 4 | `not-compared` |
| Mother names without canonical parent identity | 5 | `not-compared` |
| Current-pair life status omitted by source | 2 | `not-compared` |
| Post-departure current holder/location omitted by source | 3 | `not-compared` |
| Birthplace detail compatible with current value | 2 | `enrichment` |
| Current facility detail compatible with current institution | 2 | `enrichment` |

## Primary-evidence coverage of the 809-record inventory

The existing inventory contains:

| Existing evidence status | Repository records | Cohort records covered | Cohort candidates |
| --- | ---: | ---: | ---: |
| `verified` | 105 | 5 | 45 |
| `partial` | 161 | 8 | 29 |
| `needs_primary_source` | 543 | 0 | 0 |
| **Total** | **809** | **13** | **74** |

The eight `partial` records receiving at least one official-source candidate were:

- `an-an`
- `bao-bao`
- `hsing-hsing`
- `jia-mei`
- `ling-ling-smithsonian`
- `qing-qing`
- `tai-shan`
- `tian-tian`

This is evidence coverage only. The run did not change `evidence_status`, `review_status`, `primary_source_ids`, or any trusted curation value.

## Curator decision and patch example

The example accepted candidate was Bao Li's current Smithsonian facility:

- candidate: `candidate-8275e1d67acc8e06200e12f6157f4c5ff53cf162d2a4154f4125992814bc8aa9`
- conflict state: `enrichment`
- decision: `decision-3c987b239b096efca843643f0cb7402b3587688d9a9073a11395c68ef116750d`
- proposal: `proposal-6170e8cb4707af0a661fe5c6f385ef569ad4381e863c17211d140936442af89c`
- evidence: Smithsonian FAQ snapshot `evidence-2abace612c54cb9109a7459aa9e9c0d4c36824c3695d71307b9e10eac3cfd32a`

The proposed normalized value is:

```json
{
  "facility": "David M. Rubenstein and Family Giant Panda Habitat",
  "institution": "Smithsonian National Zoo"
}
```

The prior trusted value remains preserved as `Smithsonian National Zoo, Washington, D.C.`. The patch contains one residency proposal and one deduplicated evidence source. It does not apply the proposal.

All local artifacts expose empty boundaries for canonical curation, trusted, and publication writes.

## Manual-review burden

The 74 candidates collapse into 39 curator summary groups by panda, source, fact kind, and conflict state.

- 16 groups contain only `unchanged` candidates and can be reviewed in batches.
- 23 groups contain 35 non-unchanged candidates requiring substantive review.
- 17 event candidates are the largest immediately useful intake set.
- 9 parent-name candidates require identity resolution before relationship intake.
- 5 explicit source omissions should remain deferred or rejected rather than converted into negative facts.
- 4 enrichments are low-complexity review candidates; one was used for the example patch.

A single accepted decision and patch export took no trusted write and required no manual transformation of provenance. The remaining burden is deciding domain meaning, especially event duplication and parent identity—not reconstructing source evidence.

## Gaps and constraints

### Parser gaps

No reviewed parser anchor failed in either fixture or live mode. The current parser scope is sufficient for the three approved pages.

The unresolved gaps are downstream or source-level:

- parent names are not canonical parent IDs;
- relative departure language does not state current holders or destinations;
- current-pair profile text omits life status;
- the approved pages do not target the inventory's large `needs_primary_source` population;
- media, prose reuse, site search, news crawling, and unreviewed paths remain prohibited.

### Source instability

The source produced stable facts but unstable full-page bytes. All three body hashes changed from the review observations while body sizes and semantic output remained stable. Future runs must continue creating new evidence snapshots and comparing semantic candidates rather than expecting historical body hashes.

### Policy constraints

The pattern remains viable only for exact reviewed pages that are public HTML, require no browser or account, and permit facts-only reference use. A source requiring JavaScript, authentication, challenge solving, broader crawling, or unclear automated use must remain manual-review-required or stop.

## Recommendation for the next cohort

Proceed with the same deep adapter/runner boundary, with these revisions:

1. **Prioritize `needs_primary_source`.** Select the next institution by overlap with the 543 records lacking primary evidence, not by prominence or page richness alone.
2. **Prefer explicit identity fields.** Favor pages that publish stable panda IDs, parent identities, or profile tables; name-only parent statements create avoidable review debt.
3. **Batch event review.** Event candidates produced 17 new or missing-current-value facts. The curator workflow should support duplicate-event comparison and batch decisions before running a much larger cohort.
4. **Keep fixture-first drift control.** Full HTML hashes are unstable, but reviewed semantic anchors were stable. Preserve minimal fixtures and fail closed on structural drift.
5. **Retain exact access limits.** Do not broaden paths, automate site discovery, reuse media, or adopt browser impersonation to increase yield.
6. **Stop on low coverage efficiency.** A candidate source should not advance to adapter work unless it has meaningful overlap with unresolved inventory records and a clear facts-only access boundary.

The Smithsonian pattern should therefore **expand with revisions**, not stop. The technical execution is reliable; cohort selection and curator throughput are the constraints that should shape #104.

## Verification boundary

The following focused checks were performed:

- one deterministic fixture run;
- one explicit bounded live run;
- fixture/live semantic-projection equality;
- evidence status, body size, URL, hash, and block-state inspection;
- identity, fact-kind, conflict-state, field-gap, and review-group measurements;
- inventory evidence-status coverage measurement;
- one accepted curator decision;
- one residency curation-patch proposal;
- local artifact SHA-256 calculation;
- `git diff --exit-code` confirmation for `pandas.csv`, `sources.csv`, `events.csv`, and `media.csv`.

Verification: deferred to the map-closing ticket. This ticket records cohort output and operational measurements, not final acceptance evidence. No pytest suite, Release Gate, cross-platform CI, browser, accessibility, staging, publication, immutable-release-hash, or rollback verification was run.
