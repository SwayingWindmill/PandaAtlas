# Public Beta hard-gate evidence inventory

## Audit scope

- Parent objective: [beta-launch-hard-gates](https://github.com/SwayingWindmill/PandaAtlas/issues/13)
- Evidence map: [Map: prove PandaAtlas Public Beta launch hard gates](https://github.com/SwayingWindmill/PandaAtlas/issues/19)
- Repository baseline: `master` at `a774ea42c9765fe2e9bb44836a746b4c6c5a5984`
- Audit date: 2026-07-15
- Latest baseline CI: [Release Gate run 29395070470](https://github.com/SwayingWindmill/PandaAtlas/actions/runs/29395070470)

This inventory distinguishes repeatable repository or CI evidence from evidence that only a deployed staging environment or human acceptance session can supply. `Proven` means the complete criterion has current evidence. `Partial` means useful controls exist but at least one required environment, assertion, or human check is missing. `Missing` means no qualifying evidence was found.

## Decision

PandaAtlas is **not yet ready for a Public Beta launch decision**. None of the existing evidence contradicts a hard gate, but seven of the eight acceptance criteria remain partial or missing. The repository has a strong clean-checkout baseline and meaningful projection-security tests; the critical remaining work is to turn those controls into one automated preflight, exercise recovery against approved non-production infrastructure, complete accessibility acceptance, and collect staging/usability evidence.

## Criterion-by-criterion matrix

| #13 acceptance criterion | Status | Evidence already present | Evidence still required |
| --- | --- | --- | --- |
| Complete release gate passes from a clean checkout and deployed staging | **Partial** | The workflow uses a clean checkout, pinned tools, lockfile installs, the default gate, a tracked-file cleanliness assertion, and uploaded reports on Linux and Windows ([workflow](../../.github/workflows/release-gate.yml#L32-L90)). The latest `master` run passed both default jobs: [Linux](https://github.com/SwayingWindmill/PandaAtlas/actions/runs/29395070470/job/87286608156) and [Windows](https://github.com/SwayingWindmill/PandaAtlas/actions/runs/29395070470/job/87286608147). | GitHub reports zero configured environments and zero deployments. The workflow contains no staging deployment or post-deployment smoke. The extended gate was skipped in the baseline run, and no `workflow_dispatch` extended run exists. A deployed staging candidate must run the default and extended checks without `environment-blocked` steps. |
| No draft, unreviewed translation, unpublished entity, admin token path, personal correction data, or precise sensitive wildlife location is public | **Partial** | Golden projection tests strip restricted fields and the draft translation ([golden contract](../../scripts/golden-dataset/tests/golden-dataset.test.mjs#L147-L170)); validation rejects published records that depend on unpublished objects ([golden contract](../../scripts/golden-dataset/tests/golden-dataset.test.mjs#L202-L206)). Projection tests reject restricted drafts, personal email values, and precise coordinates, including nested allowed fields ([projection security tests](../../services/api/tests/services/test_public_release_projection.py#L71-L180)). Worker smoke rejects restricted columns/data and verifies public admin routes return `404` ([Worker smoke](../../services/worker-api/scripts/smoke_test_worker.mjs#L246-L248), [admin checks](../../services/worker-api/scripts/smoke_test_worker.mjs#L405-L410)). The local web admin proxy is disabled by default and in production ([security design](../security/local-admin-proxy.md#L36-L49)). | Add one clean-checkout preflight that enumerates every forbidden category across generated artifacts and runtime responses. Run the same black-box assertions against staging. Explicitly prove correction data and browser-delivered assets contain no personal fields or server token. |
| All public parentage conclusions have reviewed sources; all seven current places have verified residency records | **Partial** | The fixture contains seven public pandas. The golden contract requires every confirmed parentage assertion to have source IDs and every panda to have a current primary residency with `last_verified_at` ([golden contract](../../scripts/golden-dataset/tests/golden-dataset.test.mjs#L87-L110)). Static audit found 9 confirmed and 3 tentative parentage assertions; the confirmed assertions reference two sources that are `published`, `accessible`, and last verified on 2026-05-09. Static audit also found exactly 7 current primary residencies, all source-backed and verified on 2026-05-09 or 2026-05-10. | The ticket wording says “seven public parentage conclusions,” but the fixture currently exposes 9 confirmed conclusions; this count/meaning must be made explicit. Add a gate that checks the expected public parentage set, requires the referenced source itself to be published/reviewed/accessible, and proves current-place values are derived from those seven non-overlapping current residencies. |
| PostgreSQL, API, D1, snapshots, and manifest report one compatible public release | **Partial** | The release builder is deterministic, verifies manifest SHA-256 descriptors, and keeps CSV/JSON/API/D1 versions aligned ([projection tests](../../services/api/tests/services/test_public_release_projection.py#L35-L68)). The checked-in release rebuilds byte-for-byte ([rebuild test](../../services/api/tests/services/test_public_release_projection.py#L359-L373)). FastAPI asserts current release metadata and response headers ([metadata tests](../../services/api/tests/api/test_public_release_metadata.py#L16-L41)); Worker smoke requires the same three headers ([Worker smoke](../../services/worker-api/scripts/smoke_test_worker.mjs#L119-L128)). The active manifest records dataset `2026.07.14.3`, Public Schema `1.0.0`, migration `0007`, file sizes, counts, and checksums ([manifest](../../data/public-releases/2026.07.14.3/manifest.json)). | The real PostgreSQL integration path exists only in the extended gate and has no recorded CI run. Add one promotion preflight that compares the published PostgreSQL batch, FastAPI, deployed Worker/D1, downloadable snapshots, and manifest in the same staging run. |
| Atomic switch, rollback, withdrawal, cache purge, PostgreSQL restore, attachment restore, and D1 rebuild are exercised and documented | **Partial** | D1 tests prove immutable history, transactional pointer switching, prior-version selection, and whole-release withdrawal ([D1 projection tests](../../services/api/tests/services/test_public_release_projection.py#L305-L356)). Real-database integration code exercises release, rollback, withdrawal, public visibility, and append-only audit events ([real DB chain](../../services/api/tests/integration/test_real_db_chain.py#L452-L512)). The golden release has a deterministic D1 rebuild artifact. | These are automated simulations, not a dated staging drill. No evidence was found for cache purge, PostgreSQL restore, attachment restore, measured RPO/RTO, or an end-to-end D1 rebuild against approved infrastructure. |
| Core Chinese and English journeys pass desktop, mobile, keyboard, screen-reader, 200% zoom, and reduced-motion acceptance | **Partial** | Browser tests cover bilingual canonical routes, all seven profiles, keyboard activation and sequential focus, JavaScript-disabled readability, 200% effective zoom, and mobile viewport use ([one-panda loop](../../apps/web/tests/smoke/one-panda-public-loop.spec.ts#L21-L137), [seven-panda expansion](../../apps/web/tests/smoke/seven-panda-expansion.spec.ts#L18-L75)). The production browser suite runs in the default gate. | No screen-reader report, automated accessibility scan, reduced-motion test, or documented WCAG 2.2 AA manual checklist was found. The complete search → parent → current place → migration → evidence → cross-profile journey must be exercised in both languages under the required assistive conditions. |
| A 12–20 person directed usability test records task success and cross-profile exploration | **Missing** | The PRD defines the participant count, tasks, and target outcomes ([Public Beta PRD](../product/panda-atlas-public-beta-prd.md#L859-L870)). | No participant protocol, anonymized response format, recruitment evidence, results, or decision record exists. Human participants must perform the specified tasks against a stable staging build. |
| Non-blocking waivers record impact, mitigation, owner, and deadline; no hard-gate failure is waived | **Missing** | The PRD states the policy and prohibits waiving hard gates ([Public Beta PRD](../product/panda-atlas-public-beta-prd.md#L795-L811)). | No waiver register/template or final launch-decision artifact exists. Add a schema/template that rejects hard-gate waivers and requires all four fields for any non-blocking waiver; the final staging decision must link the completed register, even when empty. |

## Current evidence boundary

### Proven now

- The latest `master` commit passes the default clean-checkout release gate on Linux and Windows.
- The committed public release is deterministic and its files match the checked manifest byte-for-byte.
- The repository has automated controls for several high-risk projection leaks and for local/public admin-route isolation.

### Not proven now

- A deployed staging build has passed either the default or extended gate.
- A real staging PostgreSQL/D1/snapshot comparison has reported one compatible release.
- Recovery, cache purge, and attachment restore have been exercised against approved infrastructure.
- Screen-reader, reduced-motion, or directed usability acceptance has occurred.
- A final waiver register and launch decision exist.

## Recommended execution order

1. [Automate trust, privacy, and release-consistency preflight](https://github.com/SwayingWindmill/PandaAtlas/issues/21): consolidate the existing controls, resolve the parentage-count ambiguity, add the waiver schema, and make staging promotion fail closed.
2. In parallel after the preflight contract is stable:
   - [Exercise release rollback, withdrawal, cache purge, and D1 rebuild](https://github.com/SwayingWindmill/PandaAtlas/issues/22).
   - [Exercise PostgreSQL and attachment recovery](https://github.com/SwayingWindmill/PandaAtlas/issues/23).
3. [Complete bilingual accessibility acceptance](https://github.com/SwayingWindmill/PandaAtlas/issues/24): add automated coverage first, then record the required human screen-reader evidence.
4. [Run staging and usability launch decision](https://github.com/SwayingWindmill/PandaAtlas/issues/25): deploy the candidate, run the complete machine/human evidence bundle, conduct the anonymized 12–20 person study, and issue the no-hard-gate-waiver decision.

## External inputs that remain explicit

- A staging URL and non-production secrets for the extended gate.
- Approved PostgreSQL, attachment-store, D1, and cache-purge targets.
- A human screen-reader/device matrix.
- Recruitment and anonymized results for 12–20 directed participants.

Until those inputs are available, automated repository work can improve readiness but cannot honestly close the parent launch-hard-gates objective.
