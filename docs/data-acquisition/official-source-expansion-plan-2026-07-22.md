# Official-source expansion plan — 2026-07-22

Issue: [Plan official-source expansion across the remaining 74 targets](https://github.com/SwayingWindmill/PandaAtlas/issues/104)

## Decision

Expand the reviewed-source pipeline through a new, bounded map rather than implementing the 74 backlog rows directly.

The first Smithsonian cohort proved that the registry, adapter, reconciliation, decision, and patch seams work. It also showed that source prominence is a poor proxy for inventory impact: 74 candidates covered 13 already comparatively well-sourced pandas, including 8 `partial` records but no `needs_primary_source` record.

The next map should therefore:

1. resolve the highest-impact official source surfaces before writing adapters;
2. rank adapter families using deduplicated panda coverage rather than backlog-row totals;
3. use secondary indexes only to identify official holder cohorts;
4. improve curator handling for structured events and unresolved parent names before high-volume execution;
5. keep every live source behind a new registry review.

The complete 74-row reassessment is in [`source-expansion-targets-2026-07-22.csv`](source-expansion-targets-2026-07-22.csv).

## Inputs and calibration

The plan was derived from:

- `data/curation/pandas/source-expansion-backlog.csv`: 74 target rows;
- `.acquisition/work-queue/panda-acquisition-work-queue.v1.json`;
- queue ID `queue-a15dc09380265c6fd09aa3cbc967583b471f330c6dbb6215ebebd62d16f54a2b`;
- the measured Smithsonian cohort in `smithsonian-first-cohort-2026-07-22.md`;
- the source registry and source-review decisions current on 2026-07-22.

The queue still represents:

- 809 pandas;
- 543 `needs_primary_source` records;
- 161 `partial` records;
- 558 missing Chinese names;
- 671 missing both parents;
- 625 with no structured events;
- 703 with a current location that still needs primary evidence.

The Smithsonian calibration was:

| Measure | Result |
| --- | ---: |
| Reviewed pages | 3 |
| Candidates | 74 |
| Matched pandas | 13 |
| Non-unchanged candidates | 35 |
| Curator summary groups | 39 |
| Substantive non-unchanged groups | 23 |
| Contradictions | 0 |
| `needs_primary_source` records reached | 0 |

These measurements are used as planning constraints, not as a promise that every future page will produce 24.67 candidates. In particular, candidate count is discounted when a target has mixed documents, historic aliases, duplicate names, or no deterministic profile surface.

## Backlog state

All 74 rows were retained in the assessment, but they are not all active expansion work:

| Backlog state | Targets | Disposition |
| --- | ---: | --- |
| `partial` | 60 | Reassess for future work, hold, or retirement. |
| `done` | 7 | Maintenance only. |
| `complete` | 7 | Maintenance only. |
| **Total** | **74** | — |

The 14 `done/complete` rows must not be rerun as fresh expansion cohorts. They may supply regression fixtures or future maintenance reviews.

## Access classes

The access class describes the likely technical source shape. It does **not** approve automated access. Except for the already reviewed Smithsonian paths, every future live source still requires exact terms, robots, host, path, redirect, authentication, rate, content-stability, and allowed-use review in the registry.

| Access class | Targets | Decision |
| --- | ---: | --- |
| Deterministic official HTML | 27 | Candidate for shared profile or timeline adapters after source review. |
| Official documents or feeds | 17 | Require an exact document manifest and document-rights review. |
| Manual-only | 29 | Secondary discovery, Tokyo policy, or missing deterministic profile surface. |
| Permission-required | 1 | International studbook; no automated or document intake without licensed access. |
| Official API | 0 | No stable official panda-record API was confirmed. |
| Genuinely JavaScript-required | 0 | No target was promoted merely because a browser could render it; no genuine JS-only fact surface was confirmed. |
| Prohibited | 0 | No new source was labelled prohibited without an explicit policy basis. |

`manual-only` does not mean that facts are unusable. It means evidence must be captured through bounded human review or replaced by a better official source rather than automated crawling.

## Current external surface observations

These observations only shape the next research order; they are not source approvals.

- The Chengdu Panda Base currently exposes public official Chinese and English HTML pages and official news pages. This makes it the strongest immediate candidate for a bounded deterministic-HTML source review, although exact profile paths and access policy still need review.
- Beijing Zoo currently exposes a public official HTML site with institutional, visitor, news, and education surfaces. This review pass did not confirm a deterministic individual-panda profile surface; key panda details remain associated with news or social-account context.
- The China Conservation and Research Center for the Giant Panda has an official National Forestry and Grassland Administration surface describing its bases and responsibility for captive-panda pedigree management. A public row-level, studbook-like individual profile surface was not located.
- The WAZA current international-studbook list does not expose a giant-panda row, while discoverable giant-panda studbook material is historical, catalog-only, or embedded in regulatory documents. A current row-level edition therefore remains permission-required rather than a scraping target.

Observed official surfaces:

- `https://www.panda.org.cn/en/`
- `https://www.bjzoo.com/`
- `https://www.forestry.gov.cn/c/dxm/jgsz/311545.jhtml`
- `https://www.waza.org/priorities/conservation/waza-international-studbooks/`

## Deduplicated adapter-family impact

Backlog rows overlap heavily. The three Ya'an GPG rows each link to roughly the same 73 `needs_primary_source` pandas and cannot be counted as three independent yields. Family metrics below deduplicate by canonical panda slug and keep the highest-priority queue record for each panda.

| Adapter or research family | Unique pandas | Needs primary | Partial | Key gaps | Access-adjusted decision |
| --- | ---: | ---: | ---: | --- | --- |
| CCRCGP official profile and base replacement | 111 | 86 | 16 | 75 Chinese names, 85 parentage, 102 current-location evidence, 87 event gaps | Highest impact, but first resolve public profile/studbook surface and permission. |
| Chengdu Base official profile and history | 64 | 21 | 31 | 24 Chinese names, 49 parentage, 52 current-location evidence, 45 event gaps | Highest immediately reviewable HTML family. |
| Beijing Zoo official and archive | 43 | 20 | 11 | 19 Chinese names, 32 parentage, 31 current-location evidence, 24 event gaps | High impact, but profile surface discovery precedes adapter work. |
| Historic institutional documents | 22 | 8 | 12 | 18 Chinese names, 21 parentage, 20 location evidence, 18 exact dates | Use exact document manifests; no broad archive crawler. |
| DPRK official-document research | 5 | 5 | 0 | 5 parentage, 5 dates, 5 genders, 4 event gaps | Manual government/archive research; low identity detail. |
| San Diego official archive | 18 | 4 | 14 | 11 parentage, 18 location evidence, 8 event gaps | Bounded official archive manifest after W1. |
| Mexico government archive | 11 | 4 | 5 | 3 parentage, 9 location evidence, 7 event gaps | Bounded government/zoo archive family after W1. |
| Chengdu Zoo official history | 8 | 4 | 4 | 8 Chinese names, 8 parentage, 8 location evidence, 5 event gaps | Separate from Chengdu Base; document-led historic cohort. |
| Overseas profile follow-ups | 96 | 2 | 49 | 51 parentage, 51 location evidence, 33 event gaps | Broad coverage but weak reduction of `needs_primary_source`; defer. |

## Ranking model

Each target row records:

- linked panda count;
- `needs_primary_source` and `partial` counts;
- Chinese-name, parentage, current-location-primary-evidence, and structured-event gaps;
- access cost;
- parser complexity;
- expected field yield;
- identity coverage;
- conflict risk and a conflict-rate assumption calibrated against the Smithsonian 0% observed contradiction rate;
- curator burden;
- access blocker and recommended disposition.

The ordering rule is:

1. deduplicate overlapping targets into one official adapter family;
2. maximize unique `needs_primary_source` reduction;
3. then maximize `partial` coverage and weighted Chinese-name, parentage, location, and event gaps;
4. discount missing official surfaces, permission barriers, historic alias risk, mixed-document parsing, and curator burden;
5. never compensate for a bad access boundary with broader crawling, browser impersonation, or secondary-source promotion.

This produces two rankings:

### Impact ranking

1. CCRCGP official replacement family.
2. Chengdu Base official family.
3. Beijing Zoo official and archive family.
4. Historic institutional documents.
5. DPRK official-document research.
6. San Diego and Mexico official archives.
7. Lower-impact overseas profile follow-ups.

### Execution ranking

1. Chengdu Base source review: public official HTML exists and has the best combination of impact and likely reusable parser shape.
2. CCRCGP surface and permission review: highest impact, but adapter work is premature without a public profile/export surface.
3. Beijing Zoo surface decision: determine whether exact official profile/archive pages exist; otherwise remain manual/document-only.
4. International studbook permission request: pursue a licensed export rather than scraping historical copies.
5. Official archive manifest family: San Diego, Mexico, early U.S./U.K., short-term loans, historic deaths, and DPRK documents.
6. Overseas profile follow-ups after the event and parent-review workflow is improved.

## Reusable adapter families

### Official profile HTML

Use for stable individual or family profile pages with explicit names, sex, birth dates, parent names, and current locations.

Shared behavior:

- exact page manifest, not site discovery;
- semantic heading and field-label anchors;
- explicit absent values;
- source-local subject keys;
- no parent slug inference;
- per-page evidence snapshots.

Likely targets include Chengdu Base and many overseas zoo profile follow-ups after source review.

### Official news and timeline HTML

Use for dated births, names, arrivals, transfers, deaths, and habitat announcements.

Shared behavior:

- article title/date validation;
- nearest-heading year reconstruction only when explicit;
- event candidates rather than direct panda-state overwrites;
- duplicate-event comparison before curator export.

This family should extend the Smithsonian history parser pattern without reusing Smithsonian-specific selectors.

### Official document manifest

Use for PDFs, annual reports, archive records, government notices, and fixed official downloads.

Shared behavior:

- exact document URL, document hash, page locator, and edition/date;
- no archive enumeration or recursive link following;
- document-specific rights review;
- manual fixture extraction before any generalized PDF parser.

This is the correct family for historic institutional records and government diplomacy material.

### Government news and institutional notices

Use where the holder has no profile page but a government or institutional notice explicitly states a bounded fact.

This family must preserve the distinction between the reporting government source and the actual panda holder. It should emit event or identity evidence, not infer current residency.

### Secondary-discovery splitter

This is a planner, not an evidence adapter.

The 25 GPG backlog rows must never become a broad `giantpandaglobal.com` official-evidence crawler. Six rows still have deterministic queue links and should be split into official holder cohorts. Sixteen rows have no linked queue records and should be retired from active execution while retained as backlog history. The three overlapping Ya'an rows are folded into the single CCRCGP replacement family.

### Manual evidence recorder

Use for approved manual-only pages or documents where automated collection is not allowed or no deterministic endpoint exists. The output should still use acquisition evidence, candidates, decisions, and patch contracts, but a human supplies the exact evidence capture.

## Source-specific exceptions

### CCRCGP

The official institution is the highest-impact family, but the existing public surface does not yet expose the row-level profile or studbook shape needed to replace 86 `needs_primary_source` records. The next work is source-surface discovery and permission, not HTML parser implementation.

### Chengdu Base

This is the best immediate source-review candidate. One adapter family should cover exact profile, news, and history pages. It must not crawl site search, maps, mini-program endpoints, or unrelated education pages.

### Beijing Zoo

The official website is public HTML, but no stable individual-panda profile surface was confirmed. Social or WeChat facts must not be converted into a browser-automation project. The decision is either exact official pages/documents or manual-only evidence.

### Tokyo Zoo

The existing review keeps Tokyo Zoo Net at `manual-review-required` with zero automated capacity. Ueno rows remain manual unless a new policy review explicitly changes that decision.

### International studbook

Catalog records and historical excerpts do not authorize row-level intake. Seek a licensed current export or written permission. Do not scrape previews, regulatory attachments, or leaked copies to reconstruct a current studbook.

### Historic mixed batches

Rows that combine multiple institutions, secondary indexes, museum archives, and official notices are research manifests, not source adapters. They must be split into exact documents and source-local subjects before parsing.

### Dynamic page hashes

The Smithsonian run showed that full official HTML hashes may change while semantic facts remain stable. Future HTML adapters should pin evidence hashes per run, validate semantic anchors, and fail on structural drift rather than expecting permanent page hashes.

## Blocker summary

| Blocker | Targets or families | Required resolution |
| --- | --- | --- |
| Terms and robots not reviewed | Every new automated source | Add exact source-registry review before live capacity. |
| Missing official individual-profile surface | CCRCGP, Beijing Zoo, Qinling, several historic/current holders | Locate exact official pages/export or remain manual/document-only. |
| Permission or licence | International studbook | Obtain written permission or licensed export. |
| Secondary source only | 25 GPG rows | Split into official holder cohorts; never promote GPG as official evidence. |
| Manual-only policy | Tokyo Zoo/Ueno family | Keep zero automated capacity unless policy is re-reviewed. |
| Heterogeneous archive/document set | Historic deaths, loans, early U.S./U.K., DPRK, mixed batches | Build exact document manifests with page-level provenance. |
| Identity and alias risk | Historic, duplicate, same-name, lineage batches | Require explicit IDs or unique cohort names; preserve ambiguity. |
| Curator event burden | All high-yield profile/timeline families | Add duplicate-event grouping and batch decisions before scale. |
| Parent name resolution | Profile families | Add reviewed name-to-parent resolution workflow; never infer slugs in adapters. |
| Authentication | None confirmed | Any discovered auth requirement stops automated review. |
| Genuine JavaScript-only surface | None confirmed | Do not add a browser unless an exact fact surface is proven JS-only and policy permits it. |
| Explicit prohibition | None newly confirmed | Do not label a source prohibited without an explicit policy basis. |

## Next map frontier

The next map should contain small, blocking slices rather than one adapter per backlog row.

### Frontier 1 — CCRCGP access decision

Question: Is there a public, licensed, or permission-granted row-level profile/export surface for the CCRCGP and Ya'an replacement cohort?

Delivery:

- exact official URLs, export or contact path;
- terms, robots, authentication, rate, document rights, and expiry;
- field inventory and identity keys;
- go/no-go decision for automated HTML, document import, licensed export, or manual-only evidence.

This frontier covers five backlog rows and up to 111 unique pandas, including 86 `needs_primary_source` records.

### Frontier 2 — Chengdu reviewed source and adapter

Question: Can one deterministic official HTML family cover Chengdu profiles, news, and history without broad crawling?

Delivery:

- exact path manifest and source review;
- minimal fixtures;
- one shared adapter family;
- first bounded cohort and yield measurement.

This frontier covers 64 unique pandas, including 21 `needs_primary_source` and 31 `partial` records.

### Frontier 3 — Beijing source-surface decision

Question: Does Beijing Zoo expose a deterministic official profile/archive surface, or must the cohort remain manual/document-only?

Delivery:

- exact official surface search;
- no browser automation for social accounts;
- source review or explicit manual-only decision;
- historic archive split from current profiles.

This frontier covers 43 unique pandas, including 20 `needs_primary_source` records.

### Frontier 4 — Curator event and parent review throughput

Question: Can 17-plus event candidates and repeated name-only parent candidates be reviewed without one-decision-at-a-time overload?

Delivery:

- duplicate-event grouping by panda, event kind, date precision, and location;
- batch accept/reject/defer with append-only decisions;
- explicit reviewed parent-name resolution separate from adapters;
- unchanged provenance and zero trusted writes.

This frontier should block high-volume cohort runs.

### Frontier 5 — Official archive document family

Question: Can exact official PDFs, museum records, annual reports, and government notices share one manifest and page-provenance contract?

Delivery:

- bounded San Diego, Mexico, historic U.S./U.K., loan, death, and DPRK manifests;
- document-rights decisions;
- one document adapter family with source-specific parsers;
- no archive crawling.

### Frontier 6 — Secondary backlog retirement and split

Question: Which GPG planning rows still name useful official cohorts, and which are empty historical rows?

Delivery:

- retire 16 zero-link rows from active execution;
- split 6 linked discovery rows into official holder targets;
- fold 3 Ya'an rows into CCRCGP;
- preserve all original backlog history and deterministic queue lineage.

### Map close

The new map-closing ticket should run full integration and verification only after the source reviews, adapter slices, curator-throughput work, and backlog split are complete.

## What this ticket does not do

This plan does not:

- approve any new live source;
- implement an adapter;
- crawl any of the 74 targets;
- change the 809 curation records;
- change backlog status values;
- apply curator decisions or curation patches;
- create trusted, database, Public Release, D1, R2, frontend, or publication writes;
- run broad tests or release verification.

Verification: deferred to the map-closing ticket. This research ticket produces a source expansion decision record only.
