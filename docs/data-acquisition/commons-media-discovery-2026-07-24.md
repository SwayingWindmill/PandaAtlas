# Wikimedia Commons media discovery — 2026-07-24

Issues: #132, #150

## Boundary

This delivery belongs to the media workflow in #132. The new #150 issue owns structured panda facts, events, lineage, residency, institutions, and evidence acquisition. Commons image discovery does not write structured curation data.

The workflow is discovery-only:

- no curation writes;
- no Public Release, D1, R2, API, or Web writes;
- no original media download;
- no automatic approval;
- no continuation requests or recursive category enumeration.

## Reviewed source policy

The existing Wikimedia Commons Action API source review was extended to allow a bounded `generator=search` operation:

- exact reviewed endpoint: `https://commons.wikimedia.org/w/api.php`;
- File namespace only;
- at most five results per request;
- one request at a time;
- at most six requests per minute across Commons adapters;
- descriptive `PandaAtlasBot` User-Agent;
- no browser impersonation, cookies, redirects, or original-image requests;
- queries derived from canonical curation names;
- an institutional context may be added only when already supported by the reviewed public archive.

Search results remain internal candidates. Identity confidence and rights confidence are evaluated independently.

## Complete discovery queue

The deterministic queue is bound to Public Release `2026.07.24.2` and the first dual-media-library coverage report.

| Metric | Count |
| --- | ---: |
| Pandas needing media discovery | 799 |
| Published pandas needing media discovery | 24 |
| Total search tasks | 1,057 |
| English tasks | 799 |
| Chinese tasks | 258 |

Each task records the panda slug, canonical names, exact query, query basis, priority, namespace, result limit, continuation policy, and download policy.

Generated files:

- `data/media-library/discovery/commons-queue.json`
- `data/media-library/discovery/commons-first-public-five.json`
- `data/media-library/discovery/manifest.json`

## First live cohort

The first bounded live cohort covered five already-published profiles without a profile image:

- Mei Xiang
- Tian Tian
- Xiao Qi Ji
- Bao Bao
- Bei Bei

The final queries used the reviewed Smithsonian context, for example:

`"Bao Bao" Smithsonian panda`

This context is essential because `Bao Bao` and `Tian Tian` are names used by pandas at multiple institutions. A canonical-name match without Smithsonian or National Zoo evidence is automatically downgraded below the profile-image review threshold.

The live run made five requests with a minimum interval of ten seconds. Each raw HTTP response was stored as a fixture containing the exact requested URL, final URL, status, headers, and base64 body. The fixture run is the canonical reproducible result.

## Result

| Metric | Count |
| --- | ---: |
| Requests | 5 |
| Internal candidates | 24 |
| JPEG image candidates | 21 |
| WebM video candidates | 3 |
| Open or public-domain rights metadata | 24 |
| High-identity, open-rights profile-image review candidates | 6 |

Video results are retained as internal discovery evidence but have `profile_image_eligible=false`; they cannot satisfy the profile-image review gate.

### Review-ready candidates

Mei Xiang:

- `File:Mei Xiang at Smithsonian's National Zoo.jpg`
- candidate `commons-candidate-73ee162326e52f8d7f6bb4aa`
- identity confidence `0.95`
- CC BY-SA 4.0

Xiao Qi Ji:

- `File:Giant Panda Xiao Qi Ji at Smithsonian's National Zoo.jpg`
- candidate `commons-candidate-7c99cc1fb00e3519f119e770`
- identity confidence `0.95`
- CC BY-SA 4.0

Four additional Xiao Qi Ji photographs have identity confidence `0.85` and CC BY 2.0 metadata. They remain alternatives for curator review rather than automatic gallery selections.

Bao Bao, Bei Bei, and Tian Tian have no candidate at or above the `0.85` identity threshold in this cohort. Their results remain internal leads only.

## Corrected discovery risks

The first exploratory query shape exposed two issues and was superseded:

1. Cross-institution name collisions could make Berlin or Edinburgh pandas appear relevant to Smithsonian profiles.
2. Commons CC0 metadata may use an HTTP Creative Commons metadata URL even though the asset and description URLs are HTTPS.

The final implementation:

- requires reviewed institution context for the first cohort and downgrades same-name results without that context;
- recognizes an explicit Commons CC0 Public Domain Dedication as public-domain metadata;
- continues to require HTTPS for the Commons asset and description URLs;
- separates MIME eligibility from rights and identity eligibility.

## Immutable evidence

- five raw live HTTP fixtures are stored under `services/api/tests/acquisition/fixtures/commons-media-discovery/`;
- `commons-first-public-five-results.json` contains the deterministic fixture projection;
- `commons-first-public-five-results-manifest.json` binds the cohort, source registry, all five fixtures, and result file by byte count and SHA-256;
- every task result records the raw response-body SHA-256;
- `publication_write_targets` is empty at the cohort, task, result, and manifest levels.

## Verification

- Ruff: passed
- source registry and Commons focused tests: 20 passed
- dual media library tests: 8 passed, including LF/CRLF hash stability
- queue reproducibility: passed
- fixture result and result-manifest reproducibility: passed
- Release Gate configuration tests: 202 passed
- collection Release Gate: 12/12
- API regression: 296 passed, 13 skipped
- Web lint, typecheck, and production build: passed

## Next media slice

Only the six review-ready candidates may advance to the next stage. That stage must separately:

1. select the preferred Mei Xiang and Xiao Qi Ji files;
2. verify the exact Commons file revision and attribution metadata;
3. download approved image bytes under the media processor limits;
4. compute original and derivative hashes;
5. detect exact and perceptual duplicates;
6. create reviewed curation rows;
7. build a new immutable Public Release before any website change.
