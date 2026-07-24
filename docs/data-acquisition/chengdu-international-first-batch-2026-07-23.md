# Chengdu breadth-first acquisition and collection application — 2026-07-24

Issue: [#136 — Run the first breadth-first backfill for 809 records and new discoveries](https://github.com/SwayingWindmill/PandaAtlas/issues/136)

## Final outcome

The first Chengdu breadth-first wave completed four bounded bilingual acquisition adapters against eight exact official pages, produced 279 review candidates, created four new reviewed panda identities, updated fourteen existing Chinese display names, and inserted twenty-six reviewed structured events in two atomic curation application phases.

The curation inventory moved from:

- 352 sources to 360 sources;
- 809 panda rows to 813 panda rows;
- 260 events to 286 events;
- 8 media rows to 10 media rows. The media increase predated this Chengdu application and no Chengdu media was acquired in this wave.

No trusted archive, D1, Public Release, R2, website, or deployment write occurred.

## Reviewed source boundary

Source ID: `chengdu-panda-base-international-cooperation`

Adapters:

- `chengdu-international-cooperation`;
- `chengdu-newborns-2021`;
- `chengdu-denmark-handover-2019`;
- `chengdu-newborns-2017`.

Exact official pages:

- `https://www.panda.org.cn/cn/cooperate/international/`
- `https://www.panda.org.cn/en/cooperate/international/`
- `https://www.panda.org.cn/cn/culture/activities/2023-07-07/6594.html`
- `https://www.panda.org.cn/en/culture/activities/2023-09-19/8165.html`
- `https://www.panda.org.cn/cn/culture/activities/2023-07-07/6593.html`
- `https://www.panda.org.cn/en/culture/activities/2023-08-24/8081.html`
- `https://www.panda.org.cn/cn/culture/activities/2023-08-23/8079.html`
- `https://www.panda.org.cn/en/culture/activities/2023-08-24/8080.html`

The machine-readable access policy is in `data/acquisition-sources/registry.json`. The review decision and stop conditions are in `docs/data-acquisition/source-review-2026-07-22.md`.

Each adapter:

- makes exactly two sequential GET requests;
- waits at least 90 seconds between requests;
- uses the reviewed `PandaAtlasBot` user agent;
- sends no authentication or cookies;
- permits no query strings, site search, pagination, archive crawling, or browser impersonation;
- validates HTTP status, content length, body size, content type, challenge signals, semantic anchors, and bilingual fact parity;
- writes only local acquisition bundles before an explicit curator/application step.

## Acquisition results

| Batch | Candidates | Identity | Relationship | Event | Initial matched | Initial unmatched |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| International cooperation | 76 | 30 | 0 | 46 | 76 | 0 |
| 2021 newborn profiles | 60 | 40 | 10 | 10 | 50 | 10 |
| 2019 Denmark handover | 30 | 18 | 8 | 4 | 30 | 0 |
| 2017 newborn profiles | 113 | 69 | 22 | 22 | 83 | 30 |
| **Total** | **279** | **157** | **40** | **82** | **239** | **40** |

For all four adapters, fixture and live candidate semantics matched after excluding run-specific evidence IDs, response-body hashes, and DOM locators.

The initial four-batch review plan was:

- Plan ID: `batch-review-plan-97769de8048db7a558842938b8ae36a8e0321e80c4bc47c9758e6466896c956e`
- Bytes: 204,045
- SHA-256: `892a82d32a6714409592e3ff57481fa82d6070a419dc51a9825a332f8831a311`

It routed candidates into:

| Lane | Groups | Candidates |
| --- | ---: | ---: |
| `batch-ready` | 58 | 95 |
| `manual-contradiction` | 10 | 17 |
| `manual-create-identity` | 16 | 24 |
| `blocked-on-create` | 12 | 16 |
| `manual-relationship-resolution` | 32 | 32 |
| `supporting-unchanged` | 64 | 95 |
| **Total** | **192** | **279** |

Name-only mother and father references were explicitly removed from unattended application. A relationship candidate can enter automatic application only when it contains an already reviewed canonical parent slug.

## Collection decision policy

Policy ID: `pandaatlas-collection-batch-policy/v1`

The policy accepts only candidates representable by the current curation CSV contract:

- new identity official Chinese and English names;
- new identity exact birth date;
- new identity sex;
- missing official Chinese name for an explicitly matched panda;
- structured events with a complete ISO date for an explicitly matched panda.

The policy defers:

- contradictions;
- source-text-only parent relationships;
- aliases and pedigree identifiers that lack a current curation column;
- year- or month-precision events because `events.csv` requires a complete ISO date;
- duplicate supporting evidence that would not change curation;
- events and relationships whose panda identity has not yet been created.

Every candidate receives an append-only accepted or deferred decision. No candidate is silently omitted.

## Phase 1 curation application

The first application used four live acquisition bundles and four version-2 decision logs.

Accepted proposals:

- 24 new-identity field proposals;
- 14 existing-panda Chinese-name proposals;
- 44 exact-date event candidates, deduplicated to 22 event rows.

Applied changes:

- four new reviewed panda rows;
- fourteen existing panda-row updates;
- twenty-two event insertions;
- eight official source rows;
- four source-key identity links.

Application patch IDs:

- `curation-patch-efb3241482cb1da3598d612f88e54ae2679fba77250798e7ea8123b4e7bd0c05`
- `curation-patch-8187e35ed6d4f692fcc30a14c335d2c5190c59cb9899b1d05608a30cbf6704e8`
- `curation-patch-5833d7c5d689e7b3e00303ad79ffa625c7f7f1fdd0d14df0b52329633751a297`
- `curation-patch-0e7788f5db6c134b9a696203cfc8b31465b7f40f5ad33d159df91a4caabe3a3c`

Application report:

- `.acquisition/application-reports/issue-136-chengdu-collection-apply-2026-07-24.json`
- Bytes: 2,439
- SHA-256: `cd2d5537b3d894bda1d2133004fa388997fd043826fde19ae5703ab237d9a23f`

Idempotence report:

- `.acquisition/application-reports/issue-136-chengdu-collection-idempotence-2026-07-24.json`
- Bytes: 2,338
- SHA-256: `4c1ffdaf04f1247dcd25e92a29503c00c0582675518ec4428e0d0044cf16b913`
- second application: zero panda insertions, zero panda updates, zero event insertions, zero source changes, zero identity-link changes, and an empty changed-file set.

## New panda identities

| Slug | Chinese | English | Sex | Birth date | Status |
| --- | --- | --- | --- | --- | --- |
| `bao-xin` | 宝新 | Bao Xin | male | 2021-06-24 | reviewed / verified |
| `zhen-xi` | 珍喜 | Zhen Xi | female | 2017-07-15 | reviewed / verified |
| `qing-qing-chengdu-2017-07-26` | 青青 | Qing Qing | female | 2017-07-26 | reviewed / verified |
| `xiao-xin-chengdu-2017` | 小馨 | Xiao Xin | female | 2017-07-26 | reviewed / verified |

Parentage remains unresolved. The official pages provide mother names, but this wave does not infer canonical parent IDs from names alone.

The fourteen existing records receiving official Chinese-name values were:

- `ya-li`;
- `qi-fu-changsha`;
- `zhao-mei`;
- `pu-pu-shenyang`;
- `jin-xiao`;
- `lun-hui`;
- `ya-song`;
- `jing-liang`;
- `da-mei-changsha`;
- `zhi-shi`;
- `zhi-ma`;
- `cheng-lan`;
- `ni-ke`;
- `ni-na`.

## Phase 2 identity replay and birth events

After Phase 1, the 2021 and 2017 adapters were replayed against the new curation and identity-link snapshot.

Results:

- 2021 fixture and live bundles: 60 of 60 candidates matched;
- 2017 fixture and live bundles: 113 of 113 candidates matched;
- fixture/live semantic equality: true for both adapters.

Live bundle artifacts:

| Bundle | Stable ID | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| 2021 Phase 2 | `bundle-1220a8cb5033614f0d3d7a7a3a71365b1e6a2fb994faea3d4d302facf49e94d0` | 147,413 | `b32191f386aef82a747595990b0e4e0df92e5daf533ac8b8b6569ca9de282c9b` |
| 2017 Phase 2 | `bundle-c14446f9d3d922c834a4c67215e2261f4049420a7634d6f2103f8388b25da2c0` | 275,104 | `227a934ad3182173bed2ae39c86d82ca97f7433fa27d97b1ca484273b6fb2097` |

The policy accepted eight bilingual candidates, deduplicated into four birth-event rows:

- `evt_bao_xin_birth_20210624`;
- `evt_zhen_xi_birth_20170715`;
- `evt_qing_qing_chengdu_2017_07_26_birth_20170726`;
- `evt_xiao_xin_chengdu_2017_birth_20170726`.

Phase 2 patch IDs:

- `curation-patch-c45e8d08f9afaa4c35da9522b01c86531893fa32e7cb977ee23bde912f5ee390`
- `curation-patch-ea45b2af37053b4b389edca830ec65ce72f86bac528b6068d70e9655b45ffcbb`

Application report:

- `.acquisition/application-reports/issue-136-chengdu-phase2-apply-2026-07-24.json`
- Bytes: 2,183
- SHA-256: `39503dd5cb74592850e5da3ef8373530fa8b10f037a00ced2a5abc4d09243971`

Idempotence report:

- `.acquisition/application-reports/issue-136-chengdu-phase2-idempotence-2026-07-24.json`
- Bytes: 2,163
- SHA-256: `877c1a4c9eafa8f7d91ba923695c6d9883702e0a49f18775dedccdd501679964`
- second application: zero insertions and an empty changed-file set.

## Final curation hashes

- `events.csv`: `f64b8ecbdf7412e8dba07c92c4ea4eeed0eca68472e8aa6c0b2d519eb00e5e53`
- `pandas.csv`: `38ca16f34f04e5c05dbe81ad02a2e3d6890ecb49a94cfeacecf5fa643a7af394`
- `sources.csv`: `c7b32b90c20e4fe244302c543d7097dd5f5ff5ccef8374577a28b5813f72dcf6`
- `identity-links.json`: `86f2ded1bdb4a3b2bd4024164c49750a8fb55574cf648af45209ef5c1e6b7b52`
- `media.csv` unchanged: `7f573952e355c8f4ecfd1ddadfc48821e87fd03726eac92408d148dbd9f9d3fa`

Independent validator result:

```text
OK: 360 sources, 813 panda rows, 286 event rows, 10 media rows validated
```

## Refreshed breadth-first control plane

Current queue:

- Queue ID: `queue-cb6368e460239d38ac3e7691f790483873fc4c180e26706217de8b27907cf047`
- Panda count: 813
- Work records: 1,607
- Cohorts: 127
- Bytes: 2,218,802
- SHA-256: `978135b45377f4d5150cfff1687999ec1b3c181b9499a706b855192c9a64a1ed`

Current missing-field counts:

| Field | Pandas |
| --- | ---: |
| current-location primary evidence | 689 |
| parentage | 675 |
| structured events | 611 |
| Chinese name | 544 |
| licensed media | 804 |
| exact birth date | 154 |
| gender | 44 |
| life status | 27 |
| current location | 5 |

Post-application breadth-first report:

- Report ID: `backfill-cf6e6a6faecf7ebd6b3709c651412e5d0934ec0366ce861f13a447511c932177`
- `.acquisition/backfill-runs/issue-136-chengdu-breadth-backfill-applied-2026-07-24.json`
- Bytes: 687,523
- SHA-256: `c647620f778353d83e058ca052de7b84b7ef745d202184adafca59da93ac02bb`

Disposition summary:

| Disposition | Pandas |
| --- | ---: |
| acquired candidate batch | 31 |
| reviewed Chengdu source, additional exact pages required | 48 |
| existing official source refresh | 183 |
| official replacement surface required | 90 |
| secondary discovery only | 380 |
| maintenance only | 25 |
| other bounded research/review lanes | 56 |
| **Total** | **813** |

All 32 Chengdu source-local identities now resolve as `merge`; no create identities remain in this wave.

## Verification

- Ruff: passed.
- Acquisition and enrichment tests: 115 passed, 1 skipped.
- Full API tests: 284 passed, 13 skipped.
- Release Gate unit tests: 197 passed.
- Collection Release Gate: 7 of 7 passed, including Web production build.
- Curation validator: passed.
- Phase 1 application idempotence: passed.
- Phase 2 application idempotence: passed.
- Phase 2 fixture/live semantic equality: passed for both adapters.

Application tests use an isolated, explicitly reconstructed pre-application curation snapshot. Normal adapter tests use the current applied curation state. This prevents test results from depending on whether the repository happens to be before or after the application step.

## Remaining review lanes

The following are intentionally not applied:

- 17 contradiction candidates, including sex, date, naming, and event-deduplication conflicts;
- 32 name-only relationship candidates requiring parent identity resolution;
- aliases and pedigree identifiers that need a curation schema extension;
- year-level birth/gave-birth events that cannot be represented by the current exact-date `events.csv` contract;
- supporting duplicate evidence that does not require a second curation row.

The next breadth-first workers should address the remaining 48 Chengdu-cohort pandas, followed by CCRCGP source-surface resolution and Beijing official-source review.
