# Progress Log

## Session: 2026-03-08

### Phase 1: Requirements & Discovery
- **Status:** complete
- **Started:** 2026-03-08 20:00
- Actions taken:
  - Read `frontend-design` skill instructions.
  - Read `planning-with-files` skill instructions.
  - Ran session catch-up for this workspace.
  - Created persistent planning files in the project root.
  - Located the current `/map` route and the related `MapShell` component.
  - Inspected `globals.css`, `map/page.tsx`, `map-shell.tsx`, `api-client.ts`, and `types.ts`.
  - Retrieved the Stitch screen metadata, downloaded its HTML and screenshot, and reviewed the structure.
- Files created/modified:
  - `C:\Users\hao10\Documents\Playground\task_plan.md` (created)
  - `C:\Users\hao10\Documents\Playground\findings.md` (created)
  - `C:\Users\hao10\Documents\Playground\progress.md` (created)

### Phase 2: Planning & Structure
- **Status:** complete
- Actions taken:
  - Documented the refactor target, layout strategy, and data limitations.
  - Defined atlas mode metadata, curated institution entities, recent changes, and extension cards.
- Files created/modified:
  - `C:\Users\hao10\Documents\Playground\task_plan.md`
  - `C:\Users\hao10\Documents\Playground\findings.md`
  - `C:\Users\hao10\Documents\Playground\progress.md`

### Phase 3: Implementation
- **Status:** complete
- Actions taken:
  - Added `apps/web/lib/panda-atlas.ts` to hold mode definitions, legends, curated institution data, recent changes, and extension cards.
  - Added `apps/web/components/map/panda-atlas-explorer.tsx` to implement the new Panda Atlas layout, filters, search, selection card, map stage, and responsive content sections.
  - Rewired `apps/web/app/map/page.tsx` to render the new explorer while preserving server-side data fetching for distribution, habitats, stats, and snapshots.
- Files created/modified:
  - `C:\Users\hao10\Documents\Playground\apps\web\lib\panda-atlas.ts`
  - `C:\Users\hao10\Documents\Playground\apps\web\components\map\panda-atlas-explorer.tsx`
  - `C:\Users\hao10\Documents\Playground\apps\web\app\map\page.tsx`

### Phase 4: Testing & Verification
- **Status:** complete
- Actions taken:
  - Ran `npm run lint:web`.
  - Ran `npm run typecheck:web`.
  - Ran `npm run build -w web`.
  - Resolved a runtime build issue caused by `useEffectEvent` not being available in the current React runtime by switching map event handlers to ref-backed callbacks.
  - Re-ran `npm run typecheck:web` after build because a parallel run had collided with `.next/types`.
- Files created/modified:
  - `C:\Users\hao10\Documents\Playground\apps\web\components\map\panda-atlas-explorer.tsx`
  - `C:\Users\hao10\Documents\Playground\apps\web\app\map\page.tsx`
  - `C:\Users\hao10\Documents\Playground\task_plan.md`
  - `C:\Users\hao10\Documents\Playground\findings.md`
  - `C:\Users\hao10\Documents\Playground\progress.md`

## Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Frontend lint | `npm run lint:web` | No lint errors | Passed | PASS |
| Frontend typecheck | `npm run typecheck:web` | No TypeScript errors | Passed | PASS |
| Frontend production build | `npm run build -w web` | Next.js build succeeds | Passed after replacing `useEffectEvent` usage | PASS |

## Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-03-08 23:25 | `rg` access denied | 1 | Used PowerShell file traversal and `Select-String` instead |
| 2026-03-08 23:32 | Stitch HTML read raced download | 1 | Re-ran the read after download completed |
| 2026-03-08 23:59 | `useEffectEvent` not available at runtime during `next build` | 1 | Replaced it with ref-backed callbacks for map interactions |
| 2026-03-09 00:09 | Parallel `typecheck` and `build` conflicted on `.next/types` | 1 | Re-ran `typecheck` after build completed |

## 5-Question Reboot Check
| Question | Answer |
|----------|--------|
| Where am I? | Phase 5 delivery |
| Where am I going? | Hand off the refactor with verification results and key file references |
| What's the goal? | Refactor the Panda Atlas map page into the requested information-rich atlas experience |
| What have I learned? | The requested atlas experience works best as a hybrid of live/fallback map data and curated frontend institution metadata |
| What have I done? | Planned, implemented, linted, typechecked, built, and validated the new `/map` experience |

## Session: 2026-03-09

### Re-opened Discovery
- **Status:** complete
- Actions taken:
  - Re-read the planning files and confirmed this turn is a new redesign pass rather than simple polish.
  - Located the live route at `apps/web/app/(site)/global-distribution/page.tsx`.
  - Inspected the current atlas component tree under `apps/web/components/atlas`.
  - Compared the cached Stitch screenshot against the latest local page screenshot.
  - Probed the new Stitch project route with `curl` and confirmed the initial response is only the public app shell.
- Findings logged:
  - Atlas-facing copy currently contains mojibake and needs to be rewritten.
  - The map stage is not dominant enough in the current composition and reads as nearly blank.
  - The existing bottom history section should be converted into an on-demand bottom panel.

### Implementation
- **Status:** complete
- Actions taken:
  - Rewrote `apps/web/lib/panda-atlas.ts` with clean UTF-8 atlas modes, institutions, history entries, and support copy.
  - Rebuilt the atlas helper layer for formatting, filtering, habitat mapping, selection state, summary metrics, and network line generation.
  - Replaced the live atlas workspace components with a new top nav, sectional sidebar, stronger map stage, right detail drawer, and bottom history/change sheet.
  - Updated route and root metadata to remove mojibake titles and descriptions.

### Verification
- **Status:** complete
- Actions taken:
  - Ran `npm run typecheck:web`.
  - Ran `npm run lint:web`.
  - Ran `npm run build -w web`.
- Result:
  - All checks passed after the workspace rebuild.

### Visual Flattening Pass
- **Status:** complete
- Actions taken:
  - Reworked the top nav status area from badge/capsule treatments into text-and-divider metadata.
  - Flattened the left atlas rail into sections and rows, removing the remaining card/pill-heavy presentation.
  - Converted the map overlay and bottom summary bar into lighter strip-based UI.
  - Rebuilt the bottom timeline sheet and right detail drawer actions to read as editorial panels rather than nested cards.
  - Cleaned the empty state overlay to match the flatter Stitch-inspired language.
- Files created/modified:
  - `C:\Users\hao10\Documents\Playground\apps\web\components\atlas\top-nav.tsx`
  - `C:\Users\hao10\Documents\Playground\apps\web\components\atlas\atlas-sidebar.tsx`
  - `C:\Users\hao10\Documents\Playground\apps\web\components\atlas\map-overlay.tsx`
  - `C:\Users\hao10\Documents\Playground\apps\web\components\atlas\map-summary-bar.tsx`
  - `C:\Users\hao10\Documents\Playground\apps\web\components\atlas\timeline-section.tsx`
  - `C:\Users\hao10\Documents\Playground\apps\web\components\atlas\entity-detail-drawer.tsx`
  - `C:\Users\hao10\Documents\Playground\apps\web\components\atlas\global-distribution-shell.tsx`

### Post-flattening Verification
- **Status:** complete
- Actions taken:
  - Ran `npm run lint:web`.
  - Ran `npm run build -w web`.
  - Re-ran `npm run typecheck:web` after build to avoid the existing `.next/types` race in parallel runs.
- Result:
  - Lint, build, and typecheck all passed after the flattening pass.

### Full-bleed Layout Pass
- **Status:** complete
- Actions taken:
  - Removed the outer page gutters and `max-width` wrapper from the `/global-distribution` workspace shell.
  - Made the left rail flush to the viewport edge under the top navigation.
  - Removed the map-stage rounded card container so the map now fills the full right-side work area.
  - Expanded the top navigation container to full width to match the new edge-to-edge workspace.
- Files created/modified:
  - `C:\Users\hao10\Documents\Playground\apps\web\components\atlas\global-distribution-shell.tsx`
  - `C:\Users\hao10\Documents\Playground\apps\web\components\atlas\map-stage.tsx`
  - `C:\Users\hao10\Documents\Playground\apps\web\components\atlas\top-nav.tsx`
- Verification:
  - `npm run lint:web`
  - `npm run build -w web`
  - `npm run typecheck:web`

### Fixed Workspace Simplification
- **Status:** complete
- Actions taken:
  - Removed the history timeline / recent changes layer from the distribution workspace.
  - Simplified the shell state so the page is again a fixed non-scrolling map workspace.
  - Restyled the left rail using the homepage's softer rounded cards, accent chips, and warm light gradients.
  - Trimmed the right detail drawer so it only handles object reading and map actions.
- Files created/modified:
  - `C:\Users\hao10\Documents\Playground\apps\web\components\atlas\global-distribution-shell.tsx`
  - `C:\Users\hao10\Documents\Playground\apps\web\components\atlas\atlas-sidebar.tsx`
  - `C:\Users\hao10\Documents\Playground\apps\web\components\atlas\entity-detail-drawer.tsx`
- Verification:
  - `npm run lint:web`
  - `npm run build -w web`
  - `npm run typecheck:web` (re-run serially after the existing `.next/types` race)

## Updated Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| Frontend typecheck | `npm run typecheck:web` | No TypeScript errors | Passed | PASS |
| Frontend lint | `npm run lint:web` | No lint errors | Passed | PASS |
| Frontend production build | `npm run build -w web` | Next.js build succeeds | Passed | PASS |

## Recovered research progress summary: 2026-07-27 through 2026-07-30

> Recovery note: a mistaken overwrite on 2026-07-30 replaced the uncommitted detailed research-session appendices. The Git-tracked baseline above was restored from a clean worktree. The summary below was reconstructed from the surviving builders, generated import artifacts, tests, discovery reports, media audits and current index. Detailed batch data remains in `data/local-panda-research/`, and batch-specific behavior remains encoded in `scripts/research/` and its tests.

### Collection expansion through round190
- Added and reviewed international, domestic, birthday, transfer, lineage, founder, offspring and direct-caption batches covering rounds 12 and 19-190.
- Established local-only import conventions, deterministic JSON and compressed artifacts, media qualification checks, duplicate-name boundaries and focused regression tests.
- Preserved zero-media outcomes whenever an image could not be explicitly bound to the current Subject.

### New-Subject rounds191-390
- Completed 200 batches across rounds191-390 with structured source, fact, Subject and media artifacts.
- Built the persistent collision index, candidate discovery graph and confirmed-subject media catalog.
- Repaired and audited prior media mappings, retained profile-bound avatars only when the identity block explicitly named the Subject, and recorded valid zero-media batches instead of using relatives or contextual substitutes.
- Embedded historical batch summaries through round390 in the media-policy file; later batch audits were moved to separate `media/audits` files so policy schema versioning would no longer track collection progress.

### New-Subject rounds391-410
- Added 20 Subjects across Cheng Cheng, Ye Ye, Su Lin, Xing and Jun Zhu maternal lines.
- Built 20 batches, 156 fact records, 20 confirmed profile-bound media rows and 80 deterministic artifacts.
- Focused tests passed 13/13; the full local research suite passed 572/572 at that checkpoint.
- Media audit: `data/local-panda-research/media/audits/new-subject-media-audit-rounds391-410.json`.

### New-Subject rounds411-430
- Added 20 Subjects including Chun Chun/Hui Hui, Shen Shen/Ao Ao, Qing Chong Yang/Qing Zhu Yu, Zhuang Mei/Ning Ning and additional offspring lines.
- Preserved conflicting birth-order evidence without guessing and kept cross-midnight twins as explicit twins.
- Built 20 batches, 22 source rows, 170 fact records and 20 confirmed media rows.
- Focused tests passed 13/13; full suite passed 598/598.
- Media audit: `data/local-panda-research/media/audits/new-subject-media-audit-rounds411-430.json`.

### New-Subject rounds431-450
- Added 20 Subjects across Yuan Yuan, Ya Li, Ke Lin, Cai Yun, Ai Bang and other maternal lines.
- Reused existing Man Lan after birth, mother and transfer reconciliation; kept same-day siblings separate from twins unless the source explicitly said twins.
- Built 20 batches, 25 source rows, 159 fact records and 20 confirmed media rows.
- Focused tests passed 13/13; full suite passed 611/611.
- Media audit: `data/local-panda-research/media/audits/new-subject-media-audit-rounds431-450.json`.

### New-Subject rounds451-470
- Added 20 Subjects across Bing Bing, Yuan Run, Jiao Zi, Qing Qing, Si Xue, Mei Lun, Miao Miao, Xi Mei and Ya Li lines.
- Added the explicit Ya Zhu/Ya Yun twin pair and kept Ya Yun / 雅韵 separate from Ya Yun / 娅韵 because Chinese identity and maternal line differed.
- Built 20 batches, 27 source rows, 163 fact records and 20 confirmed media rows.
- Focused tests passed 13/13; full suite passed 624/624.
- Media audit: `data/local-panda-research/media/audits/new-subject-media-audit-rounds451-470.json`.

### New-Subject rounds471-490
- Added 20 Subjects including A Bao's Bao Ge/Bao Mei twins, Bai Xue's Xiu Xiu/Qing Qing twins, Shu Lan, rescued founder Su Su and recent offspring lines.
- Kept A Bao's Bao Mei separate from the existing Bao Mei with a different birth date and mother; kept the 1999 male Qing Qing separate from all other Qing Qing identities.
- Updated candidate discovery and the research index to support composite bilingual names and Chinese-parenthesis aliases such as Zhi Yu（Zi Yu） / 徵羽（子羽）.
- Built 20 batches, 33 source rows, 178 fact records and 20 confirmed media rows.
- Focused tests passed 14/14; full suite passed 638/638.
- Media audit: `data/local-panda-research/media/audits/new-subject-media-audit-rounds471-490.json`.

## Session: 2026-07-30 — New-Subject rounds491-510

### Founder lines, twins and existing-subject reconciliation
- Added 19 new Subjects and reconciled one existing Subject across 20 rounds.
- Added Princess offspring Shan Hu / 山虎, Yun Yun / 运运 and Ya Ao / 雅奥, including movement and Ya Ao medical/death history.
- Reconciled the Pandapia Chuan Chuan (Yun Chuan) profile into existing `yun-chuan`; no duplicate Yun Chuan Subject was created.
- Added Zhen Zhen twins Zhen Lan / 珍兰 and Sheng Lan / 胜兰. The 2021 Sheng Lan remains separate from `sheng-lan-shenshuping` because the older record lacks birth, maternal and studbook anchors.
- Added Hua Mei offspring Mei Ling / 美灵 and Yang Hu / 阳虎.
- Added early Chengdu founder Mei Mei / 美美, offspring Rong Sheng / 蓉生 and Jin Jin / 锦锦, Long Gu / 龙古 and offspring Xin Yue / 新月, and founder Guo Guo / 果果.
- Added Shu Lan offspring Lan Bao / 兰宝; Xiao Ya Tou twins Shun Shun / 顺顺 and Liu Liu / 溜溜; Ai Li offspring Ai Jiu / 艾玖; Yang Hua offspring Bao Quan / 宝泉; and Nuo Mi offspring Yu Chen / 宇晨.
- Preserved year-only or estimated birth precision for Mei Mei, Long Gu and Guo Guo. The 2019 Shun Shun remains separate from `shun-shun-hainan`, and early Chengdu Mei Mei remains separate from all other Meimei / Mei Mei Subjects.
- Generated 20 batches, 42 source rows, 171 fact records and 80 deterministic artifacts.

### Media and verification
- Retained 20 individual profile-bound avatars and 20 distinct assets within the batch; all returned HTTP 200 with `image/png` content.
- Focused verification — PASS: 14 tests. Full local research discovery — PASS: 652 tests in two groups because a single long connector call returned transient 502 responses.
- Artifact scan — PASS: 20 batches, 80 artifacts, 42 sources, 171 records, zero parity failures and zero invalid Subject confirmations.
- Relationship-graph discovery visited 551 profiles from 269 seeds with zero fetch errors and 18 remaining candidates.
- Refreshed research index: 1,145 files, 760 Subject IDs, 2,593 normalized name keys, 8,997 record IDs, 8,043 Subject/predicate keys, 1,433 media IDs, 1,204 confirmed-Subject media IDs and 1,424 asset URLs.
- Combined rounds191-510 contain 320 batches, 246 confirmed media rows, 244 distinct assets and 81 valid zero-media batches.
- Media review is stored separately at `data/local-panda-research/media/audits/new-subject-media-audit-rounds491-510.json`; the core image-policy schema remains version 7.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-07-30 — New-Subject rounds511-528

### Final Pandapia candidate-pool completion
- Processed the remaining 18 discovered profiles as 16 new Subjects and two existing-Subject reconciliations.
- Added Zheng Zai / 正仔, Qin Chuan / 秦川, Lv Di / 绿地, Ting Zai / 婷仔, Ai Bang's 2016 cub 66, Jin Hui / 金辉, Wu Wen's 2024 Cub B, Ai Le / 爱乐, Ling Zhu / 伶竹, Huan Cai / 奂彩, Mei Zhu / 妹珠, An An's 2022 cub, Wang Yue / 望月, Shu Hui / 蜀辉 and An An's 2023 Cub A and Cub B.
- Reconciled Man Lan's 2025 cub into existing `man-lan-cub-lanzhou` and Li Ao / 里奥 into existing `rio-indonesia`; no duplicate Subjects were created.
- Confirmed An An's 2023 Cub A and Cub B as twins from the official Qinling one-male/one-female litter report, while leaving each individual's sex unresolved because the official source does not assign sex to birth order.
- Confirmed Wu Wen's 2024 Cub B as Lang Yue's younger littermate and preserved the Beijing-date / Netherlands-local-date midnight boundary.
- Preserved Mei Zhu / 妹珠 and Xinhua's 妹猪 as source spelling variants for one cub.
- Excluded the malformed 2016 date embedded beside Ai Le's link on an older sibling page and retained Ai Le's own 2022-10-01 profile date.
- Kept Shu Hui's 2012-born female mother Hui Hui separate from the existing 2005-born male Hui Hui Subject.
- Generated 18 batches, 39 source rows, 160 fact records, 18 confirmed media rows and 72 deterministic artifacts.

### Media, discovery and verification
- All 18 profile-bound avatar assets returned HTTP 200 with `image/png` content; zero parity failures and zero invalid Subject mappings were found.
- Focused verification — PASS: 14 tests. Full local research suite — PASS: 666 tests in two groups.
- Candidate discovery visited 551 profiles from 298 seeds with zero fetch errors and zero remaining candidates.
- Refreshed research index: 1,181 files, 776 Subject IDs, 2,683 normalized name keys, 9,157 record IDs, 8,203 Subject/predicate keys, 1,451 media IDs, 1,222 confirmed-Subject media IDs and 1,442 asset URLs.
- Combined rounds191-528 contain 338 batches, 264 confirmed media rows, 262 distinct assets and 81 valid zero-media batches.
- Media review is stored separately at `data/local-panda-research/media/audits/new-subject-media-audit-rounds511-528.json`; the core image-policy schema remains version 7.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-07-30 — Depth-enrichment rounds529-548

### Existing-Subject depth pass and identity repair
- Shifted collection from new-Subject discovery to existing-Subject depth enrichment after the Pandapia candidate graph reached zero remaining profiles.
- Upgraded `audit_local_panda_research_coverage.py` to include import records and media, deduplicate by stable IDs, reject explicitly unconfirmed depictions, and report independent source counts; coverage report schema is now version 3.
- Corrected round325 so Jie Bang / 结浜 reconciles into existing `yuihin-shirahama`; the index now contains 775 Subjects and all Jie Bang, 结浜 and Yuihin queries resolve to the same Subject.
- Corrected the rounds311-330 historical summary to 19 new Subjects, one reconciliation and 143 fact records without changing media-policy schema version 7.
- Enriched 20 existing Subjects across Qi Fu, Xian Xian, Wang Jia, Si Xue, Yang Hua, Ju Xiao, Cheng Cheng, Cai Yun, Zhi Zhi, Xi Mei, Jiao Zi, Miao Miao, Princess, Mei Lun and Xiao Ni lines.
- Preserved 七巧 / 奇巧 and 七喜 / 奇喜 as auditable name-form conflicts, preferring the individual-profile forms 七巧 and 七喜 for current display.
- Added reciprocal twin evidence for Ao Ran, Bo Wen, Cai Yun, Chun Hui, Chun Lai and Jin Shuang, plus reciprocal cross-midnight evidence for Cheng Ji and Jiao Xiao.
- Preserved the Xi Mei profile inconsistency where the family card lists Hao Yue but the biography's named surviving-offspring list omits him; no death or survival inference was added.
- Added Pan Yue demographics and lineage while retaining the existing directly captioned Xinhua media asset.
- Generated 20 batches, 52 source rows, 106 fact records and 80 deterministic artifacts. No new media rows or assets were added; all 20 batches reference existing confirmed media.

### Verification and current state
- Focused rounds529-548 verification — PASS: 13 tests. Coverage-audit verification — PASS: 6 tests. Rounds311-330 reconciliation verification — PASS: 13 tests.
- Full local research suite — PASS: 682 tests in two groups of 240 and 442.
- Artifact scan — PASS: 20 batches, 80 artifacts, 20 empty media files, zero parity failures, zero duplicate Subject/predicate keys and zero unused sources.
- Refreshed index: 1,221 files, 775 Subject IDs, 2,691 normalized name keys, 9,264 record IDs, 8,310 Subject/predicate keys, 1,451 media IDs, 1,222 confirmed-Subject media IDs and 1,442 asset URLs.
- Refreshed coverage audit: 1,451 candidate rows, 569 Subjects with individual media, zero media-covered Subjects without facts and 109 fact-bearing Subjects without individual media.
- Combined rounds191-548 contain 358 batches, 519 source rows, 2,431 fact records, 264 confirmed media rows, 262 distinct assets, 81 true zero-media batches and 20 existing-media/no-new-asset batches.
- Audit is stored at `data/local-panda-research/media/audits/depth-enrichment-media-audit-rounds529-548.json`; core image-policy schema remains version 7.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-07-30 — Identity and depth rounds549-568

### Same-name identity repair, media-gap closure and lineage resolution
- Added two previously hidden same-name Subjects: female Chengdu `xing-ya-chengdu-female-2007` and 1986 Chengdu matriarch `bing-bing-chengdu-1986`.
- Kept female Xing Ya separate from the 2013-born male Ouwehands `xing-ya`, and kept 1986 Bing Bing separate from `bing-bing-dujiangyan-2015`.
- Reconciled Yan Hui's source spellings 妍惠 and 妍慧 into existing `yan-hui-yaan-2016`, added studbook 1046, alias 小博士, shoulder-band detail and a confirmed profile avatar.
- Resolved Qi Ji and Xi Qing's mother to `ya-ya-qinling`; attached official mixed-sex twin weights of 137 g and 110 g plus the documented dystocia-management outcome.
- Resolved Xing Chen and Xing Guang's mother to the new female Chengdu Xing Ya Subject, preserving the explicit boundary against the male Ouwehands namesake.
- Resolved Xiang Bing's mother to the new 1986 Bing Bing Subject and expanded the Xiang Guo / Xiang Shan offspring line.
- Preserved Run Yang and Run Ze as reciprocal same-day siblings without inferring twin status, and retained Su Lin's 2019 Cub A as an explicit older twin whose littermate remains unnamed.
- Added reciprocal twin, birth-weight, appearance, behaviour and lineage details for Xiao Chuan, Xiao Ya, Xing An, Ya Wen and related family lines.
- Generated 20 batches, 62 source rows, 137 fact records, three new confirmed media rows and 80 deterministic artifacts.

### Audit semantics and verification
- Upgraded coverage-report schema to version 4: `source_count` now counts independent source families, while `source_id_count` preserves raw page/source counts. Multiple Pandapia profiles remain one `pandapia-profile-network` source family.
- Updated the research index to recognize `official_chinese_name_variant` and `pandapia_chinese_name_variant`; 妍慧 and 妍惠 now both resolve only to `yan-hui-yaan-2016`.
- All three new avatar assets returned HTTP 200 with `image/png`; no media ID, asset URL or Subject mapping collisions were found.
- Focused rounds549-568 verification — PASS: 12 tests. Coverage-audit verification — PASS: 8 tests. Index verification — PASS: 3 tests.
- Full local research suite — PASS: 696/696 via the formal `npm run test:local-panda-research` command.
- Development acceptance initially exposed an import-time dependency on optional crawler package `requests`; network-only imports were moved into the discovery command's `main()` boundary, after which `npm run verify:dev -- --scope research` passed.
- Refreshed index: 1,261 files, 777 Subject IDs, 2,698 normalized name keys, 9,401 record IDs, 8,447 Subject/predicate keys, 1,454 media IDs, 1,225 confirmed-Subject media IDs and 1,445 asset URLs.
- Refreshed coverage audit: 1,454 candidate rows, 572 Subjects with individual media, zero media-covered Subjects without facts and 108 fact-bearing Subjects without individual media.
- Combined rounds191-568 contain 378 batches, 581 source rows, 2,568 fact records, 267 confirmed media rows, 265 distinct assets, 81 true zero-media batches and 37 existing-media/no-new-asset batches.
- Audit is stored at `data/local-panda-research/media/audits/identity-depth-media-audit-rounds549-568.json`; core image-policy schema remains version 7.
- Candidate discovery remains exhausted at zero profiles with zero fetch errors.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-07-30 — Confirmed media-gap closure rounds569-588

### Global profile discovery and identity-safe selection
- Crawled the bounded Pandapia relationship graph from 318 local profile seeds; visited 553 individual profile pages with zero fetch errors.
- Matched profiles against the full local normalized-name index and checked existing birth dates, birth years, sex and studbook anchors before accepting an avatar.
- Found 44 qualified missing-media matches and selected the 20 highest-priority fact-bearing Subjects for rounds569-588.
- Explicitly rejected unsafe same-name mappings, including `ya-ya-chongqing`, whose profile remained tied across multiple Ya Ya Subjects, and `qing-qing-chengdu-2017-07-26`, whose candidate profile birth date conflicted with the existing birth event.
- Closed confirmed individual-media gaps for Meng Hao, Madrid Jiu Jiu, Wang Jia, Qi Bao, Qi Zhen, Chengdu Lin Lin, Chengdu Xing Xing, Kobe Tan Tan, Xiao Xin, Atlanta Mei Lun, Quan Yun, Wen Li, Cheng Gong, Ai Li, Ya Li, Xi Meng, Xi Mei, Jin Ke, Lu Lin and Da Jiao.
- Generated 20 batches, 20 source rows, 40 fact records, 20 confirmed media rows and 80 deterministic artifacts.

### Media, coverage and verification
- All 20 avatar URLs returned HTTP 200 with `image/png`; all 20 asset URLs and downloaded byte hashes were distinct.
- Focused rounds569-588 verification — PASS: 8 tests. Affected historical batch regression verification — PASS: 62 tests.
- Full local research suite — PASS: 704/704. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Corrected five historical new-Subject tests so their collision checks use records that existed before the original batch range rather than treating later enrichment/media batches as prior duplicates.
- Refreshed index: 1,301 files, 777 Subject IDs, 2,698 normalized name keys, 9,441 record IDs, 8,487 Subject/predicate keys, 1,474 media IDs, 1,245 confirmed-Subject media IDs and 1,465 asset URLs.
- Refreshed coverage audit: 1,474 candidate rows, 592 Subjects with individual media, zero media-covered Subjects without facts and 88 fact-bearing Subjects without individual media; this batch reduced the individual-media gap by 20.
- Combined rounds191-588 contain 398 batches, 601 source rows, 2,608 fact records, 287 confirmed media rows and 285 distinct assets.
- Discovery, network and final review evidence are stored in `data/local-panda-research/media/discovery/pandapia-media-gaps-rounds569-588.json`, `data/local-panda-research/media/audits/media-gap-network-check-rounds569-588.json` and `data/local-panda-research/media/audits/media-gap-closure-audit-rounds569-588.json`.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-07-30 — Byte-distinct media-gap closure rounds589-608

### Identity resolution and shared-placeholder rejection
- Re-ran the bounded Pandapia graph against the updated 88-Subject media-gap queue from 329 seeds; 553 profile pages were visited with zero fetch errors and 24 identity-qualified profile avatars were found.
- Added an explicit resolution basis to discovery: 17 selected Subjects resolve through a globally unique normalized name, while Qian Qian, He He and the female Jiu Jiu resolve through positive identity anchors.
- Downloaded all 24 candidate assets before selection. Although all URLs were different and all returned HTTP 200 `image/png`, only 21 byte hashes were distinct.
- Rejected Dong Dong, Bai Xue, Tang Tang and Xue Xue because all four profile URLs returned the same SHA-256 asset; the shared placeholder cannot confirm depiction of any one Subject.
- Selected the remaining 20 Subjects with 20 different byte hashes and closed their confirmed individual-media gaps.
- Generated 20 batches, 20 source rows, 40 fact records, 20 confirmed media rows and 80 deterministic artifacts; 64 stale artifacts from the interrupted pre-hash selection were pruned automatically.

### Coverage and verification
- Focused rounds589-608 verification — PASS: 8 tests. Affected rounds291-310 plus current-batch regression verification — PASS: 21 tests.
- Full local research suite — PASS: 712/712. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Corrected the rounds291-310 historical new-Subject test so later enrichment and media-gap imports are not treated as records that existed before the original batch.
- Refreshed index: 1,341 files, 777 Subject IDs, 2,698 normalized name keys, 9,481 record IDs, 8,527 Subject/predicate keys, 1,494 media IDs, 1,265 confirmed-Subject media IDs and 1,485 asset URLs.
- Refreshed coverage audit: 1,494 candidate rows, 612 Subjects with individual media, zero media-covered Subjects without facts and 68 fact-bearing Subjects without individual media; this batch reduced the gap by another 20.
- Combined rounds191-608 contain 418 batches, 621 source rows, 2,648 fact records, 307 confirmed media rows and 305 distinct assets.
- Evidence is stored in `data/local-panda-research/media/discovery/pandapia-media-gaps-rounds589-608.json`, `data/local-panda-research/media/audits/media-gap-network-check-rounds589-608.json` and `data/local-panda-research/media/audits/media-gap-closure-audit-rounds589-608.json`.
- No additional byte-distinct Pandapia profile avatar remains among this candidate set; the next pass must use independent official, archive, news, video-caption or Commons sources.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-07-30 — External identity-explicit media audit rounds609-628

### Official, archive and Commons evidence boundaries
- Ran a 24-task bounded Wikimedia Commons cohort: 22 tasks completed, two failed, and 38 candidate rows were captured with no publication write targets.
- Reviewed 24 curated official or state-media pages in four bounded parts. Fourteen pages completed and ten failed; only image-specific alt/title text or dedicated archival metadata was accepted for identity.
- Added a confirmed named photo for `ju-xiao-wolong-2002` and a 1930s archival photo for `su-lin-chicago-1936`; both returned HTTP 200 `image/jpeg` and distinct SHA-256 hashes.
- Reconciled the existing named Ling-Ling Commons image from legacy `ling-ling-smithsonian` to canonical `ling-ling-smithsonian-1972` without duplicating the media ID or asset.
- Migrated 16 legacy Ling-Ling fact records, removed one duplicate sex record and renamed two complementary collision predicates; the migration is idempotent and leaves zero legacy-ID residuals.
- Retained Ming's named Hunterian Museum skull as `museum_specimen` supporting media only. It does not close the individual portrait gap.
- Explicitly rejected Ocean Park Hong Kong's Ying Ying for the Chapultepec founder, Bao Bao files returned for Tjen Tjen, Ya Er/Xing Er captions on a Shuang Xi article, and the modern San Diego cub named Su Lin.
- Generated 20 batches, 20 source rows, 24 fact records, three new media rows, 16 negative media audits and 80 deterministic artifacts.

### Coverage and verification
- Focused rounds609-628 verification — PASS: 8 tests. Related historical and current regression verification — PASS: 38 tests. Existing Commons-related verification — PASS: 42 tests.
- Full local research suite — PASS: 720/720. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Moved optional `httpx` and runner imports to actual live-fetch/request boundaries so local urllib discovery and parser tests no longer require optional network dependencies at import time.
- Updated historical collision tests for rounds72-74, rounds168-170 and rounds171-190 to preserve their original temporal boundary and ignore later canonical-merge records.
- Refreshed index: 1,381 files, 776 Subject IDs, 2,698 normalized name keys, 9,504 record IDs, 8,550 Subject/predicate keys, 1,497 media IDs, 1,268 confirmed-Subject media IDs and 1,488 asset URLs.
- Refreshed coverage audit: 1,497 candidate rows, 614 Subjects with individual media, zero media-covered Subjects without facts and 65 fact-bearing Subjects without individual media; the net gap reduction is three.
- Combined rounds191-628 contain 438 batches, 641 source rows, 2,672 fact records, 310 total media rows, 299 confirmed individual media rows, one supporting museum specimen row and 308 distinct assets.
- Evidence is stored in `data/local-panda-research/media/audits/external-media-audit-rounds609-628.json` and its referenced Commons, official-page and network reports.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-07-30 — Supporting-media classification rounds629-648

### Sole-panda classification and identity boundaries
- Applied confirmed-subject image policy schema 7: a current Subject closes the individual-media gap only when it is the sole panda depicted and identity is explicit; a human may be co-depicted, while another panda keeps the image supporting-only.
- Reclassified the existing `local-media-round66-yubao-yubei-naming-04` row from `panda_with_keeper` to `individual_panda`. The caption directly identifies Yu Bei and she is the only panda depicted; no new media ID or asset was added.
- Updated `build_chongqing_new_subjects_rounds66_68.py` and regenerated the round66 plain and compressed artifacts so future reruns preserve the correction.
- Added an official single-panda birth image for `ling-lang-shenshuping-2018`; the image returned HTTP 200 `image/png` with SHA-256 `fdeb2b3b8c43a4e9b265321aa4028c7fb541918144869cc16117f7aaf40bf6d0`.
- Added the Kobe Oji Zoo first-generation Kou Kou / Jin Zhu profile image for `kou-kou-kobe-jin-zhu-1996`; image 06 is bound to the 1996-born first male, while image 07 belongs to the second-generation namesake. The selected image returned HTTP 200 `image/jpeg` with a distinct SHA-256.
- Kept 17 reviewed Subjects open where evidence remained mother-cub, twin/pair, cohort, museum-only, unlabeled historic, same-name wrong-institution, explicitly absent or offspring-only.
- Generated 20 batches, 20 source rows, 23 fact records, two new media rows, one existing-media reclassification, 17 classification audits and 80 deterministic artifacts.

### Coverage and verification
- Focused rounds629-648 verification — PASS: 8 tests. Round66 plus current regression verification — PASS: 16 tests.
- Full local research suite — PASS: 728/728. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Refreshed index: 1,421 files, 776 Subject IDs, 2,698 normalized name keys, 9,527 record IDs, 8,573 Subject/predicate keys, 1,499 media IDs, 1,271 confirmed-Subject media IDs and 1,490 asset URLs.
- Refreshed coverage audit: 1,499 candidate rows, 617 Subjects with individual media, zero media-covered Subjects without facts and 62 fact-bearing Subjects without individual media; the net gap reduction is three.
- Combined rounds191-648 contain 458 batches, 661 source rows, 2,695 fact records, 312 total media rows, 301 confirmed individual media rows and 310 distinct assets.
- Evidence is stored in `data/local-panda-research/media/audits/media-classification-audit-rounds629-648.json` and `data/local-panda-research/media/audits/media-classification-network-check-rounds629-648.json`.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-07-30 — Official-caption audit rounds649-668

### Commons, official-page and byte-verification boundaries
- Ran a bounded 20-task Commons cohort with 20 completed tasks, zero failures and 23 candidate rows; no Commons candidate survived identity review.
- Rejected the high-confidence Fei Fei result because it identifies the Ueno Zoo namesake and museum specimen, not Gang Gang's mother from the Anshan lineage.
- Reviewed 20 official or previously audited archival pages in four bounded parts: 13 pages completed and seven failed. Two automated local-text matches were rejected because they came from surrounding Er Lang mating text while the images depicted Yong Yong and her cub.
- Added one confirmed individual photo for `xi-yue-qizai-father`. The National Forestry and Grassland Administration image caption directly names Xi Yue eating honey at a villager's home; the asset returned HTTP 200 `image/jpeg`, 1,022,943 bytes and SHA-256 `07df8e66aa9c77366a1c4e7a5c4afc5682344fdf835cba94e2b1e44766d215b0`.
- Preserved an official per-image identity confirmation for `er-lang-qinling-breeding-male`, but did not add a media row because three HTTP/HTTPS/Referer-assisted attempts returned HTTP 502 with zero bytes.
- Explicitly rejected Shuang Xi images captioned Ya Er and Xing Er, Shi Shi relative-only archive figures, Shao Shao's Chu Lin hero image, Gong Zhu's daughter-only images, Bing Bing's unresolved twin pair, Wu Gang's lineage-only mention and Fei Fei's offspring/namesake substitutions.
- Generated 20 batches, 20 source rows, 22 fact records, one new confirmed media row, one byte-pending caption record, 18 negative audits and 80 deterministic artifacts.

### Coverage and verification
- Focused rounds649-668 verification — PASS: 8 tests before and after the coverage refresh.
- Full local research suite — PASS: 736/736. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Refreshed index: 1,461 files, 776 Subject IDs, 2,698 normalized name keys, 9,549 record IDs, 8,595 Subject/predicate keys, 1,500 media IDs, 1,272 confirmed-Subject media IDs and 1,491 asset URLs.
- Refreshed coverage audit: 1,500 candidate rows, 618 Subjects with individual media, zero media-covered Subjects without facts and 61 fact-bearing Subjects without individual media; the net gap reduction is one.
- Combined rounds191-668 contain 478 batches, 681 source rows, 2,717 fact records, 313 total media rows, 302 confirmed individual media rows and 311 distinct assets.
- Evidence is stored in `data/local-panda-research/media/audits/official-caption-audit-rounds649-668.json`, `data/local-panda-research/media/audits/official-caption-network-check-rounds649-668.json` and their referenced discovery reports.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-07-31 — Identity and Subject-type audit rounds669-688

### Identity cards, historical captions and schema corrections
- Completed all 19 Commons name-only tasks after retry: 18 candidate rows were reviewed and none survived identity review. Rejected `File:A Happy Panda.jpg` because “happy” is an adjective rather than the historic panda's identity, and rejected generic Chengdu panda files for En En because they contain no individual metadata.
- Added eight distinct confirmed individual images for Xiao Bai Tu, Ying Hua, Bei Chen, Ha Lan, Happy, Mei Mei, Yao Man and Ai Lian. All eight assets returned HTTP 200, non-empty image bytes and eight distinct SHA-256 values; none matched the known shared Pandapia placeholder hash.
- Accepted four image-specific caption or historical-archive mappings and four Pandapia identity-card avatars anchored by names plus studbook numbers 784, 287, 408 and 759.
- Corrected `mei-mei-chengdu-qiyuan-mother` from `Mei Mei / 媚媚` to `Mei Mei / 梅梅`, synchronized the round93 and round243 builders and regenerated their plain and compressed artifacts.
- Corrected the three round51 records for `malaysia-panda-programme-2014-2025` from `panda` to `research_programme`; the cooperation programme no longer appears as a synthetic individual-panda media gap.
- Kept 11 reviewed Subjects open where evidence remained prior-offspring text, parent-only text, mother-cub, unresolved pair position, unrelated event imagery, inaccessible archive content or shared-placeholder media.
- Generated 20 batches, 20 source rows, 29 fact records, eight new media rows, one Subject-type correction, one canonical-name correction, 11 negative audits and 80 deterministic artifacts.

### Coverage and verification
- Focused rounds669-688 verification — PASS: 8 tests before and after the coverage refresh. Affected historical and current suites — PASS: 37/37.
- Full local research suite — PASS: 744/744. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Refreshed index: 1,501 files, 776 Subject IDs, 2,696 normalized name keys, 9,578 record IDs, 8,624 Subject/predicate keys, 1,508 media IDs, 1,280 confirmed-Subject media IDs and 1,499 asset URLs.
- Refreshed coverage audit: 1,508 candidate rows, 626 Subjects with individual media, zero media-covered Subjects without facts and 52 fact-bearing Subjects without individual media; eight media gaps and one non-panda gap were removed for a net reduction of nine.
- Combined rounds191-688 contain 498 batches, 701 source rows, 2,746 fact records, 321 total media rows, 310 confirmed individual media rows and 319 distinct assets.
- Evidence is stored in `data/local-panda-research/media/audits/identity-and-subject-type-audit-rounds669-688.json`, `data/local-panda-research/media/audits/identity-and-subject-type-network-check-rounds669-688.json` and their referenced discovery reports.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-07-31 — Identity-card closure rounds689-708

### Identity-card, family-link and deferred-byte recovery
- Completed all 20 Commons name-only tasks after one retry: 28 candidate rows were reviewed and none survived as an individual portrait. Ueno Fei Fei museum files were rejected as a wrong-institution namesake, while Ming skull files remain named supporting specimens only.
- Reviewed 15 Pandapia identity cards with HTTP 200 image bytes. Retained 13 avatars cross-resolved by studbook numbers or explicit parent/offspring family links.
- Rejected Dong Dong's known shared-placeholder avatar and discovered a second cross-Subject byte collision: San Diego Shi Shi's avatar has the same SHA-256 as the unrelated Lao Lao Subject despite a different URL.
- Recovered Er Lang's previously deferred official image. Four HTTP, HTTPS and Referer-assisted requests returned the same 142,478-byte JPEG after earlier HTTP 502 zero-byte failures.
- Added 14 confirmed individual media rows for Mei Mei, Niu Niu, Wu Gang, Bo Si, Er Lang, Shen Wei, Bing Bing, Dan Dan, Wan Wan, Fei Fei, Gong Zhu, Na Na, Chang Ning and Chang Qing.
- Kept six Subjects open: Shi Shi and Dong Dong because of shared-image hashes; Ming because only a named museum specimen is available; Chia-Chia and Ching-Ching because ZSL image context remains access-blocked; and Shao Shao because the official page image is Chu Lin.
- Generated 20 batches, 20 source rows, 35 fact records, 14 new media rows, six negative audits and 80 deterministic artifacts.

### Coverage and verification
- Focused rounds689-708 verification — PASS: 8 tests before and after the coverage refresh.
- Full local research suite — PASS: 752/752. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Refreshed index: 1,541 files, 776 Subject IDs, 2,696 normalized name keys, 9,613 record IDs, 8,659 Subject/predicate keys, 1,522 media IDs, 1,294 confirmed-Subject media IDs and 1,513 asset URLs.
- Refreshed coverage audit: 1,522 candidate rows, 640 Subjects with individual media, zero media-covered Subjects without facts and 38 fact-bearing Subjects without individual media; the net gap reduction is 14.
- Combined rounds191-708 contain 518 batches, 721 source rows, 2,781 fact records, 335 total media rows, 324 confirmed individual media rows and 333 distinct assets.
- Evidence is stored in `data/local-panda-research/media/audits/identity-card-audit-rounds689-708.json`, `data/local-panda-research/media/audits/identity-card-network-check-rounds689-708.json` and their referenced discovery reports.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-07-31 — Identity-card closure rounds709-728

### Modern identity cards, aliases and source conflicts
- Completed all 20 Commons name-only tasks after two bounded retries: 23 candidate rows were reviewed and none survived as an individual portrait. Tjen Tjen results belonged to Bao Bao, Chapultepec Ying Ying resolved to the Hong Kong namesake, the Tohui result lacked name/date metadata and Ping Ping was keyword noise.
- Retained 12 distinct Pandapia identity-card avatars for Chongqing Ya Ya, Ban Ban, Ya'an Qian Qian, Qian Ran, Qian Yi, Yue Yue, Chengdu Qing Qing, Meng Bao, Meng Yu, Chengdu male Yong Yong, Hong Xi and Shuang Xi.
- Resolved `ya-ya-chongqing` to the studbook-493 identity-card name `Ya Lao Er / 娅老二`; the profile explicitly describes the panda as Chongqing Ya Ya and links the same known offspring.
- Preserved a Qing Qing date conflict: the official Chengdu roster records 2017-07-26 while the specialist profile records 2017-07-22. Mother Er Qiao, female sex, 144-gram birth weight and studbook 1083 identify the same Subject; the official roster date remains canonical.
- Resolved Shuang Xi through Chinese name 双喜, studbook 819 and the studbook-818 Shuang Xin family link despite the profile's romanized display typo.
- Kept eight historic Subjects open where evidence remained pair-only, museum-profile-only, generic same-zoo imagery, wrong-institution namesakes, lineage-only context or lexical noise.
- Generated 20 batches, 20 source rows, 34 fact records, 12 new media rows, eight negative audits and 80 deterministic artifacts.

### Coverage and verification
- Focused rounds709-728 verification — PASS: 8 tests before and after the coverage refresh.
- Full local research suite — PASS: 760/760. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Refreshed index: 1,581 files, 776 Subject IDs, 2,698 normalized name keys, 9,647 record IDs, 8,693 Subject/predicate keys, 1,534 media IDs, 1,306 confirmed-Subject media IDs and 1,525 asset URLs.
- Refreshed coverage audit: 1,534 candidate rows, 652 Subjects with individual media, zero media-covered Subjects without facts and 26 fact-bearing Subjects without individual media; the net gap reduction is 12.
- Combined rounds191-728 contain 538 batches, 741 source rows, 2,815 fact records, 347 total media rows, 336 confirmed individual media rows and 345 distinct assets.
- Evidence is stored in `data/local-panda-research/media/audits/identity-card-audit-rounds709-728.json`, `data/local-panda-research/media/audits/identity-card-network-check-rounds709-728.json` and their referenced discovery reports.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-07-31 — Profile and archive closure rounds729-748

### Studbook profiles, historical archives and alias repair
- Byte-checked 18 candidate Subject images and retained 17 distinct individual portraits. All retained resources have distinct URLs and SHA-256 values, with no existing media collision, shared placeholder or empty-byte asset.
- Rejected Qian Xin's otherwise identity-resolved profile avatar because its bytes are identical to the unrelated Jiu Jiu profile despite a different URL. En En remains open because the reviewed photo story contains only mother-cub and cub-only images.
- Added named profile portraits for Bai Xue, Haizi, Lu Lu, Chengdu Shi Shi, Tang Tang, studbook-444 Xue Xue, Xing Rui, Dong Dong, San Diego Shi Shi, Tohui, Pe Pe, Chapultepec Ying Ying, Paris Li Li and Paris Yen-Yen/Yan Yan.
- Added image-specific Guardian and Observer archive photographs for Chia-Chia, Ching-Ching and Ming at London Zoo.
- Corrected `baichaew-chuangchuang-mother` from a synthetic panda Subject to an `other` source-name alias for Bai Xue, studbook 418. Rebuilt rounds302 and 673 and added a new `same_as` resolution in round731.
- Preserved same-name boundaries: Xue Xue studbook 444 is Lou Sheng's mother rather than the younger studbook-850 panda; Chengdu Shi Shi 467 and San Diego Shi Shi 381 retain separate portraits; Chapultepec Ying Ying 165 remains separate from the Hong Kong namesake.
- Generated 20 batches, 21 source rows, 39 fact records, 17 new media rows, one alias/type correction, two negative audits and 80 deterministic artifacts.

### Coverage and verification
- Focused rounds729-748 verification — PASS: 8 tests before and after the coverage refresh. Affected historical and current suites — PASS: 29/29.
- Full local research suite — PASS: 768/768. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Refreshed index: 1,621 files, 776 Subject IDs, 2,710 normalized name keys, 9,686 record IDs, 8,732 Subject/predicate keys, 1,551 media IDs, 1,323 confirmed-Subject media IDs and 1,542 asset URLs.
- Refreshed coverage audit: 1,551 candidate rows, 669 Subjects with individual media, zero media-covered Subjects without facts and eight fact-bearing Subjects without individual media; 17 media gaps and one synthetic panda gap were removed for a net reduction of 18.
- Combined rounds191-748 contain 558 batches, 762 source rows, 2,854 fact records, 364 total media rows, 353 confirmed individual media rows and 362 distinct assets.
- Evidence is stored in `data/local-panda-research/media/audits/identity-card-audit-rounds729-748.json` and `data/local-panda-research/media/audits/identity-card-network-check-rounds729-748.json`.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-07-31 — Final media gaps and quality rounds749-768

### Remaining gaps, duplicate Subjects and inventory recovery
- Closed six of the eight starting individual-media gaps with distinct profile or archive resources for Ping Ping, Shao Shao, Xen Li, Chang Chang, En En and Shan Shan/A Ling.
- Resolved En En through her studbook-1207 profile and the Yi Ran family card. Resolved Anshan Shan Shan as A Ling, studbook 739.
- Corrected `changning-qinling-2023` and `changqing-evergreen-qinling-2023` to `other` duplicate-source aliases for the canonical round703 and round704 Subjects. Both import and records mirrors were rebuilt.
- Reclassified five Qinling page-hero candidates sharing SHA-256 `d2d3a2f1...fe36e` as unconfirmed `supporting_profile_page` media. Added a distinct official-caption replacement for Xiao Yuan Qi.
- Kept four real media gaps open: Tjen Tjen has pair-only imagery; Qian Xin has a cross-Subject identical avatar; Chang Le and Chang Qing/长庆 have shared hero images and avatars that collide with unrelated Subjects.
- Recovered the Qing Qing and Xiao Xin Chengdu assets using the official panda.org.cn Referer. Inventory improved from 697 present / five pending to 699 present / three pending.
- Confirmed all three remaining ZooNooz/SDZWA Hua Mei archive URLs redirect to migrated paths returning HTTP 404.
- Generated 20 batches, 20 source rows, 29 fact records, seven new media rows and 80 deterministic artifacts.

### Coverage and verification
- Focused rounds749-768 verification — PASS: 8 tests before and after the coverage refresh and after the idempotent rerun.
- Full local research suite — PASS: 776/776. Development acceptance — PASS: `npm run verify:dev -- --scope=research`.
- Refreshed index: 1,661 files, 778 Subject IDs, 2,726 normalized name keys, 9,715 record IDs, 8,761 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit: 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Global confirmed-media hash audit: 566 rows with SHA-256, 566 distinct hashes and zero cross-Subject hash groups.
- Combined rounds191-768 contain 578 batches, 782 source rows, 2,883 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- Evidence is stored in `data/local-panda-research/media/audits/final-media-and-quality-audit-rounds749-768.json` and `data/local-panda-research/media/audits/final-media-and-quality-network-check-rounds749-768.json`.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-07-31 — Direct evidence depth rounds769-788

### Image captions and identity-card snapshots
- Added seven direct Xinhua image-caption snapshots for Bing Zai, Can Can's cub, Feng Yi, Nong Nong, Sen Sen, Shui Xiu and Yuan Xiao. Each public page returned HTTP 200 and directly bound the named Subject to a date, facility and depicted activity.
- Added thirteen direct specialist identity-card snapshots for Ai Le, Ai Mi, Bao Ge, Bao Mei, Bao Quan, Jin Hui, Jin Jin, Jin Yu, Lan Bao, Lin Yang, Lu Lu, Lv Di and Mei Ling.
- Ten of the thirteen identity cards display a studbook number. All thirteen display a birth date and family or timeline context.
- Preserved the authority boundary: Pandapia rows are medium-confidence direct snapshots of what the profile displays, not primary studbook assertions, and cannot supersede conflicting holder records.
- Added no media and changed no media classification. Inventory remains 699 present / three pending.
- Generated 20 batches, 20 source-row declarations, 17 distinct source IDs, 20 direct fact records and 80 deterministic artifacts.

### Coverage and verification
- The seven one-record Subjects improved from one record / one source / one category / score 4 to two direct records / two sources / two categories / score -5.
- The thirteen zero-direct Subjects now each have one direct record and improved from score -1 to score -4.
- Updated five historical new-Subject tests so their prior-data scans stop before their own batch start and do not treat future enrichment rounds as historical predecessors. Production data was not changed by this repair.
- Focused rounds769-788 verification — PASS: 9/9 after the coverage refresh. Affected historical/current suites — PASS: 77/77.
- Full local research suite — PASS: 785/785. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Refreshed index: 1,701 files, 778 Subject IDs, 2,726 normalized name keys, 9,735 record IDs, 8,781 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit: 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-788 contain 598 batches, 802 source-row declarations, 707 distinct source IDs, 2,903 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- Evidence is stored in `data/local-panda-research/media/audits/direct-evidence-audit-rounds769-788.json` and `data/local-panda-research/media/audits/direct-evidence-network-check-rounds769-788.json`.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-07-31 — Direct identity depth rounds789-808

### Specialist identity-card snapshots
- Added twenty direct, medium-confidence identity-card snapshots for Pang Yuan, Qin Chuan, Quan Mei, Rong Sheng, Shan Zai, Sheng Lan, Shu Lan, Su Xing, Ting Zai, Wang Yue, Xiao Jiao, Ya Zhi, Yang Hu, Ye Ye, Yu Chen, Yu Lei, Yuan Lin, Yuan Zhou, Yue Hua and Yue Xuan.
- All twenty public identity pages returned HTTP 200 and displayed a name, birth date and family context. Fourteen displayed a studbook number; six recent individuals did not.
- Preserved the specialist-source boundary: records capture only fields visibly displayed by the page, do not claim primary studbook authority and cannot supersede conflicting holder or official records.
- Preserved the Shan Zai source conflict: profile title `善仔/Shan Zai` and narrative name `带带/Dai Dai` remain unresolved, with no automatic alias merge or canonical-name overwrite.
- Added no media and changed no media classification. Inventory remains 699 present / three pending.
- Generated 20 batches, 20 distinct source IDs, 20 direct fact records and 80 deterministic artifacts.

### Coverage and verification
- All twenty targets improved from zero direct records / score -1 to one direct record / score -4.
- The zero-direct queue now begins with Yun Hui, Yun Wen, Yun Wu, Zhan Wang, Zhao Yang, Zhen Lan, Zhi Yu, Zi Ang, Zi Lu and Zi Shi.
- Updated three historical new-Subject tests so prior-data scans stop before their own batch start and do not treat future enrichment rounds as historical predecessors. Production data was not changed by this repair.
- Focused rounds789-808 verification — PASS: 10/10 after the coverage refresh. Affected historical/current suites — PASS: 49/49.
- Full local research suite — PASS: 795/795. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Refreshed index: 1,741 files, 778 Subject IDs, 2,726 normalized name keys, 9,755 record IDs, 8,801 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit: 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-808 contain 618 batches, 822 source-row declarations, 727 distinct source IDs, 2,923 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- Evidence is stored in `data/local-panda-research/media/audits/direct-identity-audit-rounds789-808.json` and `data/local-panda-research/media/audits/direct-identity-network-check-rounds789-808.json`.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-07-31 — Direct identity depth rounds809-828

### Specialist identity-card snapshots
- Added twenty direct, medium-confidence identity-card snapshots for Yun Hui, Yun Wen, Yun Wu, Zhan Wang, Zhao Yang, Zhen Lan, Zhi Yu/Zi Yu, Zi Ang, Zi Lu, Zi Shi, Ai Bang's 2016 cub, Ai Jiu, Ai Lin, Ai Si, An An's 2022 cub, Ao Ao, Ao Ke, Ao Ran, Bing Cheng and Bing Xue.
- All twenty public identity pages returned HTTP 200 and displayed a name, birth date and family context. Thirteen displayed a studbook number; seven did not.
- Normalized Ai Jiu's timeline form `20200605` to `2020-06-05` only because the same profile narrative explicitly states `2020年6月5日`; no external inference was used.
- Preserved the specialist-source boundary: records capture only fields visibly displayed by the page, do not claim primary studbook authority and cannot supersede conflicting holder or official records.
- Added no media and changed no media classification. Inventory remains 699 present / three pending.
- Generated 20 batches, 20 distinct source IDs, 20 direct fact records and 80 deterministic artifacts.

### Coverage and verification
- Ten five-category targets improved from zero direct records / score -1 to one direct record / score -4.
- Ten six-category targets improved from zero direct records / score -3 to one direct record / score -6.
- The zero-direct queue now begins with Bo Wen, Cai Yun, CC, Cheng Cheng, Cheng Feng, Cheng Lang, Chu Xin, Chun Chun, Chun Hui and Chun Lai.
- Updated three historical new-Subject tests so prior-data scans stop before their own batch start and do not treat future enrichment rounds as historical predecessors. Production data was not changed by this repair.
- Focused rounds809-828 verification — PASS: 10/10 after the coverage refresh. Affected historical/current suites — PASS: 49/49.
- Full local research suite — PASS: 805/805. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Refreshed index: 1,781 files, 778 Subject IDs, 2,726 normalized name keys, 9,775 record IDs, 8,821 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit: 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-828 contain 638 batches, 842 source-row declarations, 747 distinct source IDs, 2,943 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- Evidence is stored in `data/local-panda-research/media/audits/direct-identity-audit-rounds809-828.json` and `data/local-panda-research/media/audits/direct-identity-network-check-rounds809-828.json`.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-07-31 — Direct identity depth rounds829-848

### Specialist identity-card snapshots
- Added twenty direct, medium-confidence identity-card snapshots for Bo Wen, Cai Yun, CC, Cheng Cheng, Cheng Feng, Cheng Lang, Chu Xin, Chun Chun, Chun Hui, Chun Lai, Da Ni, Fu Sheng, Han Han, Hua Ao, Hua Long, Hua Rong, Hua Yan, Ji Fu, Ji Li and Ji You.
- All twenty public identity pages returned HTTP 200 and displayed a name, birth date and family context. Seventeen displayed a studbook number; three did not.
- Captured page-displayed high-value context including the Cheng Feng/Cheng Lang birth times and weights, Cheng Cheng's reproduction summary, Hua Yan's release event, Ji Fu's 270.4-gram birth weight and the Ji Li/Ji You twin parent text.
- Preserved the specialist-source boundary: records capture only fields visibly displayed by the page, do not claim primary studbook authority and cannot supersede conflicting holder or official records.
- Added no media and changed no media classification. Inventory remains 699 present / three pending.
- Generated 20 batches, 20 distinct source IDs, 20 direct fact records and 80 deterministic artifacts.

### Coverage and verification
- All twenty six-category targets improved from zero direct records / score -3 to one direct record / score -6.
- The zero-direct queue now begins with Jiao Xiao, Jiao Yang, Jin Baobao, Jin Rui, Ling Zhu, Liu Yi, Long Gu, Lun Wen, Lun Wu and Ni Ni.
- Focused rounds829-848 verification — PASS: 11/11 after the coverage refresh.
- Full local research suite — PASS: 816/816. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Refreshed index: 1,821 files, 778 Subject IDs, 2,726 normalized name keys, 9,795 record IDs, 8,841 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit: 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-848 contain 658 batches, 862 source-row declarations, 767 distinct source IDs, 2,963 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- Evidence is stored in `data/local-panda-research/media/audits/direct-identity-audit-rounds829-848.json` and `data/local-panda-research/media/audits/direct-identity-network-check-rounds829-848.json`.
- A transient workspace-connector HTTP 502 interrupted the first verification attempt; validation resumed from the already-written deterministic artifacts after connectivity recovered.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-07-31 — Direct identity depth rounds849-868

### Specialist identity-card snapshots
- Added twenty direct, medium-confidence identity-card snapshots for Jiao Xiao, Jiao Yang, Jin Baobao, Jin Rui, Ling Zhu, Liu Yi, Long Gu, Lun Wen, Lun Wu, Ni Ni, 99, Ning Ning, Qi Qiao, Qing Chong Yang, Qing Zai, Qing Zhu Yu, Ru Ru, Run Jiu, Run Ze and Sa Er.
- All twenty public identity pages returned HTTP 200. Nineteen displayed a studbook number; Ling Zhu did not.
- Preserved source precision: Long Gu's page displays birth year 1990 only, so no month or day was inferred. Qing Chong Yang's 2020-10-25 date was normalized only from an explicit date in the same page narrative.
- Preserved two unresolved name conflicts: Liu Yi/六一 versus narrative name Cheng Xiao/成小, and Subject label 奇巧 versus profile name 七巧.
- Captured page-displayed high-value context including Long Gu's reproduction summary, Ni Ni/Ying Ying ordered birth weights, Run Jiu's nine-stitch treatment and Sa Er's triplet outcome.
- Added no media and changed no media classification. Inventory remains 699 present / three pending.
- Generated 20 batches, 20 distinct source IDs, 20 direct fact records and 80 deterministic artifacts.

### Coverage and verification
- All twenty six-category targets improved from zero direct records / score -3 to one direct record / score -6.
- The zero-direct queue now begins with Shan Hu, Shen Shen, Shu Hui, Shuang Hao, Su Lin's 2019 Cub A, Su Yang, Ting Ting, Wei Wei, Xiao Ni and Xiao Qiao.
- Focused rounds849-868 verification — PASS: 11/11 after the coverage refresh.
- Full local research suite — PASS: 827/827. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Refreshed index: 1,861 files, 778 Subject IDs, 2,726 normalized name keys, 9,815 record IDs, 8,861 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit: 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-868 contain 678 batches, 882 source-row declarations, 787 distinct source IDs, 2,983 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- Evidence is stored in `data/local-panda-research/media/audits/direct-identity-audit-rounds849-868.json` and `data/local-panda-research/media/audits/direct-identity-network-check-rounds849-868.json`.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-07-31 — Direct identity depth rounds869-888

### Specialist identity-card snapshots
- Added twenty direct, medium-confidence identity-card snapshots for Shan Hu, Shen Shen, Shu Hui, Shuang Hao, Su Lin's 2019 Cub A, Su Yang, Ting Ting, Wei Wei, Xiao Ni, Xiao Qiao, Xiao Shuang, Xiao Ya, Xin Yue, Xing An, Xing Fan, Xing Qing, Xing Yu, Xing Yuan, Xing Yun and Xiu Xiu.
- All twenty public identity pages returned HTTP 200 and displayed day-precision birth dates. Seventeen displayed a studbook number; Shu Hui, Su Lin's 2019 Cub A and Xing Qing did not.
- Preserved page attribution for Shan Hu's user-contributed father, sex and 2018 illness/death details.
- Preserved two unresolved source conflicts: Ting Ting and Wei Wei's pages each call the other the younger sibling, and Xiu Xiu's narrative death timing conflicts with the page timeline.
- Normalized Wei Wei's undelimited timeline date `20211027` to `2021-10-27` using only the same-page date form.
- Captured page-displayed high-value context including Shen Shen's ordered twin birth details, Shuang Hao's blood donation, Xiao Ya/Xiao Chuan birth weights, Xing An's nickname and Xing Yun's birthplace milestone.
- Added no media and changed no media classification. Inventory remains 699 present / three pending.
- Generated 20 batches, 20 distinct source IDs, 20 direct fact records and 80 deterministic artifacts.

### Coverage and verification
- All twenty six-category targets improved from zero direct records / score -3 to one direct record / score -6.
- The zero-direct queue now begins with Ya Er, Ya Song, Ya Wen, Ya Yi, Yin Ke, Ying Xue, You Bang, Yuan Run, Yuan Yuan and Yun Yun.
- Focused rounds869-888 verification — PASS: 11/11 after the final coverage refresh.
- Full local research suite — PASS: 838/838. Development acceptance — PASS: `npm run verify:dev -- --scope research` after the timestamp-corrected rebuild.
- Refreshed index: 1,901 files, 778 Subject IDs, 2,726 normalized name keys, 9,835 record IDs, 8,881 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit: 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-888 contain 698 batches, 902 source-row declarations, 807 distinct source IDs, 3,003 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- Evidence is stored in `data/local-panda-research/media/audits/direct-identity-audit-rounds869-888.json` and `data/local-panda-research/media/audits/direct-identity-network-check-rounds869-888.json`.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-07-31 — Direct identity depth rounds889-908

### Specialist identity-card snapshots
- Added twenty direct, medium-confidence identity-card snapshots for Ya Er, Ya Song, Ya Wen, Ya Yi, Yin Ke, Ying Xue, You Bang, Yuan Run, Yuan Yuan, Yun Yun, Zheng Zai, Zhi Ma, Zhu Hai, Zhu Ling, Zhuang Mei, Zi Lin, Zi Su, Si Jun Jun, Si Nian and A Ling.
- All twenty public identity pages returned HTTP 200 and displayed day-precision birth dates. Nineteen displayed a studbook number; Ya Wen did not.
- Preserved two source variances: Zhuang Mei's profile displays 2008-07-26 while Ning Ning's profile displays 2008-07-27, and the Si Jun Jun Subject label differs from the profile romanization Si Yun Yun.
- Captured page-displayed high-value context including Ying Xue's release, Yuan Yuan's four-litter/six-cub summary, Zhi Ma's 2017 twin milestone, the Zi Su/Zi Lin cross-midnight dates and lower-bound birth weights, and the Si Nian/Si Jun Jun birth weights.
- Added no media and changed no media classification. Inventory remains 699 present / three pending.
- Generated 20 batches, 20 distinct source IDs, 20 direct fact records and 80 deterministic artifacts.

### Coverage and verification
- Seventeen six-category targets improved from zero direct records / score -3 to one direct record / score -6.
- Si Jun Jun and Si Nian improved from zero direct records / score -3 to one direct record / score -8 as the identity snapshot also added a fifth category.
- A Ling improved from zero direct records / score -5 to one direct record / score -8.
- Ninety-four media-covered Subjects still have zero direct records. The overall ranked queue now begins with Ai Le, Ai Mi, Bao Ge, Bao Mei, Bao Quan, Jin Hui, Jin Jin, Jin Yu, Lan Bao and Lin Yang because their score -4 ranks ahead of the remaining zero-direct seven-category Subjects at score -5.
- Focused rounds889-908 verification — PASS: 11/11 after the final coverage refresh.
- Full local research suite — PASS: 849/849. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Refreshed index: 1,941 files, 778 Subject IDs, 2,726 normalized name keys, 9,855 record IDs, 8,901 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit: 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-908 contain 718 batches, 922 source-row declarations, 827 distinct source IDs, 3,023 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- Evidence is stored in `data/local-panda-research/media/audits/direct-identity-audit-rounds889-908.json` and `data/local-panda-research/media/audits/direct-identity-network-check-rounds889-908.json`.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-07-31 — Direct source diversity rounds909-928

### Independent second-source enrichment
- Added twenty non-Pandapia direct records for Ai Le, Ai Mi, Bao Ge, Bao Mei, Bao Quan, Jin Hui, Jin Jin, Jin Yu, Lan Bao, Lin Yang, Lu Lu, Lv Di, Mei Ling, Pang Yuan, Qin Chuan, Quan Mei, Rong Sheng, Shan Zai, Sheng Lan and Shu Lan.
- Generated exactly 20 batches, 20 source-row declarations, 19 distinct source IDs, 20 direct fact records and 80 deterministic artifacts. Bao Ge and Bao Mei intentionally share one Xinhua report that separately distinguishes the two cubs by birth order, sex, birth time and weight.
- Recorded 14 high-confidence and six medium-confidence records. High-confidence rows use government, state-media, holder-linked or historical primary reporting; medium-confidence rows preserve republication, independent specialist, sponsor-announcement or retrospective-feature boundaries instead of overstating authority.
- Evidence themes cover behaviour, breeding, care, medical treatment, migration, public activity, aliases/naming and kinship. Notable direct evidence includes Xinhua image-specific identifiers for Lu Lu and Shan Zai, the Lanzhou Morning Post account of Lan Bao's birth and treatment return, and the People's Daily historical report that Jin Jin delivered twins.
- Added no media, accepted no replacement media candidate and changed no media classification. The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-source-diversity-audit-rounds909-928.json`.

### Coverage, regression repair and verification
- All twenty targets improved from one direct record and one source family to two direct records and two independent source families; zero remain single-source-only.
- Fifteen targets added a new record category and improved from score -4 to -13. Jin Hui, Lin Yang, Pang Yuan, Qin Chuan and Quan Mei retained their category count and improved from score -4 to -11.
- Updated the rounds769-788 and rounds789-808 historical coverage tests so they verify that the original direct-evidence gain remains present without treating later legitimate enrichment as a regression. Related current and historical verification passed 30/30.
- Focused rounds909-928 verification — PASS: 11/11 before and after the deterministic rerun.
- Full local research suite — PASS: 860/860. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 1,981 files, 778 Subject IDs, 2,726 normalized name keys, 9,875 record IDs, 8,921 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media. Ninety-four media-covered Subjects still have zero direct records.
- Combined rounds191-928 contain 738 batches, 942 source-row declarations, 846 distinct source IDs, 3,043 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-07-31 — Direct source diversity rounds929-948

### Independent second-source enrichment
- Added twenty non-Pandapia direct records for Su Xing, Ting Zai, Wang Yue, Xiao Jiao, Ya Zhi, Yang Hu, Ye Ye, Yu Chen, Yu Lei, Yuan Lin, Yuan Zhou, Yue Hua, Yue Xuan, Yun Hui, Yun Wen, Yun Wu, Zhan Wang, Zhao Yang, Zhen Lan and Zhi Yu/Zi Yu.
- Generated exactly 20 batches, 20 source-row declarations, 20 distinct source IDs, 16 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Shared pages retain separate identity rows for the 2025 birth-table Subjects and separate enclosure observations for Yun Wen and Yun Wu.
- Recorded eight high-confidence and twelve medium-confidence records. High-confidence rows use state, regional-state or mainstream reporting; medium-confidence rows preserve independent specialist registry, field-observation and specialist-media boundaries.
- Evidence categories cover birth, public activity, migration, behaviour, breeding, care and medical history. Notable additions include Ting Zai's first public appearance, Ye Ye's 2010 cub birth and maternal outcome, Yun Hui's pathological diagnosis, Zhan Wang's successful natural mating, Zhao Yang's behaviour profile and current exhibit observations for the Yun twins.
- Added no media, accepted no replacement media candidate and changed no media classification. The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-source-diversity-audit-rounds929-948.json`.

### Coverage, regression repair and verification
- All twenty targets improved from one direct record and one source family to two direct records and two independent source families; zero remain single-source-only.
- Fourteen targets added a new record category and improved from score -4 to -13. Wang Yue, Ya Zhi, Yang Hu, Yu Chen, Yue Hua and Yue Xuan retained their existing birth category and improved from score -4 to -11.
- Updated the rounds809-828 historical coverage test so it verifies that the original direct-evidence gain remains present without treating later legitimate enrichment as a regression. Related current and historical verification passed 21/21.
- Focused rounds929-948 verification — PASS: 11/11 before and after the deterministic rerun.
- Full local research suite — PASS: 871/871. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 2,021 files, 778 Subject IDs, 2,726 normalized name keys, 9,895 record IDs, 8,941 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media. Ninety-four media-covered Subjects still have zero direct records.
- Combined rounds191-948 contain 758 batches, 962 source-row declarations, 866 distinct source IDs, 3,063 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Final score-minus-four closure rounds949-952

### Final independent-source closure
- Added four non-Pandapia direct records for Zi Ang, Zi Lu, Zi Shi and the early Chengdu maternal-line Qing Qing Subject.
- Generated exactly four batches, four source-row declarations, four distinct source IDs, three distinct reviewed URLs, four direct fact records and 16 deterministic artifacts. Zi Ang and Zi Shi intentionally share one annual birth table that lists the twins in separate named rows.
- Recorded one high-confidence holder-history record and three medium-confidence specialist or specialist-media records. The Qing Qing record preserves the Chengdu base account of alternating maternal nursing and incubator care for Ya Ya and Xiang Xiang; the other records preserve independent-source limits rather than overstating registry authority.
- Evidence categories cover birth, breeding and care. Zi Lu is directly named in Ya Yun's two-litter, two-cub reproductive summary; Zi Ang and Zi Shi are separately bound to their 2023 birth rows.
- Added no media, accepted no replacement media candidate and changed no media classification. The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-source-diversity-audit-rounds949-952.json`.

### Coverage and verification
- All four targets now have two direct records. Zi Ang, Zi Lu and Zi Shi now have two independent source families; Qing Qing now has three source families.
- Zi Ang and Zi Shi improved from score -4 to -11, Zi Lu improved from -4 to -13, and Qing Qing improved from -4 to -9. No score-minus-four rows remain in the ranked coverage report.
- Focused rounds949-952 verification — PASS: 10/10 before and after the deterministic rerun.
- Full local research suite — PASS: 881/881. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 2,029 files, 778 Subject IDs, 2,726 normalized name keys, 9,899 record IDs, 8,945 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media. Ninety-four media-covered Subjects still have zero direct records.
- Combined rounds191-952 contain 762 batches, 966 source-row declarations, 870 distinct source IDs, 3,067 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next zero-direct queue begins with Ai Bang, Ba Xi, Bing Dian, Chao Chao, Cheng Da, Cheng Dui, Cheng Ji, Cheng Jiu, Cheng Lan and Cheng Shi, all at score -5.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Zero-direct closure rounds953-972

### First media-covered zero-direct slice
- Added twenty non-Pandapia direct records for Ai Bang, Ba Xi, Bing Dian, Chao Chao, Cheng Da, Cheng Dui, Cheng Ji, Cheng Jiu, Cheng Lan, Cheng Shi, Chun Sheng, Da Mei, Guai Guai, Hao Jing, Hao Yu, Hao Yue, He Mei, He Qi, He Sheng and He Yu.
- Generated exactly 20 batches, 20 source-row declarations, 14 distinct source IDs, 14 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Shared annual tables, family features, holder summaries and conservation reviews retain separate named rows or event bindings for each Subject.
- Recorded three high-confidence state-media or holder records and seventeen medium-confidence specialist records. High-confidence evidence covers Ba Xi's pre-release examination and the separately identified Cheng Lan and Da Mei birth records; all specialist sources retain explicit authority limits.
- Evidence categories cover birth, behaviour, breeding, medical review, migration, relationship, release and training. Notable additions include Ai Bang's 2017 twin litter, Bing Dian's institutional history, Cheng Ji's grooming and bathing behaviour, He Sheng's release outcome and He Yu's staged reintroduction training.
- Added no media, accepted no replacement media candidate and changed no media classification. The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds953-972.json`.

### Coverage, regression repair and verification
- All twenty targets improved from zero direct records and one source family to one direct record and two source families; zero remain single-source-only.
- Six targets added a new category and improved from score -5 to -14: Ai Bang, Ba Xi, Bing Dian, Cheng Ji, He Sheng and He Yu. The other fourteen improved from -5 to -12.
- The media-covered zero-direct queue decreased from 94 Subjects to 74. The queue now begins with Ji Ran, Ji Xiao, Jiao Ao, Jiao Yi, Jiao Zi, Jin Shuang, Jun Zu, Ke Nian, Lang Lang and Liu Liu.
- Updated four historical coverage tests from an exact zero-direct count of 94 to a non-regression upper bound, allowing legitimate later closures while preserving the original milestone. Related verification passed 54/54.
- Focused rounds953-972 verification — PASS: 11/11 before and after the deterministic rerun.
- Full local research suite — PASS: 892/892. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 2,069 files, 778 Subject IDs, 2,726 normalized name keys, 9,919 record IDs, 8,965 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-972 contain 782 batches, 986 source-row declarations, 884 distinct source IDs, 3,087 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Zero-direct closure rounds973-992

### Second media-covered zero-direct slice
- Added twenty non-Pandapia direct records for Ji Ran, Ji Xiao, Jiao Ao, Jiao Yi, Jiao Zi, Jin Shuang, Jun Zu, Ke Nian, Lang Lang, Liu Liu, Lun Hui, Mei Mei, Nan Xiao Yue, Ni Hao, Ni Ke, Ni Na, Nuo Mi, Qing Qing, Run Yue and Shun Shun.
- Generated exactly 20 batches, 20 source-row declarations, 14 distinct source IDs, 14 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Four shared-page declarations retain separate named annual-table rows or separate maternal event bindings.
- Recorded five high-confidence state-media, mainstream or historical state-press records and fifteen medium-confidence specialist records. High-confidence evidence covers Jiao Zi's civic role, Jun Zu's 2017 birth event, Lang Lang's medical outcome, Mei Mei's historical breeding milestone and Qing Qing's documented Shaanxi location.
- Evidence categories cover birth, breeding, public activity, medical history, historical milestone and migration. Notable additions include Jin Shuang's alias and 2025 observation, Nan Xiao Yue's 2025 female twins, Nuo Mi's son Yu Chen and Mei Mei's nine-litter historical summary.
- Added no media, accepted no replacement media candidate and changed no media classification. The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds973-992.json`.

### Coverage, regression repair and verification
- All twenty targets improved from zero direct records and one source family to one direct record and two source families; zero remain single-source-only.
- Eight targets added a new category and improved from score -5 to -14: Jiao Zi, Jin Shuang, Jun Zu, Lang Lang, Mei Mei, Nan Xiao Yue, Nuo Mi and Qing Qing. The other twelve improved from -5 to -12.
- The media-covered zero-direct queue decreased from 74 Subjects to 54. The next queue begins with Wu Jun, Wu Wen's 2024 Cub B, Xiang Guo, Xiao Chuan, Xiao He Tao, Xing Mei, Xing Yi, Xiu Yang, Ya Ao and Ya Jun.
- Updated the rounds953-972 historical coverage test from an exact zero-direct count of 74 to a non-regression upper bound. Related verification passed 22/22.
- Focused rounds973-992 verification — PASS: 11/11 before and after the deterministic rerun.
- Full local research suite — PASS: 903/903. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 2,109 files, 778 Subject IDs, 2,726 normalized name keys, 9,939 record IDs, 8,985 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-992 contain 802 batches, 1,006 source-row declarations, 898 distinct source IDs, 3,107 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Zero-direct closure rounds993-1012

### Third media-covered zero-direct slice
- Added twenty non-Pandapia direct records for Wu Jun, Wu Wen's 2024 Cub B, Xiang Guo, Xiao Chuan, Xiao He Tao, Xing Mei, Xing Yi, Xiu Yang, Ya Ao, Ya Jun, Yang Hua, Yuan Yue, Zhi Hua, Zhi Shi, Zhi Shu, Du Du, Hai Hai, Lan Zai, Lao Lao and Mei Zhu.
- Generated exactly 20 batches, 20 source-row declarations, 18 distinct source IDs, 18 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Two shared annual-table pages retain separate named rows for Xiao Chuan/Ya Jun and Zhi Hua/Zhi Shu.
- Recorded six high-confidence government, Xinhua, CCTV/iPanda or holder-notice-based records and fourteen medium-confidence specialist records. The unnamed Wu Wen cub remains bounded to litter order, relative size, timing and neonatal outcome without inferring sex or an official name.
- Evidence categories cover birth, behaviour, death, health, medical history, public activity and release. Notable additions include Xiao He Tao's 2018 release, Ya Ao's medical timeline, Du Du's holder-reported health, Lan Zai's behaviour profile and Mei Zhu's public conservation-education role.
- Added no media, accepted no replacement media candidate and changed no media classification. The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds993-1012.json`.

### Coverage, regression repair and verification
- All twenty targets now have one direct record. The first fifteen improved from one to two source families; the five shallow Subjects improved from two to three source families. Zero remain single-source-only.
- The first fifteen targets improved from score -5 to -12. Du Du, Hai Hai, Lan Zai, Lao Lao and Mei Zhu added a sixth category and improved from -5 to -10.
- The media-covered zero-direct queue decreased from 54 Subjects to 34. The next queue begins with Wen Hui, Gong Zai, Hui Hui, Ke Yu, Nao Nao, Shuang Er, Shuang Qing, Shuang Xiong, Wen Wen and Wen Xi.
- Updated the rounds973-992 historical coverage test from an exact zero-direct count of 54 to a non-regression upper bound. Related verification passed 22/22.
- Focused rounds993-1012 verification — PASS: 11/11 before and after the deterministic rerun.
- Full local research suite — PASS: 914/914. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 2,149 files, 778 Subject IDs, 2,726 normalized name keys, 9,959 record IDs, 9,005 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1012 contain 822 batches, 1,026 source-row declarations, 916 distinct source IDs, 3,127 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Zero-direct closure rounds1013-1032

### Fourth media-covered zero-direct slice
- Added twenty non-Pandapia direct records for Wen Hui, Gong Zai, Hui Hui, Ke Yu, Nao Nao, Shuang Er, Shuang Qing, Shuang Xiong, Wen Wen, Wen Xi, Xian Xian, Xiang Bing, Xiao Bao, Xing Chen, Xing Guang, Ya Yun, Ya Zhu, Zhi Zhi and An An's two 2023 Qinling cubs.
- Generated exactly 20 batches, 20 source-row declarations, 10 distinct source IDs, 10 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Five shared-page declarations retain separate named annual-table rows or separately captioned older/younger cub identities.
- Recorded three high-confidence government or holder-government records and seventeen medium-confidence specialist records. The two An An cub records preserve the mixed-sex litter statement without assigning either sex to an individual cub; the Xiang Bing record does not infer the identity or maternity of the accompanying young panda.
- Evidence categories cover birth, health, public activity and wild training. Notable additions include Hui Hui's documented survival within the 2005 litter, Xian Xian's second-stage wild training and Xiang Bing's bounded March 2024 field observation.
- Added no media, accepted no replacement media candidate and changed no media classification. The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1013-1032.json`.

### Coverage, regression repair and verification
- All twenty targets now have one direct record and zero remain single-source-only. Seventeen targets now have two source families; Wen Hui and the two An An cubs now have three source families.
- Fourteen targets improved to score -14. Hui Hui, Xian Xian and Xiang Bing added a ninth category and improved to -16. Wen Hui and the two An An cubs improved to -10.
- The media-covered zero-direct queue decreased from 34 Subjects to 14. The remaining queue is Hua Li, Jing Bao, Jiu Jiu, Li Dui, Miao Yin, Xing Ya, He He, Qi Xi, Run Yang, Xiang Shan, Bing Bing, Guo Guo, Huan Cai and Su Su.
- Updated the rounds993-1012 historical coverage test from an exact zero-direct count of 34 to a non-regression upper bound. Related verification passed 22/22.
- Focused rounds1013-1032 verification — PASS: 11/11 before and after the deterministic rerun.
- Full local research suite — PASS: 925/925. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 2,189 files, 778 Subject IDs, 2,726 normalized name keys, 9,979 record IDs, 9,025 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1032 contain 842 batches, 1,046 source-row declarations, 926 distinct source IDs, 3,147 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Final zero-direct closure rounds1033-1046

### Final media-covered zero-direct slice
- Added fourteen non-Pandapia direct records for Hua Li, Jing Bao, Jiu Jiu, Li Dui, Miao Yin, Xing Ya, He He, Qi Xi, Run Yang, Xiang Shan, Bing Bing, Guo Guo, Huan Cai and Su Su.
- Generated exactly 14 batches, 14 source-row declarations, 11 distinct source IDs, 11 distinct reviewed URLs, 14 direct fact records and 56 deterministic artifacts. Three shared-page declarations retain separate named annual-table rows.
- Recorded two high-confidence China News Service or CCTV institutional records and twelve medium-confidence specialist records. High-confidence evidence covers Guo Guo's role in Chengdu's six-panda founding cohort and Su Su's rescue, reproductive and death history.
- Evidence categories cover birth, death, founding milestone, reintroduction programme participation and reproduction. Notable additions include Xing Ya's first-six reintroduction role and Bing Bing's 2007 delivery of Xiang Bing.
- The 2015 Ge Ge daughter Jiu Jiu (九九) is explicitly separated from the 2018 Hua Mei daughter Jiu Jiu (玖玖). The conflicting existing media-profile binding is flagged for later media-identity review but was not automatically reclassified in this batch. The Ge Ge daughter He He is likewise separated from two same-romanization male pandas.
- Added no media, accepted no replacement media candidate and changed no media classification. The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1033-1046.json`.

### Coverage, regression repair and verification
- All fourteen targets now have one direct record and zero remain single-source-only.
- Seven targets improved to score -12; Qi Xi, Run Yang and Xiang Shan improved to -16; Huan Cai and Su Su improved to -18; Bing Bing improved to -14; Guo Guo improved to -20.
- The media-covered zero-direct queue decreased from 14 Subjects to zero, completing the first-direct closure phase.
- Updated the rounds1013-1032 historical coverage test from an exact zero-direct count of 14 to a non-regression upper bound. Corrected the rounds549-568 historical-presence helper to inspect only imports before round549, preventing later enrichment records from being mistaken for pre-existing Subjects. Related verification passed 34/34.
- Focused rounds1033-1046 verification — PASS: 11/11 before and after the deterministic rerun.
- Full local research suite — PASS: 936/936. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 2,217 files, 778 Subject IDs, 2,726 normalized name keys, 9,993 record IDs, 9,039 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1046 contain 856 batches, 1,060 source-row declarations, 937 distinct source IDs, 3,161 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next research queue is category-depth and source-diversity enrichment, beginning with Bing Zai, Can Can's cub, Feng Yi, Nong Nong, Sen Sen, Shui Xiu and Yuan Xiao, followed by single-source six-category Subjects.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Category depth and source diversity rounds1047-1066

### First depth-and-diversity slice
- Added twenty non-Pandapia direct records for Bing Zai, Can Can's cub, Feng Yi, Nong Nong, Sen Sen, Shui Xiu, Yuan Xiao, Ai Bang's 2016 cub, Ai Jiu, Ai Lin, Ai Si, An An's 2022 cub, Ao Ao, Ao Ke, Ao Ran, Bing Cheng, Bing Xue, Bo Wen, Cai Yun and CC.
- Generated exactly 20 batches, 20 source-row declarations, 14 distinct source IDs, 14 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Three shared-page declarations retain separate captions or annual-table rows.
- The batch contains seven category-depth records, eleven source-diversity records and two records that improve both dimensions. Six government, mainstream or CCTV/iPanda records are high confidence; fourteen specialist records remain medium confidence.
- Evidence categories cover birth, death, feeding, location, name, relationship and reproduction. Notable additions include Nong Nong's documented nickname, Sen Sen's prepared-food feeding, Shui Xiu's 2016 semi-wild-enclosure birth and Cai Yun's three named offspring.
- Can Can's cub remains unnamed and sex-unresolved. Ai Bang's 2016 cub retains its bounded local identifier while “Ai Liu / 爱六” is stored only as a source-specific form. An An's 2022 cub remains unnamed in the independent source.
- An initial Bing Cheng transfer assertion was rejected during source verification because the reviewed page did not directly state the move. The final record uses the independently supported 2014 birth row instead.
- Added no media, accepted no replacement media candidate and changed no media classification. The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1047-1066.json`.

### Coverage, regression repair and verification
- The seven category-poor targets now each have three direct records, three source families and three categories, improving from score -5 to -10.
- Eleven single-source six-category targets now have two direct records and two source families, improving from score -6 to -13.
- Ao Ao and Cai Yun additionally gained a seventh category and improved from score -6 to -15. All twenty targets are now multi-source; the media-covered zero-direct count remains zero.
- Updated the rounds769-788 caption coverage assertions from exact counts to non-regression lower bounds. Updated rounds829-848 identity coverage assertions to allow later direct enrichment and lower scores. Related verification passed 31/31.
- Focused rounds1047-1066 verification — PASS: 11/11 before and after the deterministic rerun.
- Full local research suite — PASS: 947/947. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 2,257 files, 778 Subject IDs, 2,726 normalized name keys, 10,013 record IDs, 9,059 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1066 contain 876 batches, 1,080 source-row declarations, 951 distinct source IDs, 3,181 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Cheng Cheng, Cheng Feng, Cheng Lang, Chu Xin, Chun Chun, Chun Hui, Chun Lai, Da Ni, Fu Sheng and Han Han; each currently has one direct record, one source family and six categories.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Category depth and source diversity rounds1067-1086

### Second depth-and-diversity slice
- Added twenty non-Pandapia direct records for Cheng Cheng, Cheng Feng, Cheng Lang, Chu Xin, Chun Chun, Chun Hui, Chun Lai, Da Ni, Fu Sheng, Han Han, Hua Ao, Hua Long, Hua Rong, Hua Yan, Ji Fu, Ji Li, Ji You, Jiao Xiao, Jiao Yang and Jin Bao Bao.
- Generated exactly 20 batches, 20 source-row declarations, 15 distinct source IDs, 15 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Three shared-page declarations retain separate annual-table rows.
- Nineteen records improve source diversity and one record improves both source diversity and category depth. Hua Yan's China News Service pre-release examination record is high confidence; nineteen specialist records remain medium confidence.
- Evidence categories contain nineteen birth records and one medical record. Hua Yan gained direct pre-release measurements, normal physiological findings, identity-chip implantation and GPS/radio collar fitting.
- Ji Fu's annual-table date of 2022-08-05 conflicts by one day with the existing profile date of 2022-08-06; both source assertions remain visible and unresolved. Jiao Xiao's cross-date litter context with Da Jiao is retained without rewriting either recorded date.
- Added no media, accepted no replacement media candidate and changed no media classification. The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1067-1086.json`.

### Coverage, regression repair and verification
- All twenty targets now have two direct records and two source families; zero remain single-source-only.
- Nineteen targets retained six categories and improved from score -6 to -13. Hua Yan gained a seventh category and improved from score -6 to -15. The media-covered zero-direct count remains zero.
- Updated the rounds849-868 identity coverage assertions to allow later direct enrichment and lower coverage scores. Related verification passed 22/22.
- Focused rounds1067-1086 verification — PASS: 11/11 before and after the deterministic rerun.
- Full local research suite — PASS: 958/958. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 2,297 files, 778 Subject IDs, 2,726 normalized name keys, 10,033 record IDs, 9,079 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1086 contain 896 batches, 1,100 source-row declarations, 966 distinct source IDs, 3,201 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Jin Rui, Ling Zhu, Liu Yi, Long Gu, Lun Wen, Lun Wu, Ni Ni, 99, Ning Ning and Qi Qiao; each currently has one direct record, one source family and six categories.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Category depth and source diversity rounds1087-1106

### Third depth-and-diversity slice
- Added twenty non-Pandapia direct records for Jin Rui, Ling Zhu, Liu Yi, Long Gu, Lun Wen, Lun Wu, Ni Ni, 99, Ning Ning, Qi Qiao, Qing Chong Yang, Qing Zai, Qing Zhu Yu, Ru Ru, Run Jiu, Run Ze, Sa Er, Shan Hu, Shen Shen and Shu Hui.
- Generated exactly 20 batches, 20 source-row declarations, 14 distinct source IDs, 14 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Three shared-page declarations retain separate annual-table rows.
- Eighteen records improve source diversity and two records improve both source diversity and category depth. Ling Zhu's Xinhua maternal-birth-event record is high confidence; nineteen specialist records remain medium confidence.
- Evidence categories contain eighteen birth records and two death records. Long Gu and Shen Shen gained new death categories while preserving date and precision boundaries.
- Ling Zhu's Xinhua report predates the later name and sex determination; the record binds only the unique exact maternal birth event. Liu Yi and Ning Ning retain unresolved individual date assignment where shared table formatting does not justify stronger precision.
- Qi Qiao's anomalous annual-table parenthetical “毛妹” is stored as an apparent error and is not adopted as a canonical name. Long Gu's 2010-07-23 specialist death date conflicts by one day with the existing 2010-07-22 assertion and remains unresolved. Shen Shen's source supports only death within weeks, not a precise date.
- Added no media, accepted no replacement media candidate and changed no media classification. The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1087-1106.json`.

### Coverage, regression repair and verification
- All twenty targets now have two direct records and two source families; zero remain single-source-only.
- Eighteen targets retained six categories and improved from score -6 to -13. Long Gu and Shen Shen gained a seventh category and improved from score -6 to -15. The media-covered zero-direct count remains zero.
- Updated the rounds869-888 identity coverage assertions to allow later direct enrichment and lower coverage scores. Related verification passed 22/22.
- Focused rounds1087-1106 verification — PASS: 11/11 before and after the deterministic rerun.
- Full local research suite — PASS: 969/969. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 2,337 files, 778 Subject IDs, 2,726 normalized name keys, 10,053 record IDs, 9,099 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1106 contain 916 batches, 1,120 source-row declarations, 980 distinct source IDs, 3,221 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Shuang Hao, Su Lin's 2019 Cub A, Su Yang, Ting Ting, Wei Wei, Xiao Ni, Xiao Qiao, Xiao Shuang, Xiao Ya and Xin Yue; each currently has one direct record, one source family and six categories.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Category depth and source diversity rounds1107-1126

### Fourth depth-and-diversity slice
- Added twenty non-Pandapia direct records for Shuang Hao, Su Lin's 2019 Cub A, Su Yang, Ting Ting, Wei Wei, Xiao Ni, Xiao Qiao, Xiao Shuang, Xiao Ya, Xin Yue, Xing An, Xing Fan, Xing Qing, Xing Yu, Xing Yuan, Xing Yun, Xiu Xiu, Ya Er, Ya Song and Ya Wen.
- Generated exactly 20 batches, 20 source-row declarations, 14 distinct source IDs, 14 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Four shared-page declarations retain separate named or maternal rows.
- All twenty records improve source diversity and remain medium confidence. All use the birth category; no category count changes were introduced.
- Final remote verification corrected Xin Yue's Panda News path to the canonical no-extension URL and replaced the unverified Xiu Xiu profile path with a directly reviewed Panda.fr field history that names Bai Xue's 1999 female cub Xiu Xiu and male cub Qing Qing.
- Su Lin's unnamed 2019 older cub is marked male in the independent annual table but female in the existing profile assertion. Both source claims remain visible and unresolved, and the bounded descriptive Subject was not replaced.
- Ting Ting and Wei Wei retain unresolved birth order. The Chengdu mother romanized as Ya Xing for Xing Fan, Xing Yu and Xing Yuan remains locally resolved as 娅星 and is not merged with 雅星. Ya Er's female mother 星雅 remains separate from the existing male Subject xing-ya.
- Added no media, accepted no replacement media candidate and changed no media classification. The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1107-1126.json`.

### Coverage, regression repair and verification
- All twenty targets now have two direct records and two source families; zero remain single-source-only.
- All twenty retained six categories and improved from score -6 to -13. The media-covered zero-direct count remains zero.
- Updated the rounds889-908 identity coverage assertions to allow later direct enrichment and lower coverage scores. Related verification passed 22/22.
- Focused rounds1107-1126 verification — PASS: 11/11 before and after the deterministic rerun.
- Full local research suite — PASS: 980/980. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 2,377 files, 778 Subject IDs, 2,726 normalized name keys, 10,073 record IDs, 9,119 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1126 contain 936 batches, 1,140 source-row declarations, 994 distinct source IDs, 3,241 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Ya Yi, Yin Ke, Ying Xue, You Bang, Yuan Run, Yuan Yuan, Yun Yun, Zheng Zai, Zhi Ma and Zhu Hai; each currently has one direct record, one source family and six categories.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Category depth and source diversity rounds1127-1146

### Fifth depth-and-diversity slice
- Added twenty non-Pandapia direct records for Ya Yi, Yin Ke, Ying Xue, You Bang, Yuan Run, Chengdu Yuan Yuan, Yun Yun, Zheng Zai, Zhi Ma, Zhu Hai, Zhu Ling, Zhuang Mei, Zi Lin, Zi Su, Er Xi, Sheng Lan, Tuan Zi, Xing Rong, Ya Guang and Ya Lao Da.
- Generated exactly 20 batches, 20 source-row declarations, 15 distinct source IDs, 15 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Five shared-page declarations retain separate annual-table or lineage rows.
- Fifteen records improve source diversity and five improve both source diversity and category depth. Xing Rong's Chengdu Panda Foundation rewilding-programme profile is high confidence; nineteen specialist records remain medium confidence.
- Evidence categories contain nineteen birth records and one programme record. Er Xi, Sheng Lan, Xing Rong, Ya Guang and Ya Lao Da gained a fourth category; Tuan Zi gained a second source while retaining three categories.
- You Bang retains the local canonical form while Yu Hin / You Bing remains source-specific. Zhu Hai and Zhu Ling receive only year-and-mother assertions from the shared lineage page. Zi Su and Zi Lin retain unresolved individual date assignment across the merged 4-5 July table cell.
- Chengdu Yuan Yuan remains separate from same-romanisation pandas in Taipei and Vienna. Ya Yi's mother 星雅 remains separate from the existing male Subject xing-ya.
- Added no media, accepted no replacement media candidate and changed no media classification. The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1127-1146.json`.

### Coverage and verification
- All twenty targets now have at least two source rows; zero remain single-source-only.
- Fourteen six-category targets now have two direct records, two sources and score -13. Tuan Zi now has four direct records, two sources, three categories and score -13. Er Xi, Sheng Lan, Xing Rong, Ya Guang and Ya Lao Da now have four direct records, two sources, four categories and score -15.
- The media-covered zero-direct count remains zero. No historical snapshot repair was required in this slice.
- Focused rounds1127-1146 verification — PASS: 11/11 before and after the deterministic rerun.
- Full local research suite — PASS: 991/991. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 2,417 files, 778 Subject IDs, 2,726 normalized name keys, 10,093 record IDs, 9,139 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1146 contain 956 batches, 1,160 source-row declarations, 1,009 distinct source IDs, 3,261 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Ya Shuang, Ya Xiang, Ya Yun and Ya Zai, followed by Da Shuang and other low-category or low-source-depth Subjects.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Category depth and source diversity rounds1147-1166

### Sixth depth-and-diversity slice
- Added twenty non-Pandapia direct records for Ya Shuang, Ya Xiang, Ya Yun, Ya Zai, Da Shuang, A Ling, Si Jun Jun, Si Nian, Hua Yang, Qing He, Chang Ning, Chang Qing, A Bao, early-Chengdu Qing Qing, Ya Xing, An An's two 2023 cubs, Du Du, Hai Hai and Lan Zai.
- Generated exactly 20 batches, 20 source-row declarations, 13 distinct source IDs, 13 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Four shared-page declarations retain separate field-history, annual-table or programme rows.
- Sixteen records improve both source diversity and category depth; four improve source diversity only. Three official records are high confidence: A Bao's Zoo Atlanta identity/reproduction update and the two Shaanxi Forestry An An programme records. Seventeen specialist records remain medium confidence.
- Evidence categories contain fourteen birth records, four reproduction records and two programme records.
- Zoo Atlanta's official record resolves Po as the female Chengdu panda A Bao / Bao Lan and explicitly supersedes the earlier reported-plus-inferred record `lpr-20260730-newsubject-round306-0003`, which had incorrectly separated them on the premise that Po was male. Historical provenance remains retained.
- An An's ordered cub Subjects remain individually sex-unresolved despite the litter being mixed-sex. Du Du remains distinct from the historical Chengdu panda of the same name. Si Jun Jun retains the local romanization while Si Yun Yun remains source-specific.
- Added no media, accepted no replacement media candidate and changed no media classification. The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1147-1166.json`.

### Coverage, regression repair and verification
- All twenty targets now have at least two source families; zero remain single-source-only. The media-covered zero-direct count remains zero.
- Final target scores are distributed as -11 for two Subjects, -13 for two, -14 for four, -15 for ten, -16 for Da Shuang and -18 for Qing He.
- Updated the rounds949-952, rounds993-1012 and rounds1013-1032 coverage assertions to allow later direct/source enrichment and lower coverage-gap scores. Related verification passed 43/43.
- Focused rounds1147-1166 verification — PASS: 11/11 before and after the deterministic rerun.
- Full local research suite — PASS: 1,002/1,002. Development acceptance — PASS: `npm run verify:dev -- --scope research`; two earlier invocations encountered connector-level 502 responses, while the component checks and final retry passed.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 2,457 files, 778 Subject IDs, 2,726 normalized name keys, 10,113 record IDs, 9,159 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1166 contain 976 batches, 1,180 source-row declarations, 1,022 distinct source IDs, 3,281 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Lao Lao, Mei Zhu and Wen Hui, followed by Bing Zai, Can Can's cub, Feng Yi, He He, Nong Nong, Sen Sen, Shui Xiu and Yuan Xiao.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Category depth and source diversity rounds1167-1186

### Seventh depth-and-diversity slice
- Added twenty non-Pandapia direct records for Lao Lao, Mei Zhu, Wen Hui, Bing Zai, Can Can's cub, Feng Yi, He He, Nong Nong, Sen Sen, Shui Xiu, Yuan Xiao, Dujiangyan Mei Lan, Chuan Chuan, Cui Cui, Ya Lin, Jin Hui, Lin Yang, Pang Yuan, Qin Chuan and Quan Mei.
- Generated exactly 20 batches, 20 source-row declarations, 18 distinct source IDs, 18 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Two shared annual-table declarations retain separate rows for Mei Zhu/Jin Hui and He He/Yuan Xiao.
- Fourteen records improve both source diversity and category depth; six improve source diversity only. Chuan Chuan's government-affiliated breeding history and Ya Lin's China News Service transfer report are high confidence; eighteen specialist records remain medium confidence.
- Evidence categories contain nine birth records, two identity records, two reproduction records, and one each for survival, rescue, sex, history, movement, health and lineage.
- Can Can's singular photographed cub remains unresolved between Can Yang and Qing Yang. The 2016 female Mei Lan remains separate from the 2006 Atlanta male. Female Cui Cui remains separate from male 璀璀. Qin Chuan's birthplace conflict and Pang Yuan's 8/9 August 2022 date ambiguity remain unresolved.
- Added no media, accepted no replacement media candidate and changed no media classification. The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1167-1186.json`.

### Recovery, coverage and verification
- The earlier Windows process-launch failure cleared after the CodexPro service restarted into a Linux shell. The generator then completed normally; no recovery-package import was required.
- All twenty targets remain multi-source. Final score distribution is -13 for two Subjects, -14 for three, -15 for nine, -16 for two, -18 for Cui Cui and -20 for Mei Lan, Chuan Chuan and Ya Lin. The media-covered zero-direct count remains zero.
- Wen Hui and Yuan Xiao correctly retain three source families because their new records reuse the existing Panda.fr source family. Mei Lan has two individual-media rows, so its final score is -20 rather than the initially projected -25.
- Updated rounds909-928 and rounds1047-1066 coverage assertions to permit later direct/source/category enrichment and lower scores. Related verification passed 33/33.
- Focused rounds1167-1186 verification — PASS: 11/11 before and after deterministic rerun.
- Full local research suite — PASS: 1,013/1,013. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 2,497 files, 778 Subject IDs, 2,726 normalized name keys, 10,133 record IDs, 9,179 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1186 contain 996 batches, 1,200 source-row declarations, 1,040 distinct source IDs, 3,301 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Wang Yue, Ya Zhi, Yang Hu, Yu Chen, Yue Hua, Yue Xuan, Zi Ang and Zi Shi, followed by Si Jun Jun, Si Nian and the next one-direct seven-category group.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Direct relationship and category depth rounds1187-1206

### Eighth depth slice
- Added twenty non-Pandapia direct records for Wang Yue, Ya Zhi, Yang Hu, Yu Chen, Yue Hua, Yue Xuan, Zi Ang, Zi Shi, Si Jun Jun, Si Nian, Fu Duo Duo, Chao Chao, Cheng Da, Cheng Dui, Cheng Jiu, Cheng Lan, Cheng Shi, Chun Sheng, Da Mei and Guai Guai.
- Generated exactly 20 batches, 20 source-row declarations, 13 distinct source IDs, 13 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Four shared-page declarations retain separate annual-table, transfer-report or holder rows.
- Fourteen records upgrade named mother, offspring or litter relationships to direct evidence. Six new-category records add Yang Hu's death, the Si twins' movement, Fu Duo Duo's current location, Chao Chao's adoption and Guai Guai's lineage placement.
- Six records are high confidence: Yang Hu's Xinhua death record, the two China News Service Si-twin movement records, Chao Chao's Xinhua adoption record, and the two Chengdu holder relationship records for Cheng Lan and Da Mei. Fourteen specialist records remain medium confidence.
- Yue Hua/Yue Xuan and Zi Ang/Zi Shi retain unresolved birth order because annual-table row order is not used as evidence. Cheng Da and Liu Yi retain same-litter placement without strengthening exact twin terminology. Yang Hu's cause of death remains unstated. Guai Guai's source is used only for family-network placement.
- Added no media, accepted no replacement media candidate and changed no media classification. The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1187-1206.json`.

### Coverage and verification
- All twenty targets remain multi-source. Final score distribution is -14 for seven Subjects, -15 for seven, -16 for Yang Hu and the Si twins, and -17 for Fu Duo Duo, Chao Chao and Guai Guai. The media-covered zero-direct count remains zero.
- Updated rounds929-948, rounds953-972 and rounds1147-1166 coverage assertions to permit later direct/source/category enrichment and lower scores. Related verification passed 44/44.
- Focused rounds1187-1206 verification — PASS: 11/11 before and after deterministic rerun.
- Full local research suite — PASS: 1,024/1,024. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 2,537 files, 778 Subject IDs, 2,726 normalized name keys, 10,153 record IDs, 9,199 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1206 contain 1,016 batches, 1,220 source-row declarations, 1,053 distinct source IDs, 3,321 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Hao Jing, Hao Yu, Hao Yue, He Mei, He Qi, Ji Ran, Ji Xiao, Jiao Ao, Jiao Yi and Ke Nian, followed by the remaining one-direct seven-category group.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Direct relationship, health and category depth rounds1207-1226

### Ninth depth slice
- Added twenty non-Pandapia direct records for Hao Jing, Hao Yu, Hao Yue, He Mei, He Qi, Ji Ran, Ji Xiao, Jiao Ao, Jiao Yi, Ke Nian, Liu Liu, Lun Hui, Ni Hao, Ni Ke, Ni Na, Pan Yue, Run Yue, Shun Shun, Wu Jun and Wu Wen's second 2024 cub.
- Generated exactly 20 batches, 20 source-row declarations, 13 distinct source IDs, 13 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Six shared-page declarations retain separate annual-table or medical-outcome rows.
- Seventeen records upgrade named mother, offspring or litter relationships to direct evidence. Liu Liu and Shun Shun receive direct health-course records from a CCTV relay of the Chengdu Base notice. Pan Yue receives a new reproduction category for the Zi Shi/Zi Ang litter.
- Three records are high confidence: the two CCTV health records and Xinhua's bounded relationship record for Wu Wen's second 2024 cub. Seventeen specialist records remain medium confidence.
- Hao Jing/Hao Yu and He Mei/He Qi retain same-litter wording without strengthening birth order or exact twin terminology. Ni Ke/Ni Na birth order is not inferred from annual-table order. Ni Hao's source-specific mother-name order Ni Xiao remains unresolved against local Xiao Ni. Shun Shun remains distinct from the Hainan same-name panda. Wu Wen's second cub remains sex-unresolved, and the surviving litter mate is not named from Xinhua.
- Added no media, accepted no replacement media candidate and changed no media classification. The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1207-1226.json`.

### Coverage and verification
- Nineteen targets now have two direct records, seven categories and score -15. Pan Yue has two direct records, three source families, eight categories and score -17. The media-covered zero-direct count remains zero.
- Updated the rounds973-992 coverage assertion to permit later direct/source enrichment and lower scores. Related verification passed 22/22.
- Focused rounds1207-1226 verification — PASS: 11/11 before and after deterministic rerun.
- Full local research suite — PASS: 1,035/1,035. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 2,577 files, 778 Subject IDs, 2,726 normalized name keys, 10,173 record IDs, 9,219 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1226 contain 1,036 batches, 1,240 source-row declarations, 1,066 distinct source IDs, 3,341 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Xiang Guo, Xiao Chuan, Xiao He Tao, Xing Mei, Xing Yi, Xiu Yang, Ya Ao, Ya Jun, Yang Hua and Yuan Yue, followed by the remaining one-direct seven-category group.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Direct relationship and category depth rounds1227-1246

### Tenth depth slice
- Added twenty non-Pandapia direct records for Xiang Guo, Xiao Chuan, Xiao He Tao, Xing Mei, Xing Yi, Xiu Yang, Ya Ao, Ya Jun, Yang Hua, Yuan Yue, Zhi Hua, Zhi Shi, Zhi Shu, Hua Li, Jing Bao, Jiu Jiu, Li Dui, Miao Yin, female Chengdu Xing Ya and female Ge Ge-offspring He He.
- Generated exactly 20 batches, 20 source-row declarations, 10 distinct source IDs, 10 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Six shared-page declarations retain separate annual-table rows.
- Eighteen records upgrade named mother, offspring or litter relationships to direct evidence. Ya Ao receives a bounded direct death record from the Shanghai Wild Animal Park notice report. Female Chengdu Xing Ya receives a direct reproduction record for the Ya Yi/Ya Er litter.
- Ya Ao's death record is high confidence; nineteen specialist annual-table records remain medium confidence.
- Birth order is not inferred from annual-table row order. Yuan Yue retains local 园月 while source-specific 圆月 remains visible. Jiu Jiu (九九) remains distinct from the 2018 玖玖 identity and the Madrid same-romanisation Subject. Female Chengdu Xing Ya remains distinct from the male Ouwehands Xing Ya. Female He He remains distinct from adult male same-name Subjects.
- Added no media, accepted no replacement media candidate and changed no media classification. The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1227-1246.json`.

### Coverage and verification
- All twenty targets now have two direct records, seven categories and score -15. Existing source-family counts remain unchanged: Xiao He Tao and five Ge Ge-family Subjects retain three source families, female Chengdu Xing Ya retains three, female He He retains four, and the remaining Subjects retain two.
- Updated the rounds1033-1046 coverage assertion to permit later direct enrichment and lower scores. Related verification passed 22/22.
- Focused rounds1227-1246 verification — PASS: 11/11 before and after deterministic rerun.
- Full local research suite — PASS: 1,046/1,046. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 2,617 files, 778 Subject IDs, 2,726 normalized name keys, 10,193 record IDs, 9,239 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1246 contain 1,056 batches, 1,260 source-row declarations, 1,076 distinct source IDs, 3,361 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Jing Rong, followed by Ai Bang's 2016 Cub 66, Ai Jiu, Ai Le, Ai Lin, Ai Mi, Ai Si, An An's 2022 cub, Ao Ke and Ao Ran, then the remaining two-direct six-category group.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Source diversity, relationship and category depth rounds1247-1266

### Eleventh depth slice
- Added twenty non-Pandapia direct records for Jing Rong, Ai Bang's 2016 cub, Ai Jiu, Ai Le, Ai Lin, Ai Mi, Ai Si, An An's unnamed 2022 cub, Ao Ke, Ao Ran, Bao Ge, Bao Mei, Bao Quan, Bing Cheng, Bing Xue, Bo Wen, CC, Cheng Cheng, Cheng Feng and Cheng Lang.
- Generated exactly 20 batches, 20 source-row declarations, 13 distinct source IDs, 13 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Four shared-page declarations retain separate annual-table or twin-report rows.
- Eighteen records add direct mother, offspring or same-litter relationship depth. Bao Quan receives a named location category from CCTV iPanda's 2024 Chengdu visit feature. Jing Rong receives an independent Chengdu Zoo holder source and exits single-source status.
- Five records are high confidence: Jing Rong's holder history, Ai Mi's CCTV twin relationship, the two Xinhua A Bao twin relationships and Bao Quan's CCTV location record. Fifteen specialist or republication records remain medium confidence.
- External re-verification found that the current Panda News Cheng Cheng page does not support the initially drafted death date. That draft was removed before final validation and replaced with Shi Shi's explicit child-profile field identifying Cheng Cheng, studbook 297, as his mother.
- Annual-table order is not used to infer birth order. Ai Bang's 2016 cub retains the bounded local identifier rather than adopting source-specific Ai Liu as a final name. An An's 2022 cub remains unnamed. Bao Quan is not assigned to either of Yang Hua's two unnamed 2019 annual-table rows. Bao Mei remains separated from other same-name Subjects.
- Added no media, accepted no replacement media candidate and changed no media classification. The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1247-1266.json`.

### Coverage and verification
- Jing Rong now has five direct records, two source families, five categories and score -20. Bao Quan has three direct records, seven categories and score -18. The remaining eighteen targets have three direct records, two source families, six categories and score -16.
- Updated the rounds1067-1086 coverage assertion to permit later direct/source/category enrichment and lower scores. Related verification passed 22/22.
- Focused rounds1247-1266 verification — PASS: 11/11 before and after deterministic rerun and again after the Cheng Cheng evidence correction.
- Full local research suite — PASS: 1,057/1,057 after the final evidence correction. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 2,657 files, 778 Subject IDs, 2,726 normalized name keys, 10,213 record IDs, 9,259 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1266 contain 1,076 batches, 1,280 source-row declarations, 1,089 distinct source IDs, 3,381 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Chu Xin, Chun Chun, Chun Hui, Chun Lai, Da Ni, Fu Sheng, Fu Wa, Han Han, Hua Ao and Hua Long, followed by the remaining two-direct six-category group.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Direct relationship and location depth rounds1267-1286

### Twelfth depth slice
- Added twenty non-Pandapia direct records for Chu Xin, Chun Chun, Chun Hui, Chun Lai, Da Ni, Fu Sheng, Fu Wa, Han Han, Hua Ao, Hua Long, Hua Rong, Ji Fu, Ji Li, Ji You, Jiao Xiao, Jiao Yang, Jin Baobao, Jin Jin, Jin Rui and Jin Yu.
- Generated exactly 20 batches, 20 source-row declarations, 15 distinct source IDs, 15 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Three shared-page declarations retain separate annual-table rows.
- Nineteen records add direct mother, offspring or same-litter relationship depth. Jin Yu receives a bounded location category from an independent March 2024 field observation at the Rising Sun pavilion.
- Fu Wa's Xinhua twin-family record and Jin Jin's People's Daily mother relationship are high confidence. Eighteen specialist annual-table or field-observation records remain medium confidence.
- Annual-table order is not used to infer birth order. Chun Chun's existing order conflict remains unresolved. Fu Wa remains distinct from the Mianyang same-name Subject. Hua Ao/Hua Long receive same-dated sibling wording without stronger order inference. Ji Fu's one-day date conflict remains unresolved. Jiao Xiao's cross-date litter context does not add unsupported timing precision. Jin Yu's observation is not expanded into a current-residence assertion.
- Added no media, accepted no replacement media candidate and changed no media classification. The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1267-1286.json`.

### Coverage and verification
- Nineteen targets now have three direct records, six categories and score -16. Jin Yu has three direct records, seven categories and score -18. Fu Wa retains three source families; every other target retains two. The media-covered zero-direct count remains zero.
- Updated the rounds1087-1106 coverage assertion to permit later direct/source/category enrichment and lower scores. Related verification passed 22/22.
- Focused rounds1267-1286 verification — PASS: 11/11 before and after deterministic rerun.
- Full local research suite — PASS: 1,068/1,068. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 2,697 files, 778 Subject IDs, 2,726 normalized name keys, 10,233 record IDs, 9,279 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1286 contain 1,096 batches, 1,300 source-row declarations, 1,104 distinct source IDs, 3,401 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Lan Bao, Ling Zhu, Liu Yi, Lu Lu, Lun Wen, Lun Wu, Lv Di, Mei Ling, Ni Ni and 99, followed by the remaining two-direct six-category group.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Direct relationship depth rounds1287-1306

### Thirteenth depth slice
- Added twenty non-Pandapia direct relationship records for Lan Bao, Ling Zhu, Liu Yi, Lu Lu, Lun Wen, Lun Wu, Lv Di, Mei Ling, Ni Ni, 99, Ning Ning, Qi Qiao, Qing Chong Yang, Qing Zai, Qing Zhu Yu, Rong Sheng, Ru Ru, Run Jiu, Run Ze and Sa Er.
- Generated exactly 20 batches, 20 source-row declarations, 14 distinct source IDs, 14 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Four shared-page declarations retain separate annual-table rows.
- All twenty records add direct mother, offspring, same-litter or bounded litter-membership depth. Lan Bao, Ling Zhu, Mei Ling and Rong Sheng use state-media evidence and are high confidence. Sixteen specialist annual-table, lineage or historical-feature records remain medium confidence.
- Annual-table order is not used to infer birth order. Ling Zhu's later name is bound only through the unique exact maternal event. Liu Yi and Ning Ning retain unresolved individual dates inside cross-date litters. Lu Lu remains distinct from unrelated same-romanisation Subjects and retains Dai Dai/Shan Zai as source-linked forms. Lun Wen, Lun Wu, 99 and Run Ze receive same-birth-date wording without unsupported twin inference. Lv Di's unnamed littermate is not invented. Qi Qiao's Chinese-name conflict and erroneous parenthetical remain unresolved. Sa Er's two non-surviving littermates are not named.
- Added no media, accepted no replacement media candidate and changed no media classification. The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1287-1306.json`.

### Coverage and verification
- All twenty targets now have three direct records, six categories and score -16. Lan Bao and Lu Lu have three source families; the remaining eighteen retain two. The media-covered zero-direct count remains zero.
- Focused rounds1287-1306 verification — PASS: 11/11 before and after deterministic rerun.
- Full local research suite — PASS: 1,079/1,079 without additional historical-test changes. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 2,737 files, 778 Subject IDs, 2,726 normalized name keys, 10,253 record IDs, 9,299 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1306 contain 1,116 batches, 1,320 source-row declarations, 1,118 distinct source IDs, 3,421 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Shan Hu, Shan Zai, Sheng Lan, Shu Hui, Shu Lan, Shuang Hao, Su Lin's 2019 Cub A, Su Xing, Su Yang and Ting Ting, followed by the remaining two-direct six-category group.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Direct relationship depth rounds1307-1326

### Fourteenth depth slice
- Added twenty non-Pandapia direct relationship records for Shan Hu, Shan Zai, Sheng Lan, Shu Hui, Shu Lan, Shuang Hao, Su Lin's bounded 2019 older cub, Su Xing, Su Yang, Ting Ting, Ting Zai, Wei Wei, Xiao Jiao, Xiao Ni, Xiao Qiao, Xiao Shuang, Xiao Ya, Xin Yue, Xing An and Xing Fan.
- Generated exactly 20 batches, 20 source-row declarations, 16 distinct source IDs, 16 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Four shared-page declarations retain separate annual-table rows.
- All twenty records add direct mother, offspring, same-litter or bounded family-position depth. Shu Lan's Xinhua family profile, Ting Zai's CCTV mother relationship and Xiao Jiao's Xinhua first-son relationship are high confidence. Seventeen specialist registry, lineage, studbook or field-history records remain medium confidence.
- Annual-table order is not used to infer birth order. Shan Zai retains Dai Dai/Shan Zai as unresolved source-linked forms. The current Sheng Lan remains separate from the unrelated Shenshuping same-name Subject. Shu Hui's mother remains separate from Hui Hui / 回回 born in 2005. Su Lin's 2019 older cub remains descriptive and its source/profile sex conflict remains unresolved. Ting Ting and Wei Wei retain their cross-profile order conflict. Xing Fan's Chengdu mother 娅星 remains separate from Shenshuping 雅星.
- Added no media, accepted no replacement media candidate and changed no media classification. The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1307-1326.json`.

### Coverage and verification
- All twenty targets now have three direct records, six categories and score -16. Shan Zai and Sheng Lan have three source families; the remaining eighteen retain two. The media-covered zero-direct count remains zero.
- Updated the rounds1107-1126 coverage assertion to permit later direct/source/category enrichment and lower scores. Related verification passed 22/22.
- Focused rounds1307-1326 verification — PASS: 11/11 before and after deterministic rerun.
- Full local research suite — PASS: 1,090/1,090. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 2,777 files, 778 Subject IDs, 2,726 normalized name keys, 10,273 record IDs, 9,319 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1326 contain 1,136 batches, 1,340 source-row declarations, 1,134 distinct source IDs, 3,441 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Xing Qing, Xing Yu, Xing Yuan, Xing Yun, Xiu Xiu, Ya Er, Ya Song, Ya Wen, Ya Yi and Ye Ye, followed by the remaining two-direct six-category group.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Direct relationship depth rounds1327-1346

### Fifteenth depth slice
- Added twenty non-Pandapia direct relationship records for Xing Qing, Xing Yu, Xing Yuan, Xing Yun, Xiu Xiu, Ya Er, Ya Song, Ya Wen, Ya Yi, Ye Ye, Yin Ke, Ying Xue, You Bang, Yu Lei, Yuan Lin, Yuan Run, Chengdu Yuan Yuan, Yuan Zhou, Yun Hui and Yun Wen.
- Generated exactly 20 batches, 20 source-row declarations, 16 distinct source IDs, 16 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Four shared-page declarations retain separate annual-table rows.
- All twenty records add direct mother, offspring, same-litter or bounded family-position depth. Ye Ye's China News Service mother-and-female-cub record is high confidence. Nineteen specialist registry, profile, lineage or field-history records remain medium confidence.
- Annual-table order is not used to infer birth order. Xing Yu and Xing Yuan's Chengdu mother 娅星 remains separate from Shenshuping 雅星. Xiu Xiu's later death-date conflict remains unresolved. Ya Yi and Ya Er's female Chengdu mother remains separate from the male same-name Subject. Ye Ye's unnamed female cub is not merged with a later named Subject. You Bang's romanisation variants remain source-linked. Yuan Lin and Yuan Zhou retain unresolved cross-profile order conflict. Chengdu Yuan Yuan remains separate from Taipei and Vienna same-romanisation Subjects.
- Yu Lei's relationship uses the named 2017 annual-table row rather than inferring maternity from the nickname Cui Cui Zai. Yun Hui uses an independent Panda News studbook-profile transcription rather than deriving family from the death investigation.
- Added no media, accepted no replacement media candidate and changed no media classification. The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1327-1346.json`.

### Coverage and verification
- All twenty targets now have three direct records, six categories and score -16. Yu Lei, Yuan Lin, Yuan Zhou and Yun Hui have three source families; the remaining sixteen retain two. The media-covered zero-direct count remains zero.
- Updated the rounds1127-1146 coverage assertion to permit later direct/source/category enrichment and lower scores. Related verification passed 22/22.
- Focused rounds1327-1346 verification — PASS: 11/11 before and after deterministic rerun.
- Full local research suite — PASS: 1,101/1,101. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 2,817 files, 778 Subject IDs, 2,726 normalized name keys, 10,293 record IDs, 9,339 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1346 contain 1,156 batches, 1,360 source-row declarations, 1,150 distinct source IDs, 3,461 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Yun Wu, Yun Yun, Zhan Wang, Zhao Yang, Zhen Lan, Zheng Zai, Zhi Ma, Zhi Yu, Zhu Hai and Zhu Ling, followed by the remaining low-category-depth or high-source-count group.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Direct relationship and category depth rounds1347-1366

### Sixteenth depth slice
- Added twenty non-Pandapia direct records for Yun Wu, Yun Yun, Zhan Wang, Zhao Yang, Zhen Lan, Zheng Zai, Zhi Ma, Zhi Yu, Zhu Hai, Zhu Ling, Zhuang Mei, Zi Lin, Zi Lu, Zi Su, Can Yang, Tuan Zi, Xiao Yatou, Hua Yang, Hai Hai and Lao Lao.
- Generated exactly 20 batches, 20 source-row declarations, 15 distinct source IDs, 15 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Four shared-page declarations retain separately reviewed passages or annual-table rows.
- Record distribution: 16 relationship, two sex, one identity and one reproduction. Zhao Yang's Hunan Today family profile, Can Yang's Xinhua caption identity and Xiao Yatou's Chengdu Base reproduction record are high confidence; seventeen specialist records remain medium confidence.
- Zhu Hai and Zhu Ling are only co-listed as Gong Zhu's 2007 offspring by the selected lineage source; twin status, sex, precise dates and birth order are not strengthened. Zi Lin and Zi Su retain unresolved individual-date assignment from the merged cross-date cell. Can Yang receives caption-bounded identity only. Xiao Yatou's official reproduction record does not infer her own birth data.
- Hai Hai and Lao Lao now retain the source conflict explicitly: the annual table renders the mother as 林萍 while an independent specialist profile renders 林冰. Neither form overwrites the other, and annual-table order is not used to infer birth order.
- Added no media, accepted no replacement media candidate and changed no media classification. The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1347-1366.json`.

### Coverage and verification
- Yun Wu through Zi Su, plus Hai Hai and Lao Lao, now have three direct records, six categories and score -16. Zhan Wang has three source families; Hai Hai and Lao Lao retain four; the remaining thirteen in this group retain two.
- Can Yang, Tuan Zi, Xiao Yatou and Hua Yang now have five direct records, four categories and score -18. Their source-family counts are three, two, three and three respectively.
- Updated the rounds1167-1186 coverage assertion to permit later direct/source/category enrichment and lower scores. Related verification passed 22/22.
- Focused rounds1347-1366 verification — PASS: 11/11 before and after deterministic rerun.
- Full local research suite — PASS: 1,112/1,112. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 2,857 files, 778 Subject IDs, 2,726 normalized name keys, 10,313 record IDs, 9,359 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1366 contain 1,176 batches, 1,380 source-row declarations, 1,165 distinct source IDs, 3,481 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Mei Zhu, Fu Lai, Fu Shun, Ha Lan, Jing Ao, Jing Yun and Ya Lao Er, followed by Ai Bang, Ba Xi, Bing Dian, Cheng Ji and the remaining one-direct eight-category group.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Source diversity and direct depth rounds1367-1386

### Seventeenth depth slice
- Added twenty non-Pandapia direct records for Mei Zhu, Fu Lai, Fu Shun, Ha Lan, Jing Ao, Jing Yun, Ya Lao Er, Ai Bang, Ba Xi, Bing Dian, Cheng Ji, Gong Zai, He Sheng, He Yu, Jiao Zi, Jin Shuang, Jun Zu, Ke Yu, Lang Lang and Mei Mei.
- Generated exactly 20 batches, 20 source-row declarations, 14 distinct source IDs, 14 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Three shared-page declarations retain separately reviewed annual-table rows.
- Record distribution: ten relationship and ten category-depth records. Categories are relationship 10, reproduction 3, sex 2, growth measurement 2, movement 1, origin 1 and birth 1. Four state-media or historical-press records are high confidence; sixteen specialist records remain medium confidence.
- Source-family diversity is counted by source family rather than newly minted source IDs. Fu Lai, Fu Shun, Ha Lan, Jing Ao, Jing Yun and Ya Lao Er each gained a genuinely independent non-Pandapia family and are no longer single-source Subjects.
- Mei Zhu's source nickname remains an alias of the same Subject. Ha Lan's exchange is bounded to spring 1996. Cheng Ji's selected passage does not name the two cubs. Annual-table order is not used to infer birth order. Jun Zu's unnamed female cub is not merged with a later named Subject. Mei Mei's reproductive totals remain bounded to the 1999 report date.
- The first generator attempt encountered a transient import-file input/output error; the prior-index scan now skips unreadable files. A second attempt exceeded the default 30-second command limit, and the same generator passed under the extended timeout. Deterministic rerun subsequently completed normally.
- Added no media, accepted no replacement media candidate and changed no media classification. The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1367-1386.json`.

### Coverage and verification
- Mei Zhu now has three direct records, four source families, six categories and score -16.
- Fu Lai, Fu Shun, Ha Lan, Jing Ao, Jing Yun and Ya Lao Er now each have six direct records, two source families, five categories and score -23.
- The remaining thirteen targets now each have two direct records, eight categories and score -17. Ba Xi, Cheng Ji and Lang Lang have three source families; the other ten have two.
- Focused rounds1367-1386 verification — PASS: 11/11 before and after deterministic rerun.
- Full local research suite — PASS: 1,123/1,123. No historical coverage snapshot required modification.
- Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 2,897 files, 778 Subject IDs, 2,726 normalized name keys, 10,333 record IDs, 9,379 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 675 fact-bearing panda Subjects, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1386 contain 1,196 batches, 1,400 source-row declarations, 1,179 distinct source IDs, 3,501 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Nan Xiao Yue, Nao Nao, Nuo Mi, Qing Qing, Shuang Er, Shuang Qing, Shuang Xiong, Wen Wen, Wen Xi and Xiao Bao, followed by the remaining one-direct eight-category and three-direct five-category groups.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Direct relationship and measurement depth rounds1387-1406

### Eighteenth depth slice
- Added twenty non-Pandapia direct records for Nan Xiao Yue, Nao Nao, Nuo Mi, Qing Qing, Shuang Er, Shuang Qing, Shuang Xiong, Wen Wen, Wen Xi, Xiao Bao, Xing Chen, Xing Guang, Ya Yun, Ya Zhu, Zhi Zhi, Bing Bing, Cheng Shuang, Ke Lin, Miao Miao and Wang Yue.
- Generated exactly 20 batches, 20 source-row declarations, 11 distinct source IDs, 11 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Five shared pages retain separate reviewed annual-table rows or separately named foster-cub entries.
- Record distribution: fourteen relationship and six growth-measurement records. Qing Qing's CCTV family feature, Cheng Shuang and Miao Miao's Chengdu Zoo foster-care profile, and Ke Lin's China Daily regional profile are high confidence; sixteen specialist annual-table or studbook-profile records remain medium confidence.
- Direct relationship depth now records Nan Xiao Yue as Wang Jia's daughter, Nao Nao as Er Qiao's daughter and Chao Chao's same-date sibling, Nuo Mi as Jun Zu's daughter, Qing Qing as Bai Xue's male 1999 litter member with Xiu Xiu, Shuang Qing as Da Shuang's son and Shuang Er's same-date sibling, Wen Wen and Wen Xi as Wen Li's offspring, Xiao Bao as Yan Hui's daughter and Pang Yuan's litter mate, Ya Yun as Ya Li's daughter and Ya Zhu's litter mate, Zhi Zhi as Ya Lao Da's daughter, and Bing Bing as Xiang Bing's mother and Guo Guo/Pang's offspring.
- Growth depth adds direct birth weights for Shuang Er (40 g), Shuang Xiong (186 g), Xing Chen (161 g), Xing Guang (170 g), Ya Zhu (144 g) and Wang Yue (92.4 g).
- Cheng Shuang and Miao Miao are recorded only as foster cubs raised by Li Li; biological maternity is not overwritten. Ke Lin is directly recorded as Rong Yao / former Ke Dou's mother.
- Annual-table order is not used to infer birth order. Nan Xiao Yue's exact CCRCGP sub-base is not invented. Xiao Bao retains the source's 8/9 August date range. Bing Bing's own birth precision remains month-only in the selected profile. Same-date co-listing is not strengthened beyond the reviewed wording.
- Added no media, accepted no replacement media candidate and changed no media classification. The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1387-1406.json`.

### Coverage and verification
- Eleven relationship-depth targets now have two direct records, eight categories and score -17. Five measurement-depth targets now have two direct records, nine categories and score -19.
- Cheng Shuang, Ke Lin and Miao Miao now have four direct records, five categories and score -17. Wang Yue now has four direct records, six categories and score -19. All twenty targets remain multi-source.
- Updated the rounds1187-1206 Wang Yue coverage assertion to permit later direct/source/category enrichment and lower scores. The related historical test passed 11/11.
- Focused rounds1387-1406 verification — PASS: 11/11 before and after deterministic rerun.
- Full local research suite — PASS: 1,134/1,134. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 2,937 files, 778 Subject IDs, 2,726 normalized name keys, 10,353 record IDs, 9,399 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1406 contain 1,216 batches, 1,420 source-row declarations, 1,190 distinct source IDs, 3,521 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Wu Jie, Ya Zhi, Yu Chen, Yue Hua, Yue Xuan, Zi Ang, Zi Shi, Chang Ning, Chang Qing and Jin Hui, followed by Pang Yuan, Qin Chuan, A Bao and the remaining three-direct five-category group.
- The first generator invocation used the unavailable `python` alias; rerunning with `python3` succeeded. Two transient connector 502 responses occurred while launching a combined targeted test command; the split historical test and subsequent full suite both completed normally.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Direct category and relationship depth rounds1407-1426

### Nineteenth depth slice
- Added twenty non-Pandapia direct records for Wu Jie, Ya Zhi, Yu Chen, Yue Hua, Yue Xuan, Zi Ang, Zi Shi, Chang Ning, Chang Qing, Jin Hui, Pang Yuan, Qin Chuan, A Bao, early Chengdu Qing Qing, Xi Dou's cub, Xi Lan, A Ling, Ao Ao, Cai Yun and Cheng Da.
- Generated exactly 20 batches, 20 source-row declarations, 13 distinct source IDs, 13 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Three shared annual-table pages retain separate reviewed Subject rows.
- Record distribution: thirteen location, three relationship, and one each of growth measurement, birth, death and reproduction. Six institutional, holder or state-media records are high confidence; fourteen specialist annual-table or historical records remain medium confidence.
- Location depth now places Wu Jie at Bifengxia Panda Paradise, Ya Zhi at Chengdu, Yu Chen and the Yue twins at Gengda Shenshuping, Zi Ang and Zi Shi at institution-level CCRCGP, Chang Qing at Louguantai, Jin Hui and Pang Yuan at Gengda Shenshuping, Xi Lan at Zoo Atlanta and A Ling at Ya'an Bifengxia. Qin Chuan retains Chengdu only as the selected source's birthplace value because other histories carry Louguantai context.
- Chang Ning's direct measurement remains bounded as under 60 g rather than converted to an exact weight. A Bao gains the official Zoo Atlanta Po birth anchor. Early Chengdu Qing Qing gains a death-at-age record without an invented exact date.
- Xinhua directly identifies the descriptive Xi Dou cub as Xi Dou's offspring without supplying a formal name or sex. Ao Ao is directly tied to Li Li and twin Shen Shen without birth-order inference. Hunan Today directly identifies Cai Yun as Zhao Yang's twin sister without copying Zhao Yang's parent fields. Chengdu Base directly records first-time mother Cheng Da's 2017 litter of Da Mei and Cheng Lan.
- Annual-table order is not used to infer birth order. Zi Ang and Zi Shi retain institution-only birthplace precision. Pang Yuan retains the 8/9 August individual-date ambiguity. No source adds, replaces or reclassifies media.
- The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1407-1426.json`.

### Coverage and verification
- The first fourteen targets now have four direct records, six categories and score -19.
- Xi Dou's cub and Xi Lan now have six direct records, six categories and score -20. A Ling now has three direct records, eight categories and score -20.
- Ao Ao, Cai Yun and Cheng Da now have three direct records, seven categories and score -18. All twenty targets remain multi-source.
- Updated the rounds1187-1206 coverage assertion so Wang Yue and the seven Subjects enriched by this slice may gain later direct records, source families and categories while retaining all other exact historical expectations.
- Focused rounds1407-1426 verification — PASS: 11/11 before and after deterministic rerun. Related current and historical verification — PASS: 44/44.
- Full local research suite — PASS: 1,145/1,145. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 2,977 files, 778 Subject IDs, 2,726 normalized name keys, 10,373 record IDs, 9,419 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1426 contain 1,236 batches, 1,440 source-row declarations, 1,203 distinct source IDs, 3,541 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Cheng Dui, Cheng Jiu, Cheng Lan, Cheng Shi, Chun Sheng, Da Mei, Hao Jing, Hao Yu, Hao Yue and He Mei, followed by He Qi, Hua Yan, Ji Ran, Ji Xiao, Jiao Ao, Jiao Yi, Ke Nian, Long Gu, Lun Hui and Ni Hao.
- Several workspace calls returned transient 502 responses. The Bash environment also exposed npm without a Linux-visible Node binary; project npm scripts were therefore executed through `cmd.exe`, where Node v24.16.0 was available. All final tests and acceptance checks completed normally.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Direct location and measurement depth rounds1427-1446

### Twentieth depth slice
- Added twenty non-Pandapia direct records for Cheng Dui, Cheng Jiu, Cheng Lan, Cheng Shi, Chun Sheng, Da Mei, Hao Jing, Hao Yu, Hao Yue, He Mei, He Qi, Hua Yan, Ji Ran, Ji Xiao, Jiao Ao, Jiao Yi, Ke Nian, Long Gu, Lun Hui and Ni Hao.
- Generated exactly 20 batches, 20 source-row declarations, 14 distinct source IDs, 14 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Five shared pages retain separate reviewed Subject rows.
- Record distribution: twelve location and eight growth-measurement records. Cheng Lan and Da Mei use the Chengdu Base holder summary, while Hua Yan uses China News Service; these three records are high confidence. Seventeen annual-registry or historical-roster records remain medium confidence.
- Location depth now records Cheng Dui, Cheng Jiu, Hao Jing, Hao Yu, He Mei, He Qi, Ji Ran, Jiao Yi, Ke Nian and Ni Hao at Chengdu Research Base. Hao Yue remains at institution-level CCRCGP without an invented sub-base. The independent historical roster associates Long Gu with Jinan Zoo without importing arrival or death dates.
- Measurement depth adds direct birth weights for Cheng Lan (160.2 g), Cheng Shi (205 g), Chun Sheng (176.7 g), Da Mei (128.2 g), Ji Xiao (166.8 g), Jiao Ao (179 g) and Lun Hui (214.6 g). Hua Yan's 80 kg weight and 115 cm body length are explicitly pre-release examination measurements rather than birth measurements.
- Hao Jing retains the source alternate name Hao Yan / 好琰. Ke Nian retains the source alternate name Gong Zhu / 贡主. Ni Hao retains the annual table's Ni Xiao / 妮小 mother-name order without overwriting the local Xiao Ni / 小妮 canonical form.
- Annual-table row order is not used to infer birth order. Existing birth, relationship, death and medical records are not overwritten. No source adds, replaces or reclassifies media.
- The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1427-1446.json`.

### Coverage and verification
- All twenty targets now have three direct records, eight categories and score -20. All remain multi-source.
- Updated the rounds1187-1206 coverage assertion for the six Cheng Ji / Cheng Da family Subjects enriched by this slice. Updated rounds1207-1226 for the twelve later Subjects enriched here; untouched historical Subjects retain exact expectations.
- Focused rounds1427-1446 verification — PASS: 11/11 before and after deterministic rerun. Related current and historical verification — PASS: 77/77.
- Full local research suite — PASS: 1,156/1,156. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 3,017 files, 778 Subject IDs, 2,726 normalized name keys, 10,393 record IDs, 9,439 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1446 contain 1,256 batches, 1,460 source-row declarations, 1,217 distinct source IDs, 3,561 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Ni Ke, Ni Na, Run Yue, Shen Shen, Wu Jun, Wu Wen's 2024 Cub B, Xiang Guo, Xiao Chuan, Xing Mei and Xing Yi, followed by Xiu Yang, Ya Ao, Ya Jun, Yang Hua, Yuan Yue, Zhi Hua, Zhi Shi and Zhi Shu.
- Several connector calls returned transient 502 responses and invalidated the original workspace session. Reopening the same root restored access; no partial generated artifact remained from failed write calls. npm scripts were again executed through `cmd.exe` because Node was not Linux-visible in the Bash environment.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Direct category depth rounds1447-1466

### Twenty-first depth slice
- Added twenty non-Pandapia direct records for Ni Ke, Ni Na, Run Yue, Shen Shen, Wu Jun, Wu Wen's 2024 Cub B, Xiang Guo, Xiao Chuan, Xing Mei, Xing Yi, Xiu Yang, Ya Ao, Ya Jun, Yang Hua, Yuan Yue, Zhi Hua, Zhi Shi, Zhi Shu, Er Xi and Fu Shuang.
- Generated exactly 20 batches, 20 source-row declarations, 14 distinct source IDs, 14 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Five shared pages retain separate reviewed Subject rows.
- Record distribution: eleven location, seven growth-measurement, one appearance and one sex record. Xinhua's Wu Wen cub report and Zoo Atlanta's Fu Shuang official FAQ are high confidence; eighteen annual-registry or specialist-life records remain medium confidence.
- Measurement depth adds direct birth weights for Ni Ke (203 g), Ni Na (91 g), Run Yue (172.6 g), Xiao Chuan (89.5 g), Xiu Yang (220 g), Yuan Yue (174.6 g) and Zhi Shi (104.9 g).
- Location depth places Shen Shen at Chengdu Zoological Garden, Wu Jun at Wolong without an invented sub-base, Xiang Guo, Xing Mei, Xing Yi, Zhi Hua and Zhi Shu at Chengdu Research Base, Ya Ao at CCRCGP Wolong, and Ya Jun and Yang Hua at Ya'an Bifengxia Base. Zoo Atlanta officially anchors Fu Shuang's birthplace at Chengdu Research Base while her Atlanta arrival remains unasserted.
- Wu Wen's second 2024 cub receives only the direct comparative statement that it was visibly smaller than the surviving first cub; no numeric weight is invented. Er Xi gains a direct male-sex record bounded by exact date, mother and Chengdu birth row.
- Annual-table row order is not used to infer birth order. Existing birth, relationship, death, health, transfer and lineage records are not overwritten. No source adds, replaces or reclassifies media.
- The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1447-1466.json`.

### Coverage and verification
- The first eighteen targets now have three direct records, eight categories and score -20. Shen Shen and Ya Ao have three source families; the other sixteen remain multi-source with two source families.
- Er Xi and Fu Shuang now have five direct records, five categories and score -20. Fu Shuang has three source families; Er Xi retains two.
- Updated the rounds1207-1226 coverage assertion for five Subjects enriched by this slice and rounds1227-1246 for twelve Subjects. Untouched historical Subjects retain exact expectations.
- Focused rounds1447-1466 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 74/74.
- Full local research suite — PASS: 1,164/1,164. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 3,057 files, 778 Subject IDs, 2,726 normalized name keys, 10,413 record IDs, 9,459 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1466 contain 1,276 batches, 1,480 source-row declarations, 1,231 distinct source IDs, 3,581 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Sheng Lan, Xing Rong, Ya Guang, Ya Lao Da, Ya Shuang, Ya Xiang, Ya Yun, Ya Zai, Hua Li and Jing Bao, followed by Jiu Jiu, Li Dui, Liu Liu, Miao Yin, Shun Shun, Wen Hui, Xiao He Tao, Xing Ya, Ya Xing and Yuan Xiao.
- The first index refresh exceeded the 30-second connector timeout after emitting the completed index summary; a clean rerun with a 60-second timeout completed normally. npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Direct category depth rounds1467-1486

### Twenty-second depth slice
- Added twenty non-Pandapia direct records for Sheng Lan, Xing Rong, Ya Guang, Ya Lao Da, Ya Shuang, Ya Yun, Ya Xiang, Ya Zai, Hua Li, Jing Bao, Jiu Jiu, Li Dui, Liu Liu, Miao Yin, Shun Shun, Wen Hui, Xiao He Tao, female Xing Ya, Ya Xing and Yuan Xiao.
- Generated exactly 20 batches, 20 source-row declarations, 14 distinct source IDs, 14 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Four shared pages retain separately reviewed Subject rows.
- Record distribution: seven location, four sex, three growth-measurement, two relationship, two birth, one reproduction and one transfer record. Chengdu Panda Foundation's Xing Rong birth anchor and the national forestry Xiao He Tao release-location record are high confidence; eighteen specialist records remain medium confidence.
- Sheng Lan gains a direct mother and same-litter relationship to Zhen Zhen and Zhen Lan. Xing Rong gains a holder-foundation birth record. Ya Guang, Ya Shuang, Ya Xiang and Ya Zai gain direct sex records, while Ya Yun gains a direct birth record.
- Ya Lao Da gains a bounded 2008 twin-birth event without imported cub names. Hua Li, Jiu Jiu, Miao Yin and Wen Hui gain Ya'an Bifengxia birth-location depth; Jing Bao and Li Dui gain Gengda Shenshuping birth-location depth.
- Liu Liu, Shun Shun and Ya Xing gain direct birth weights of 131.4 g, 176.6 g and 166 g respectively. Xiao He Tao's location record is explicitly the 2018 Longxi-Hongkou release destination rather than a birth or current-residence claim.
- Female Xing Ya gains a January 2012 reintroduction-programme transfer record while retaining the studbook-681 boundary from the male Ouwehands namesake. Yuan Xiao gains a direct mother relationship to Xin Xin while its birth institution remains at CCRCGP level without an invented sub-base.
- Narrative and annual-table order are not used to infer birth order. Existing birth, relationship, programme, reproduction, release and identity records are not overwritten. No source adds, replaces or reclassifies media.
- The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1467-1486.json`.

### Coverage and verification
- Sheng Lan, Xing Rong, Ya Guang, Ya Lao Da, Ya Shuang, Ya Yun, Ya Xiang, Ya Zai, Ya Xing and Yuan Xiao now have five direct records, five categories and score -20.
- Hua Li, Jing Bao, Jiu Jiu, Li Dui, Liu Liu, Miao Yin, Shun Shun, Wen Hui, Xiao He Tao and female Xing Ya now have three direct records, eight categories and score -20. All twenty remain multi-source.
- Updated the rounds1207-1226 coverage assertion for Liu Liu and Shun Shun and rounds1227-1246 for seven Subjects enriched by this slice. Untouched historical Subjects retain exact expectations.
- Focused rounds1467-1486 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 118/118.
- Full local research suite — PASS: 1,172/1,172. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 3,097 files, 778 Subject IDs, 2,726 normalized name keys, 10,433 record IDs, 9,479 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1486 contain 1,296 batches, 1,500 source-row declarations, 1,245 distinct source IDs, 3,601 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with An An's 2023 Cub A, An An's 2023 Cub B, Du Du, He He (Ge Ge offspring), Lan Zai, Bing Zai, Can Can's cub, Feng Yi, He He (Shenshuping) and Nong Nong, followed by Sen Sen, Shui Xiu, Tai Shan, Fu Wa, Oreo, Hui Hui, Qi Xi, Run Yang, Xian Xian and Xiang Bing.
- npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path. No connector or generation failure affected this slice.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-01 — Direct category depth rounds1487-1506

### Twenty-third depth slice
- Added twenty non-Pandapia direct records for An An's 2023 older and younger cubs, Du Du, female He He from Ge Ge's 2015 litter, Lan Zai, Bing Zai, Can Can's photographed cub, Feng Yi, male He He at Shenshuping, Nong Nong, Sen Sen, Shui Xiu, Tai Shan, Fu Wa at Mianyang, Oreo, Hui Hui, Qi Xi, Run Yang, Xian Xian and Xiang Bing.
- Generated exactly 20 batches, 20 source-row declarations, 18 distinct source IDs, 18 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Two shared pages retain separately reviewed Subject rows.
- Record distribution: six location, six sex, two health, two growth-measurement, one reproduction, one identity, one survival and one transfer record. Eight government, state-media or image-specific records are high confidence; twelve specialist records remain medium confidence.
- An An's two 2023 cubs gain bounded health records: both cubs were healthy and each exceeded 5 kg, while individual sex and exact individual weight remain unassigned. Can Can's photographed cub gains a Shenshuping location record while remaining unresolved between Can Yang and Qing Yang.
- Du Du, Lan Zai, Feng Yi, Nong Nong, Sen Sen and Qi Xi gain direct sex depth. Bing Zai and the male He He at Shenshuping gain direct birth weights of 148.2 g and 215 g respectively.
- The 2015 female He He gains a Ya'an Bifengxia birth-location record while remaining separate from the adult male Shenshuping namesake. Run Yang and Oreo gain Chengdu birth-location depth, Shui Xiu gains a dated Shenshuping location record, and Xiang Bing gains a Sunshine nursery location record without inferring the unidentified juvenile's identity or maternity.
- Tai Shan gains an independent Xinhua reproduction record limited to the statement that he had offspring by April 2022; no offspring names or dates are invented. This removes Tai Shan's single-source status. Oreo's independent annual-table record likewise removes its single-source status.
- Fu Wa's image-specific Mianyang caption is retained as a bounded identity record and is not merged with Ke Lin's female twin of the same name. Hui Hui is recorded as the sole surviving member of Xi Mei's 2005 twin litter without constructing a name for the deceased cub. Xian Xian's movement remains a transfer between training stages rather than a release assertion.
- Annual-table row order is not used to infer birth order. Existing birth, relationship, training, public-debut and profile records are not overwritten. No source adds, replaces or reclassifies media.
- The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1487-1506.json`.

### Coverage and verification
- An An's two cubs, Du Du, female He He and Lan Zai now have three direct records, eight categories and score -20.
- Bing Zai, Can Can's cub, Feng Yi, male He He, Nong Nong, Sen Sen and Shui Xiu now have five direct records, five categories and score -20.
- Tai Shan now has seven direct records, two source families, seven categories and score -25. Oreo now has six direct records, two source families, six categories and score -25. Neither remains single-source.
- Fu Wa now has seven direct records, three source families, five categories and score -21. Hui Hui, Qi Xi, Run Yang, Xian Xian and Xiang Bing each now have two direct records, two source families, ten categories and score -21.
- Updated the rounds1227-1246 coverage assertion only for female He He, the final Subject from that historical slice enriched by later work. Untouched historical Subjects retain exact expectations.
- Focused rounds1487-1506 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 74/74; the final historical-plus-focused rerun passed 19/19 after the scoped assertion update.
- Full local research suite — PASS: 1,180/1,180. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 3,137 files, 778 Subject IDs, 2,726 normalized name keys, 10,453 record IDs, 9,499 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1506 contain 1,316 batches, 1,520 source-row declarations, 1,263 distinct source IDs, 3,621 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Xiang Shan, Ai Bang's 2016 Cub 66, Ai Jiu, Ai Le, Ai Lin, Ai Mi, Ai Si, An An's 2022 cub, Ao Ke and Ao Ran, followed by Bao Ge, Bao Mei, Bing Cheng, Bing Xue, Bo Wen, CC, Cheng Cheng, Cheng Feng, Cheng Lang and Chu Xin.
- Two index-refresh calls returned transient connector 502 responses; reopening the same workspace restored access and the final cache-backed index check completed normally. npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-02 — Direct category depth rounds1507-1526

### Twenty-fourth depth slice
- Added twenty non-Pandapia direct records for Xiang Shan, Ai Bang's 2016 Cub 66, Ai Jiu, Ai Le, Ai Lin, Ai Mi, Ai Si, An An's 2022 cub, Ao Ke, Ao Ran, Bao Ge, Bao Mei, Bing Cheng, Bing Xue, Bo Wen, CC, Cheng Cheng, Cheng Feng, Cheng Lang and Chu Xin.
- Generated exactly 20 batches, 20 source-row declarations, 10 distinct source IDs, 10 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Five shared pages retain separately reviewed Subject rows.
- Record distribution: eleven location and nine growth-measurement records. Xinhua's separately timed and weighted Bao Ge and Bao Mei rows are high confidence; eighteen annual-registry or specialist-life records remain medium confidence.
- Xiang Shan, Ai Lin, Ai Si and CC gain Chengdu birth-location depth. Ao Ke, Ao Ran, Bing Xue and Bo Wen gain Gengda Shenshuping birth-location depth. Bing Cheng gains Ya'an Bifengxia depth and Cheng Cheng gains Chengdu Zoological Garden depth.
- Ai Le gains a Louguantai birth-location record from an unnamed annual-table row linked only through exact date, mother and male sex; the source does not supply the final name. Ai Bang's 2016 cub likewise retains the local bounded identifier while the source-specific form Ai Liu does not overwrite a final name.
- Direct birth weights added: Ai Bang's 2016 cub 145 g, Ai Jiu 219 g, Ai Mi 163.8 g, An An's 2022 cub 132.8 g, Bao Ge 211.6 g, Bao Mei 209 g, Cheng Feng 171.9 g, Cheng Lang 42.8 g and Chu Xin 120.6 g.
- Bao Mei remains separated from other same-name Subjects through birth time, sex, weight and maternity. An An's 2022 cub remains unnamed in the annual table and is not merged with unrelated An An Subjects.
- Annual-table row order is not used to infer birth order for Ao Ke, Ao Ran, Bo Wen, CC, Cheng Feng or Cheng Lang. Chu Xin's institution precision remains at CCRCGP level without an invented sub-base.
- Existing birth, identity, relationship, behaviour, care, breeding and milestone records are not overwritten. No source adds, replaces or reclassifies media.
- The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1507-1526.json`.

### Coverage and verification
- Xiang Shan now has two direct records, two source families, ten categories and score -21.
- The other nineteen targets now have four direct records, seven categories and score -21. Ai Le, Ai Mi and Cheng Cheng have three source families; the other sixteen retain two. All twenty remain multi-source.
- Updated the rounds1247-1266 coverage assertion only for the eighteen Subjects enriched by this slice and rounds1267-1286 only for Chu Xin. Untouched historical Subjects retain exact expectations.
- Focused rounds1507-1526 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 63/63.
- Full local research suite — PASS: 1,188/1,188. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 3,177 files, 778 Subject IDs, 2,726 normalized name keys, 10,473 record IDs, 9,519 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1526 contain 1,336 batches, 1,540 source-row declarations, 1,273 distinct source IDs, 3,641 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Chun Chun, Chun Hui, Chun Lai, Da Ni, Fu Sheng, Han Han, Hua Ao, Hua Long, Hua Rong and Ji Fu, followed by Ji Li, Ji You, Jiao Xiao, Jiao Yang, Jin Baobao, Jin Jin, Jin Rui, Ling Zhu, Liu Yi and Lun Wen.
- npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path. No connector or generation failure affected this slice.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-02 — Direct category depth rounds1527-1546

### Twenty-fifth depth slice
- Added twenty non-Pandapia direct records for Chun Chun, Chun Hui, Chun Lai, Da Ni, Fu Sheng, Han Han, Hua Ao, Hua Long, Hua Rong, Ji Fu, Ji Li, Ji You, Jiao Xiao, Jiao Yang, Jin Baobao, Jin Jin, Jin Rui, Ling Zhu, Liu Yi and Lun Wen.
- Generated exactly 20 batches, 20 source-row declarations, 15 distinct source IDs, 15 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Three shared annual pages retain separately reviewed Subject rows.
- Record distribution: sixteen location, two growth-measurement and two transfer records. Xinhua's unique exact Ling Lang maternal birth event is high confidence; nineteen annual-registry, public-history or specialist-life records remain medium confidence.
- Chun Chun, Fu Sheng, Ji Li, Ji You, Jiao Xiao, Jiao Yang, Jin Rui, Liu Yi and Lun Wen gain Chengdu birth-location depth. Chun Hui and Chun Lai gain Gengda Shenshuping depth. Han Han, Hua Ao, Hua Long and Jin Baobao gain Ya'an Bifengxia depth.
- Da Ni gains a direct birth weight of 145.6 g. Ji Fu gains 270.4 g while retaining the unresolved 2022-08-05 versus 2022-08-06 birth-date conflict.
- Hua Rong gains a February 2017 transfer from Shenshuping Base to the Qingshen International Bamboo Art City panda house; the source provides month precision only, so no day is invented.
- Jin Jin gains an April 1986 Sweden loan and August 1986 return to Chengdu Zoological Garden, both retained at month precision.
- Ling Zhu gains Wolong Shenshuping birth-location depth from Ling Lang's unique exact 2025-06-21 23:50 maternal event. The Xinhua page itself leaves the cub unnamed and does not state sex; the later name remains bound only through the unique event.
- Chun Chun's conflicting birth-order descriptions remain unresolved. Annual-table row order is not used to infer birth order, and cross-date litter contexts are not strengthened into unsupported timing claims.
- Existing birth, identity, relationship, behaviour, breeding, programme and reproduction records are not overwritten. No source adds, replaces or reclassifies media.
- The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1527-1546.json`.

### Coverage and verification
- All twenty targets now have four direct records, seven categories and score -21. Hua Rong, Jin Jin and Ling Zhu have three source families; the other seventeen retain two. All twenty remain multi-source.
- Updated the rounds1267-1286 coverage assertion only for the seventeen Subjects enriched by this slice plus previously enriched Chu Xin, and rounds1287-1306 only for Ling Zhu, Liu Yi and Lun Wen. Untouched historical Subjects retain exact expectations.
- Focused rounds1527-1546 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 52/52.
- Full local research suite — PASS: 1,196/1,196. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 3,217 files, 778 Subject IDs, 2,726 normalized name keys, 10,493 record IDs, 9,539 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1546 contain 1,356 batches, 1,560 source-row declarations, 1,288 distinct source IDs, 3,661 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Lun Wu, Lv Di, Mei Ling, Ni Ni, 99, Ning Ning, Olympia, Qi Qiao, Qing Chong Yang and Qing Zai, followed by Qing Zhu Yu, Rong Sheng, Ru Ru, Run Jiu, Run Ze, Sa Er, Shan Hu, Shu Hui, Shu Lan and Shuang Hao.
- npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path. Web lookup was used only to verify the Hua Rong transfer feature and Jin Jin's dated movement sequence; repository output remains local-only.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-02 — Direct category depth rounds1547-1566

### Twenty-sixth depth slice
- Added twenty non-Pandapia direct records for Lun Wu, Lv Di, Mei Ling, Ni Ni, 99, Ning Ning, Olympia, Qi Qiao, Qing Chong Yang, Qing Zai, Qing Zhu Yu, Rong Sheng, Ru Ru, Run Jiu, Run Ze, Sa Er, Shan Hu, Shu Hui, Shu Lan and Shuang Hao.
- Generated exactly 20 batches, 20 source-row declarations, 14 distinct source IDs, 14 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Four shared annual pages retain separately reviewed Subject rows.
- Record distribution: fourteen location, three growth-measurement, one transfer, one reproduction and one sex record. Government or state-media records for Mei Ling, Rong Sheng and Shu Lan are high confidence; seventeen annual-registry, public-history or historical-feature records remain medium confidence.
- Lun Wu, Ni Ni, 99, Qing Chong Yang, Qing Zai, Qing Zhu Yu, Run Ze, Sa Er, Shu Lan and Shuang Hao gain Chengdu location depth. Ning Ning, Ru Ru and Shan Hu gain Ya'an Bifengxia depth; Shu Hui gains Hetaoping depth.
- Lv Di gains a direct birth weight of 137 g and Run Jiu gains 151.8 g. Rong Sheng gains a 33-day age measurement from an archival caption; no physical measurement is invented.
- Mei Ling gains a 2025-11-04 transfer to CCRCGP Mianyang Base. The government source gives Shenshuping and Dujiangyan only as collective cohort origins, so no individual origin is assigned.
- Olympia gains a reproduction record for daughter Ke Nian / Gong Zhu, born 2022-06-22 at Chengdu Research Base.
- Qi Qiao gains direct female-sex depth while the 七巧/奇巧 forms, erroneous 毛妹 parenthetical and cross-midnight birth-order ambiguity remain unresolved.
- Qing Zai's Wangyue Pavilion residence is retained only as a maintained-source snapshot. Ning Ning's individual cross-date assignment remains unresolved, and annual-table adjacency is not used to infer stronger twin terminology.
- Existing birth, identity, relationship, behaviour, care, programme and lineage records are not overwritten. No source adds, replaces or reclassifies media.
- The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1547-1566.json`.

### Coverage and verification
- All twenty targets now have four direct records, seven categories and score -21. Mei Ling, Olympia and Qing Zai have three source families; the other seventeen retain two. All twenty remain multi-source.
- Updated the rounds1287-1306 coverage assertion only for the fifteen Subjects enriched by this slice plus its three previously enriched Subjects, and rounds1307-1326 only for Shan Hu, Shu Hui, Shu Lan and Shuang Hao. Untouched historical Subjects retain exact expectations.
- Focused rounds1547-1566 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 52/52.
- Full local research suite — PASS: 1,204/1,204. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 3,257 files, 778 Subject IDs, 2,726 normalized name keys, 10,513 record IDs, 9,559 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1566 contain 1,376 batches, 1,580 source-row declarations, 1,302 distinct source IDs, 3,681 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Su Lin's 2019 Cub A, Su Xing, Su Yang, Ting Ting, Ting Zai, Wei Wei, Xiao Jiao, Xiao Ni, Xiao Qiao and Xiao Shuang, followed by Xiao Ya, Xin Yue, Xing An, Xing Fan, Xing Qing, Xing Yu, Xing Yuan, Xing Yun, Xiu Xiu and Ya Er.
- A transient connector 502 occurred while writing the focused test file. Reopening the same workspace restored normal access; the test file was then written through the workspace command runner and all validations passed.
- npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-02 — Direct category depth rounds1567-1586

### Twenty-seventh depth slice
- Added twenty non-Pandapia direct records for Su Lin's 2019 Cub A, Su Xing, Su Yang, Ting Ting, Ting Zai, Wei Wei, Xiao Jiao, Xiao Ni, Xiao Qiao, Xiao Shuang, Xiao Ya, Xin Yue, Xing An, Xing Fan, Xing Qing, Xing Yu, Xing Yuan, Xing Yun, Xiu Xiu and Ya Er.
- Generated exactly 20 batches, 20 source-row declarations, 15 distinct source IDs, 15 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Four shared pages retain separately reviewed Subject rows.
- Record distribution: fourteen location, three growth-measurement, two transfer and one lineage record. CCTV, Huzhou municipal-government and Suzhou municipal-government records are high confidence; seventeen annual-registry, field-history or specialist records remain medium confidence.
- Su Lin's 2019 older cub and Su Yang gain Hetaoping birth-location depth. Su Xing gains a March 2024 Bright Moon pavilion observation snapshot. Ting Ting and Wei Wei gain Wolong research-centre institution depth without invented sub-base precision.
- Ting Zai gains a dated Guangzhou Chimelong first-public-appearance location. The event location is not used to rewrite birthplace.
- Xiao Ni gains a direct birth weight of 204.1 g, Xiao Ya gains 138.2 g and Xing Fan gains 89.4 g.
- Xiao Jiao gains a transfer to Anji Bamboo Expo Garden. The municipal report's previous-day wording maps to 2012-04-13, while the existing profile gives 2012-04-12; the one-day discrepancy remains unresolved.
- Xin Yue gains an exact 2011-09-07 transfer from Ya'an Bifengxia Base to Suzhou Taihu National Wetland Park with Zhu Yun.
- Xiao Shuang gains maternal-line depth as one of Qing Qing's thirteen documented cubs, without inferring birth order from roster placement.
- Xiao Qiao, Xing Qing, Xing Yu, Xing Yuan, Xing Yun and Ya Er gain Chengdu location depth; Xing An gains Gengda Shenshuping depth; Xiu Xiu gains Wolong institution depth.
- The descriptive Subject for Su Lin's older 2019 cub retains its source/profile sex conflict. Ting Ting and Wei Wei retain their cross-profile birth-order conflict. Chengdu mother-name boundaries for 娅星 and 星雅 remain separate from Shenshuping 雅星 and the male xing-ya Subject.
- Existing birth, identity, relationship, appearance, behaviour, death and migration records are not overwritten. No source adds, replaces or reclassifies media.
- The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1567-1586.json`.

### Coverage and verification
- All twenty targets now have four direct records, seven categories and score -21. Xiao Jiao and Xin Yue have three source families; the other eighteen retain two. All twenty remain multi-source.
- Updated the rounds1307-1326 coverage assertion only for the fourteen Subjects enriched by this slice plus its four previously enriched Subjects, and rounds1327-1346 only for Xing Qing, Xing Yu, Xing Yuan, Xing Yun, Xiu Xiu and Ya Er. Untouched historical Subjects retain exact expectations.
- Focused rounds1567-1586 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 41/41.
- Full local research suite — PASS: 1,212/1,212. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 3,297 files, 778 Subject IDs, 2,726 normalized name keys, 10,533 record IDs, 9,579 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1586 contain 1,396 batches, 1,600 source-row declarations, 1,317 distinct source IDs, 3,701 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Ya Song, Ya Wen, Ya Yi, Yang Hu, Ye Ye, Yin Ke, Ying Xue, You Bang, Yuan Run and Chengdu Yuan Yuan, followed by Yun Wen, Yun Wu, Yun Yun, Zhao Yang, Zhen Lan, Zheng Zai, Zhi Ma, Zhi Yu, Zhu Hai and Zhu Ling.
- npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path. Web lookup was used only to verify the Huzhou Xiao Jiao transfer wording and the Suzhou Xin Yue settlement date; repository output remains local-only.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-02 — Direct category depth rounds1587-1606

### Twenty-eighth depth slice
- Added twenty non-Pandapia direct records for Ya Song, Ya Wen, Ya Yi, Yang Hu, Ye Ye, Yin Ke, Ying Xue, You Bang, Yuan Run, Chengdu Yuan Yuan, Yun Wen, Yun Wu, Yun Yun, Zhao Yang, Zhen Lan, Zheng Zai, Zhi Ma, Zhi Yu, Zhu Hai and Zhu Ling.
- Generated exactly 20 batches, 20 source-row declarations, 17 distinct source IDs, 17 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Three shared annual pages retain separately reviewed Subject rows.
- Record distribution: fifteen location, four growth-measurement and one care record. China News Service's Ye Ye care report and Hunan Today's Zhao Yang facility profile are high confidence; eighteen annual-registry, field-history or specialist-profile records remain medium confidence.
- Ya Song, Ya Yi, Yuan Run and Chengdu Yuan Yuan gain Chengdu birth-location depth. Ya Wen gains Gengda Shenshuping depth; Yang Hu, Yin Ke and Yun Yun gain Ya'an Bifengxia depth; You Bang gains Adventure World Shirahama depth.
- Ying Xue gains a direct birth weight of 167 g, Yun Wen gains 135.3 g, Yun Wu gains 148.8 g and Zhi Ma gains 110.7 g.
- Ye Ye gains post-birth care depth: the unnamed female cub was born at 06:41 weighing 179.6 g, Ye Ye cared for the cub well and the cub received colostrum. The unnamed cub is not automatically merged with a later named Subject.
- Zhao Yang gains a source-time location snapshot at pavilion 4 of Yueyang Chinese Giant Panda Garden. Zhen Lan gains a 2025-04-11 Gengda Shenshuping observation, and Zhi Yu / Zi Yu gains an Xinghan pavilion F5 cohort snapshot.
- Zheng Zai retains only institution-level China Conservation and Research Centre for the Giant Panda location precision; no sub-base is invented.
- Zhu Hai and Zhu Ling gain broad Wolong birth-location depth from Panda News profiles using studbook, date, sex and mother anchors. Zhu Hai's conflicting death-date assertion is not imported.
- Ya Wen, Ya Yi, Yun Wen, Yun Wu and Zhi Ma retain unresolved birth order where table order or profile wording is insufficient. You Bang's source romanisation forms remain source-specific, and Chengdu Yuan Yuan remains separate from Taipei or Vienna same-romanisation Subjects.
- Existing birth, identity, relationship, death, breeding, release, movement and public-activity records are not overwritten. No source adds, replaces or reclassifies media.
- The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1587-1606.json`.

### Coverage and verification
- All twenty targets now have four direct records, seven categories and score -21. Yang Hu, Zhu Hai and Zhu Ling have three source families; the other seventeen retain two. All twenty remain multi-source.
- Updated rounds1187-1206 only for Yang Hu, rounds1327-1346 only for the ten Subjects enriched by this slice plus its six previously enriched Subjects, and rounds1347-1366 only for the nine Subjects enriched by this slice. Untouched historical Subjects retain exact expectations.
- Focused rounds1587-1606 verification — PASS: 9/9 before and after deterministic rerun. Related current and historical verification — PASS: 64/64.
- Full local research suite — PASS: 1,221/1,221. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 3,337 files, 778 Subject IDs, 2,726 normalized name keys, 10,553 record IDs, 9,599 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1606 contain 1,416 batches, 1,620 source-row declarations, 1,334 distinct source IDs, 3,721 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Zhuang Mei, Zi Lin, Zi Lu, Zi Su, Ai Lian, Da Shuang, Fu Wa, Lan Bao, Lin Yang and Lu Lu, followed by Qi Ji, Quan Mei, Shan Zai, Sheng Lan, Xi Qing, Yu Lei, Yuan Lin, Yuan Zhou, Yun Hui and Zhan Wang.
- The workspace connector returned several transient 502 responses at session start and recovered without repository changes. npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path.
- Web lookup and direct page verification were used to check annual-table rows and the Panda News Zhu Hai / Zhu Ling profiles; repository output remains local-only.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-02 — Direct category depth rounds1607-1626

### Twenty-ninth depth slice
- Added twenty non-Pandapia direct records for Zhuang Mei, Zi Lin, Zi Lu, Zi Su, Ai Lian, Da Shuang, Fu Wa, Lan Bao, Lin Yang, Lu Lu, Qi Ji, Quan Mei, Shan Zai, Sheng Lan, Xi Qing, Yu Lei, Yuan Lin, Yuan Zhou, Yun Hui and Zhan Wang.
- Generated exactly 20 batches, 20 source-row declarations, 15 distinct source IDs, 15 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Four shared pages retain separately reviewed Subject rows.
- Record distribution: ten location, nine growth-measurement and one death record. Six state, government, regional or mainstream media records are high confidence; fourteen annual-registry, field-history or specialist-profile records remain medium confidence.
- Zhuang Mei gains Ya'an Bifengxia birth-location depth while retaining the cross-date litter with Ning Ning. Zi Lu, Da Shuang, Yuan Lin and Yuan Zhou gain Chengdu birth-location depth.
- Ai Lian gains a dated 2024-01-18 Xinhua location snapshot at the Chongqing Yongchuan Lehe Ledu panda pavilion. Lin Yang gains broad Wolong birth-location depth, Quan Mei gains Chengdu Zoological Garden depth and Yu Lei gains Gengda Shenshuping depth.
- Zhan Wang receives institution-level China Conservation and Research Centre for the Giant Panda location precision only; the annual table marks the specific sub-base unknown.
- Zi Lin gains a birth-weight lower bound above 170 g and Zi Su above 140 g. The merged 4-5 July litter cell is not used to assign individual dates or birth order.
- Fu Wa gains a direct birth weight of 70 g, Lan Bao 147 g, Lu Lu 125 g, Dai Dai / Shan Zai 107 g and Sheng Lan 120.7 g.
- Qi Ji gains the official female-cub weight of 137 g and Xi Qing the official male-cub weight of 110 g. Mapping uses the government sex-specific values plus previously reviewed reciprocal mixed-sex twin profiles and does not create a new birth-order inference.
- Yun Hui gains a month-level death record for January 2015 at Shanghai Wild Animal Park, with pathological diagnosis chronic severe hepatitis. The source does not provide an exact death date.
- Ai Lian and Da Shuang each gain a sixth direct fact and a fourth category; all other targets move to four direct records across seven categories.
- Sheng Lan's new measurement remains attached to `sheng-lan-zhenzhen-twin-2021` and does not merge the duplicate `sheng-lan-shenshuping` Subject. Fu Wa remains separate from same-name pandas, Dai Dai / Shan Zai name forms remain unresolved, and Quan Mei remains distinct from Shu Lan's historical alias.
- Existing birth, identity, relationship, medical, reproduction, migration, behaviour and public-activity records are not overwritten. No source adds, replaces or reclassifies media.
- The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1607-1626.json`.

### Coverage and verification
- All twenty targets now have score -21. Eighteen have four direct records and seven categories; Ai Lian and Da Shuang have six direct records and four categories. All remain multi-source.
- Source-family distribution after enrichment: three targets have two sources, eleven have three sources and six have four sources.
- Updated rounds1267-1286 only for Fu Wa; rounds1287-1306 only for Lan Bao and Lu Lu; rounds1307-1326 only for Shan Zai and Sheng Lan; rounds1327-1346 only for Yu Lei, Yuan Lin, Yuan Zhou and Yun Hui; and rounds1347-1366 only for Zhan Wang, Zhuang Mei, Zi Lin, Zi Lu and Zi Su. Untouched historical Subjects retain exact expectations.
- Focused rounds1607-1626 verification — PASS: 9/9 before and after deterministic rerun. Related current and historical verification — PASS: 97/97.
- Full local research suite — PASS: 1,230/1,230. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 3,377 files, 778 Subject IDs, 2,726 normalized name keys, 10,573 record IDs, 9,619 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1626 contain 1,436 batches, 1,640 source-row declarations, 1,349 distinct source IDs, 3,741 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Hai Hai, Lao Lao, Mei Zhu, Si Jun Jun and Si Nian, followed by Fu Duo Duo, Mei Mei as Qi Yuan's mother, Ai Bang, Bing Dian, Gong Zai, Guai Guai, He Sheng, He Yu, Jiao Zi, Jin Shuang, Jun Zu, Ke Yu, Chengdu founder Mei Mei, Nan Xiao Yue and Nao Nao.
- npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path. Web lookup and direct page verification were used for the Da Shuang, Zi Lu, Lin Yang and Quan Mei source boundaries; repository output remains local-only.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-02 — Direct category depth rounds1627-1646

### Thirtieth depth slice
- Added twenty non-Pandapia direct records for Hai Hai, Lao Lao, Mei Zhu, Si Jun Jun, Si Nian, Fu Duo Duo, Mei Mei as Qi Yuan's mother, Ai Bang, Bing Dian, Gong Zai, Guai Guai, He Sheng, He Yu, Jiao Zi, Jin Shuang, Jun Zu, Ke Yu, Chengdu founder Mei Mei, Nan Xiao Yue and Nao Nao.
- Generated exactly 20 batches, 20 source-row declarations, 17 distinct source IDs, 17 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Three shared annual pages retain separately reviewed Subject rows.
- Record distribution: thirteen location and seven growth-measurement records. All twenty remain medium confidence because the sources are specialist annual registries or specialist studbook transcriptions rather than primary holder registries.
- Hai Hai gains a direct birth weight of 170 g and Lao Lao 159 g. The unresolved maternal-name forms Lin Ping / Lin Bing and birth-order uncertainty remain unchanged.
- Mei Zhu gains a direct birth weight of 178 g, Si Jun Jun 180.4 g, Si Nian 174.1 g, Fu Duo Duo 187.6 g and He Yu 152.8 g.
- Si Jun Jun retains the local romanization while Si Yun Yun remains source-specific. Mei Zhu's source nickname Mei Zhu / 妹猪 remains a variant rather than a second Subject.
- Mei Mei studbook 408 gains Chengdu Zoological Garden birth-location depth and remains separate from Chengdu founder Mei Mei studbook 152. The founder gains an undated Meigu County to Chengdu Zoo to Zhuhai and back to Chengdu location sequence.
- Ai Bang / Ai Hin gains Wakayama and Adventure World Shirahama birth-location depth. Bing Dian, Guai Guai and Jiao Zi gain Chengdu Zoological Garden depth; Gong Zai, He Sheng, Jin Shuang, Ke Yu and Nao Nao gain Chengdu Research Base depth.
- Jun Zu / Jun Zhu gains broad Wolong birth-location depth. Bing Dian and Jun Zu use only the month precision shown by their specialist profiles and do not overwrite existing day-level dates.
- Guai Guai's specialist profile displays no birth or death date, so neither is invented. He Sheng's annual row supplies location but no birth weight.
- Nan Xiao Yue retains institution-level China Conservation and Research Centre for the Giant Panda precision; later Shenshuping breeding is not used to backfill the 2018 birth sub-base.
- Nao Nao's same-date maternal relationship with Chao Chao is not automatically promoted to twin status, and no birth order is inferred.
- Existing birth, identity, relationship, reproduction, release, training, behaviour, appearance and public-activity records are not overwritten. No source adds, replaces or reclassifies media.
- The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1627-1646.json`.

### Coverage and verification
- Hai Hai, Lao Lao, Mei Zhu, Si Jun Jun and Si Nian now have four direct records, four source families, seven categories and score -21.
- Fu Duo Duo now has six direct records, four source families, seven categories and score -22. Mei Mei as Qi Yuan's mother now has seven direct records, two source families, five categories and score -26.
- Ai Bang, Bing Dian, Guai Guai, Jiao Zi, Jun Zu and Chengdu founder Mei Mei now have three direct records, three source families, nine categories and score -22. Gong Zai, He Sheng, He Yu, Jin Shuang, Ke Yu, Nan Xiao Yue and Nao Nao have three direct records, two source families, nine categories and score -22.
- Updated rounds1187-1206 only for Si Jun Jun, Si Nian, Fu Duo Duo and Guai Guai; rounds1347-1366 only for Hai Hai and Lao Lao; rounds1367-1386 only for the eleven Subjects enriched by this slice; and rounds1387-1406 only for Nan Xiao Yue and Nao Nao. Untouched historical Subjects retain exact expectations.
- Focused rounds1627-1646 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 85/85.
- Full local research suite — PASS: 1,238/1,238. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 3,417 files, 778 Subject IDs, 2,726 normalized name keys, 10,593 record IDs, 9,639 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1646 contain 1,456 batches, 1,660 source-row declarations, 1,366 distinct source IDs, 3,761 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Nuo Mi, Qing Qing, Shuang Qing, Wen Wen, Wen Xi, Xiao Bao, Ya Yun, Zhi Zhi, Chengdu Qian Qian and Ba Xi, followed by Chao Chao, Cheng Ji, Lang Lang, Pan Yue, Cheng Shuang, Ke Lin, Miao Miao, Chengdu Bing Bing, Bazi and Huan Cai.
- npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path. Direct page verification was used for the annual-table rows and the Panda News studbook profiles; repository output remains local-only.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-02 — Direct category depth rounds1647-1666

### Thirty-first depth slice
- Added twenty non-Pandapia direct records for Nuo Mi, Qing Qing, Shuang Qing, Wen Wen, Wen Xi, Xiao Bao, Ya Yun, Zhi Zhi, Chengdu Qian Qian, Ba Xi, Chao Chao, Cheng Ji, Lang Lang, Pan Yue, Cheng Shuang, Ke Lin, Miao Miao, Chengdu Bing Bing, Bazi and Huan Cai.
- Generated exactly 20 batches, 20 source-row declarations, 15 distinct source IDs, 15 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Three annual pages are shared across separately reviewed Subject rows.
- Record distribution: fifteen location, four birth and one growth-measurement record. All twenty remain medium confidence because selected evidence comes from specialist annual registries, specialist studbook transcriptions or a bounded specialist breeding history.
- Nuo Mi gains Gengda Shenshuping birth-location depth. Shuang Qing, Wen Wen, Wen Xi, Zhi Zhi, Chao Chao, Cheng Shuang, Miao Miao and Huan Cai gain Chengdu birth-location depth.
- Xiao Bao gains Gengda Shenshuping birth-location depth while retaining the source's 9 August with 8 August uncertainty. Ba Xi gains Hetaoping birth-location depth and Pan Yue gains Ya'an Bifengxia birth-location depth; neither annual row reports a birth weight.
- Qing Qing gains broad Wolong birth-location depth through studbook 479. The source form Qin Qin / 亲亲 does not overwrite local Qing Qing / 青青, and the source's month-only birth and empty death fields do not override existing records.
- Ya Yun gains a direct birth weight of 113 g. The annual-table order is not used to infer birth order against Ya Zhu.
- Chengdu Qian Qian gains a dated 2013-08-06 Chengdu birth bundle with mother Da Jiao and same-litter Nan Nan. She remains separate from Ya'an Qian Qian.
- Cheng Ji gains Chengdu Zoological Garden birth-location depth through studbook 523. The existing cross-midnight litter detail remains unchanged.
- Lang Lang gains broad Wolong birth-location depth through studbook 642. The profile's 2010-12-18 death date conflicts with the existing mainstream-media 2010-12-16 record and is not used to overwrite it.
- Ke Lin gains a dated 2007-08-13 Chengdu birth bundle with mother Jiao Zi and bounded surviving-female-cub context; no birth order is inferred. Cheng Shuang and Miao Miao gain biological-mother birth bundles while Li Li remains foster mother only.
- Chengdu Bing Bing gains Chengdu Zoological Garden birth-location depth through studbook 314. Only August 1986 precision is imported from the selected profile, and the Subject remains separate from the 2015 Dujiangyan Bing Bing.
- Bazi gains a second source family and a Louguantai birth-location record. The annual-table date 2021-07-16 is retained as a specialist-table value but is not promoted above the official forestry response's July 2021 precision.
- Huan Cai gains Chengdu birth-location depth while preserving the existing exact death-time record; the annual table only contributes the date annotation.
- Existing identity, relationship, reproduction, medical, death, transfer, adoption, behaviour and foster-care records are not overwritten. No source adds, replaces or reclassifies media.
- The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1647-1666.json`.

### Coverage and verification
- Nuo Mi, Shuang Qing, Wen Wen, Wen Xi, Xiao Bao, Ya Yun and Zhi Zhi now have three direct records, two source families, nine categories and score -22.
- Qing Qing, Ba Xi, Chao Chao and Pan Yue now have three direct records, three source families, nine categories and score -22. Cheng Ji and Lang Lang have three direct records, four source families, nine categories and score -22; Chengdu Bing Bing has three direct records, five source families, nine categories and score -22.
- Chengdu Qian Qian now has five direct records, three source families, six categories and score -22. Cheng Shuang, Ke Lin and Miao Miao each have five direct records, four source families, six categories and score -22.
- Bazi now has six direct records, two source families, seven categories and score -27. Huan Cai has two direct records, two source families, eleven categories and score -23.
- Updated rounds1187-1206 only for Chao Chao; rounds1207-1226 only for Pan Yue; rounds1367-1386 only for Ba Xi, Cheng Ji and Lang Lang; and rounds1387-1406 only for the twelve Subjects enriched by this slice. Untouched historical Subjects retain exact expectations.
- Focused rounds1647-1666 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 74/74.
- Full local research suite — PASS: 1,246/1,246. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 3,457 files, 778 Subject IDs, 2,726 normalized name keys, 10,613 record IDs, 9,659 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1666 contain 1,476 batches, 1,680 source-row declarations, 1,381 distinct source IDs, 3,781 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Su Su, Ao Ao, Bao Quan, Jin Yu and Bei Chen, followed by Cui Cui of the Wuhan lineage, Er Qiao, Happy, Qing He, Tuan Zi, Yao Man, Cai Yun, Cheng Da, Can Yang, Hua Yang, Xiao Yatou, Qin Hua, Shuang Er, Shuang Xiong and Xing Chen.
- The workspace connector returned several transient 502 responses during source review and recovered without repository changes. npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-03 — Direct category depth rounds1667-1686

### Thirty-second depth slice
- Added twenty direct records for Su Su, Ao Ao, Bao Quan, Jin Yu, Bei Chen, Wuhan-lineage Cui Cui, Er Qiao, Happy, Qing He, Tuan Zi, Yao Man, Cai Yun, Cheng Da, Can Yang, Hua Yang, Xiao Yatou, Qin Hua, Shuang Er, Shuang Xiong and Xing Chen.
- Generated exactly 20 batches, 20 source-row declarations, 18 distinct source IDs, 18 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Two annual pages are shared across separately reviewed Subject rows.
- Record distribution: nine location, seven birth, two growth-measurement, one rescue and one lineage record. Five records are high confidence and fifteen medium confidence.
- Su Su gains a direct 1986 wild-rescue year from CCTV's holder disclosure. The source does not strengthen the precise rescue month, county or destination.
- Ao Ao gains a dated 2001-07-12 birth bundle with mother Li Li and twin Shen Shen. The source only states that both cubs died within weeks and does not overwrite an exact death date or infer birth order.
- Bao Quan gains a bounded displayed maternal-lineage bundle with mother Yang Hua and older siblings Pan Yue and Xing Xing. The profile is not used to bind unnamed 2019 annual-table cubs or infer paternity.
- Jin Yu gains a direct birth weight of 186 g and Qin Hua 167 g. Qin Hua's source also retains the 2020-10-11 09:31 birth-time anchor.
- Bei Chen gains a dated 2022-07-10 Chengdu birth bundle with mother Bei Chuan and source nickname Chuan Da. Birth order against Bei Xia / Chuan Xiao is not inferred.
- Wuhan-lineage Cui Cui gains a dated 2006-08-25 birth bundle with mother Ye Ye and twin Lang Lang. She remains separate from the male 2018 Cui Cui / Bora.
- Er Qiao gains a dated 2011-08-13 Chengdu birth bundle with mother Er Yatou. Source-linked Li Li and Qiao Qiao forms do not merge unrelated same-name Subjects, and no father is added.
- Happy gains a 1939 Vincennes Zoo, Paris location after the documented 1936 Berlin appearance. No birth or wild-origin inference is added.
- Qing He gains a report-time Fuzhou Panda World location anchored by offspring Qi Cheng and Qi Hang. Tuan Zi and Cai Yun gain Ya'an Bifengxia birth-location depth; Cheng Da gains Chengdu location while retaining the 15/16 August date range.
- Yao Man gains a dated 2009-09-27 Ya'an Bifengxia birth bundle with mother Guo Guo. Her same-date maternal row with Yao Xin does not establish twin status or birth order.
- Can Yang gains a dated 2024-09-10 Gengda Shenshuping birth bundle with mother Can Can and same-date Qing Yang. No birth weight or order is inferred.
- Hua Yang gains a captioned 2025-11-06 Wolong Shenshuping location. The record is source-time only and does not modify paternity boundaries.
- Xiao Yatou gains a direct studbook-635 and 2006-08-13 birth-date bundle from China News Service. The selected report does not state birthplace or parents, so none are added.
- Shuang Er, Shuang Xiong and Xing Chen gain Chengdu birth-location depth without duplicating existing 40 g, 186 g and 161 g measurements or inferring birth order.
- Existing identity, relationship, reproduction, medical, death, transfer, behaviour, public-activity and media records are not overwritten. No source adds, replaces or reclassifies media.
- The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1667-1686.json`.

### Coverage and verification
- Su Su now has two direct records, three source families, ten categories and score -21. Ao Ao has four direct records, two source families, seven categories and score -21.
- Bao Quan and Cai Yun each have four direct records, three source families, eight categories and score -23. Jin Yu has four direct records, two source families, eight categories and score -23; Cheng Da has four direct records, three source families, eight categories and score -23.
- Bei Chen, Wuhan-lineage Cui Cui, Er Qiao, Happy, Qing He and Yao Man each have six direct records, three source families, five categories and score -23. Tuan Zi has six direct records, two source families, five categories and score -23.
- Can Yang, Hua Yang and Xiao Yatou each have six direct records, four source families, five categories and score -23.
- Qin Hua now has six direct records, five source families, eight categories and score -24. Shuang Er, Shuang Xiong and Xing Chen each have three direct records, two source families, ten categories and score -24.
- Updated rounds1247-1266 only for Bao Quan; rounds1267-1286 only for Jin Yu; rounds1347-1366 only for Can Yang, Tuan Zi, Xiao Yatou and Hua Yang; rounds1387-1406 only for Shuang Er, Shuang Xiong and Xing Chen; and rounds1407-1426 only for Ao Ao, Cai Yun and Cheng Da. Untouched historical Subjects retain exact expectations.
- Focused rounds1667-1686 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 140/140.
- Full local research suite — PASS: 1,254/1,254. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 3,497 files, 778 Subject IDs, 2,726 normalized name keys, 10,633 record IDs, 9,679 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1686 contain 1,496 batches, 1,700 source-row declarations, 1,399 distinct source IDs, 3,801 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Xing Guang, Ya Zhu, Da Jiao, Fu Fu and Tao Tao, followed by Wang Yue, Ya Zhi, Yu Chen, Yue Hua, Yue Xuan, Zi Ang, Zi Shi, Chang Ning, Chang Qing, Jin Hui, Kobe, Pang Yuan, Qin Chuan, Wu Jie and Xing Rui.
- npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path. One transient connector 502 occurred during the related-test rerun and recovered without repository changes.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-03 — Direct category depth rounds1687-1706

### Thirty-third depth slice
- Added twenty direct records for Xing Guang, Ya Zhu, Da Jiao, Fu Fu, Tao Tao, Wang Yue, Ya Zhi, Yu Chen, Yue Hua, Yue Xuan, Zi Ang, Zi Shi, Chang Ning, Chang Qing, Jin Hui, Kobe, Pang Yuan, Qin Chuan, Wu Jie and Xing Rui.
- Generated exactly 20 batches, 20 source-row declarations, 18 distinct source IDs, 18 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. The 2016 and 2023 annual pages each support two separately reviewed Subject rows.
- Record distribution: nine lineage, six location, four birth and one sex record. Jin Hui's mainstream programme disclosure is high confidence; the other nineteen records remain medium confidence specialist evidence.
- Xing Guang and Ya Zhu gain Chengdu birth-location depth without duplicating their existing 170 g and 144 g measurements or inferring birth order.
- Da Jiao gains a dated 2006-08-30 Chengdu birth bundle with studbook 645, mother Jiao Zi and same-litter Jiao Xiao. The selected female profile matches local identity; a conflicting male specialist profile is explicitly not adopted.
- Fu Fu gains a dated 2001-08-25 Hetaoping birth bundle with studbook 532, mother Long Gu and same-litter Xiang Xiang. Other specialist Chinese-name forms do not overwrite local Fu Fu / 福福.
- Tao Tao gains broad Wolong birth-location depth through studbook 633. Source form 涛涛 does not overwrite local 淘淘, and the existing Si Jia twin relationship is unchanged.
- Wang Yue gains Gengda Shenshuping birth-location depth without duplicating the existing 92.4 g measurement.
- Ya Zhi gains a displayed maternal-lineage bundle with mother Ya Li and sisters Ya Zhu, Ya Yun and Ya Song. The profile's fourth-child wording and nickname Zhu Lao Si remain source-bounded.
- Yu Chen gains a displayed maternal-lineage bundle with mother Nuo Mi. The first-child wording remains profile-only and no father is inferred.
- Yue Hua and Yue Xuan gain reciprocal twin-lineage bundles with mother Nan Xiao Yue. Zi Ang and Zi Shi gain reciprocal twin-lineage bundles with mother Pan Yue and studbooks 1407 and 1406. All older/younger wording remains profile-only; Zi Ang and Zi Shi retain the annual table's institution-level CCRCGP location precision.
- Chang Ning gains Louguantai birth-location depth without duplicating the existing under-60 g bound. Chang Qing gains a direct male-sex record; no sibling birth order is inferred.
- Jin Hui gains direct paternal-lineage depth as rescued wild panda Zi Jin's only disclosed offspring through artificial insemination. The selected passage does not state the mother, so the existing Zhen Zhen record is not duplicated.
- Kobe gains Chengdu Zoological Garden birth-location depth through studbook 386. The selected profile displays no birth date, so none is invented.
- Pang Yuan gains a displayed maternal and twin-lineage bundle with Yan Hui and Xiao Bao. The profile's 8 August date and younger-twin wording do not override the annual 8/9 August uncertainty.
- Qin Chuan gains a displayed parentage bundle with Zhu Zhu and Ping Ping plus younger sister Ya Ya. The existing Chengdu versus Louguantai birthplace conflict remains unresolved.
- Wu Jie gains a dated 2007-09-14 broad-Wolong birth bundle with studbook 690 and parents Ye Ye and Wu Gang.
- Xing Rui gains a dated 2009-07-22 Ya'an Bifengxia birth bundle with studbook 746, mother Na Na and twin Xing Hui. The selected profile does not restate the father field and its younger-twin wording is not promoted.
- Existing identity, relationship, reproduction, measurement, location, behaviour, media and transfer records are not overwritten. No source adds, replaces or reclassifies media.
- The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1687-1706.json`.

### Coverage and verification
- Xing Guang and Ya Zhu now have three direct records, two source families, ten categories and score -24.
- Wang Yue has five direct records, two source families, seven categories and score -24.
- Da Jiao, Fu Fu, Tao Tao, Ya Zhi, Yu Chen, Yue Hua, Yue Xuan, Zi Ang, Zi Shi, Chang Ning and Chang Qing each have five direct records, three source families, seven categories and score -24.
- Jin Hui, Kobe, Pang Yuan, Qin Chuan and Wu Jie each have five direct records, four source families, seven categories and score -24. Xing Rui has seven direct records, four source families, four categories and score -24.
- Updated rounds1387-1406 only for Xing Guang, Ya Zhu and Wang Yue; rounds1407-1426 only for the twelve Subjects enriched by this slice. Untouched historical Subjects retain exact expectations.
- Focused rounds1687-1706 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 74/74.
- Full local research suite — PASS: 1,262/1,262. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 3,537 files, 778 Subject IDs, 2,726 normalized name keys, 10,653 record IDs, 9,699 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1706 contain 1,516 batches, 1,720 source-row declarations, 1,417 distinct source IDs, 3,821 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with early-Chengdu Qing Qing, A Bao, Mei Lan, Xi Dou's cub, Xi Lan, Chengdu founder Guo Guo, A Ling, Cheng Dui, Cheng Jiu, Cheng Lan, Cheng Shi, Chun Sheng, Da Mei, Hao Jing, Hao Yu, Hao Yue, He Mei, He Qi, Hua Yan and Ji Ran.
- The first full generator write returned one transient connector 502; the compact data-driven retry completed without repository corruption. npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-03 — Direct category depth rounds1707-1726

### Thirty-fourth depth slice
- Added twenty direct records for early-Chengdu Qing Qing, A Bao, Mei Lan, Xi Dou's cub, Xi Lan, Chengdu founder Guo Guo, A Ling, Cheng Dui, Cheng Jiu, Cheng Lan, Cheng Shi, Chun Sheng, Da Mei, Hao Jing, Hao Yu, Hao Yue, He Mei, He Qi, Hua Yan and Ji Ran.
- Generated exactly 20 batches, 20 source-row declarations, 16 distinct source IDs, 16 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Four annual pages each support two separately reviewed Subject rows.
- Record distribution: eight lineage, five location, and one each of birth, sex, growth measurement, identity, cohort, rescue and transfer. Five records are high confidence and fifteen medium confidence.
- Early-Chengdu Qing Qing gains a dated 1984-09-09 Chengdu Zoo birth bundle with studbook 278 and mother Mei Mei. The profile's death date is not imported, and the Subject remains separate from later same-name pandas.
- A Bao gains a direct female-sex record from Xinhua, including the documented correction of her early male misidentification. The record confirms the existing Po / A Bao identity revision rather than reviving the superseded assumption.
- Mei Lan gains a direct 135 g birth-weight record, bounded to the female 2016 Chengdu Subject and kept separate from the male 2006 Atlanta Mei Lan.
- Xi Dou's cub gains a relationship-bound descriptive identity from Xinhua captions. No formal name, sex or birth date is assigned.
- Xi Lan gains a Zoo Atlanta offspring-cohort record from a previously manually reviewed official retrospective. Current automated access returns a protective 403 page, which is recorded as an access boundary; no ordinal birth claim is added.
- Guo Guo gains a direct wild-rescue record as one of the female founders of Chengdu's six-panda cohort. The selected passage does not provide an exact rescue date or place.
- A Ling gains a dated 2020-05-21 transfer / assignment record to the Anshan 219 Zoo giant-panda house. No later permanent-residence inference is made.
- Cheng Dui and Cheng Jiu gain direct maternal-lineage depth to Cheng Ji. Cheng Dui's same-litter Cheng Shuang relationship is retained without birth-order inference.
- Cheng Lan and Da Mei gain Chengdu birth-location depth without duplicating their existing 160.2 g and 128.2 g measurements or inferring order.
- Cheng Shi and Chun Sheng gain Chengdu birth-location depth without duplicating their existing 205 g and 176.7 g measurements.
- Hao Jing and Hao Yu gain reciprocal same-litter maternal-lineage bundles with mother Da Ni. The source alias Hao Yan for Hao Jing is retained, and no birth order is inferred.
- Hao Yue gains direct maternal-lineage depth to Xi Mei while retaining institution-level CCRCGP location precision.
- He Mei and He Qi gain reciprocal same-date maternal-lineage bundles with mother Cheng Gong. The records do not strengthen twin terminology or birth order beyond the table.
- Hua Yan gains a direct Liziping Nature Reserve release-destination location record. The existing release date and pre-release measurements are not duplicated.
- Ji Ran gains direct maternal-lineage depth to Ji Li; no father field is added.
- Existing identity, relationship, reproduction, measurement, location, behaviour, release, media and transfer records are not overwritten. No source adds, replaces or reclassifies media.
- The media inventory remains 702 candidates: 699 present and three pending.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1707-1726.json`.

### Coverage and verification
- Early-Chengdu Qing Qing now has five direct records, five source families, seven categories and score -24. A Bao has five direct records, six source families, seven categories and score -24.
- Mei Lan has seven direct records, two source families, seven categories and score -25. Xi Dou's cub and Xi Lan each have seven direct records, four source families, seven categories and score -25.
- Chengdu founder Guo Guo now has two direct records, two source families, eleven categories and score -23.
- A Ling has four direct records, three source families, nine categories and score -25.
- Cheng Dui, Cheng Jiu, Cheng Shi, Chun Sheng, Hao Jing, Hao Yu, Hao Yue, He Mei, He Qi, Hua Yan and Ji Ran each have four direct records, two source families, nine categories and score -25.
- Cheng Lan and Da Mei each have four direct records, three source families, nine categories and score -25.
- Updated rounds1207-1226 only for Hao Jing, Hao Yu, Hao Yue, He Mei, He Qi and Ji Ran; rounds1407-1426 only for Qing Qing, A Bao, Xi Dou's cub, Xi Lan and A Ling; and rounds1427-1446 only for the thirteen Subjects enriched by this slice. Untouched historical Subjects retain exact expectations.
- Focused rounds1707-1726 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 96/96.
- Full local research suite — PASS: 1,270/1,270. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 3,577 files, 778 Subject IDs, 2,726 normalized name keys, 10,673 record IDs, 9,719 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1726 contain 1,536 batches, 1,740 source-row declarations, 1,433 distinct source IDs, 3,841 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Ji Xiao, Jiao Ao, Jiao Yi, Ke Nian and Lun Hui, followed by Ni Hao, Ni Ke, Ni Na, Run Yue, Wu Jun, Wu Wen's 2024 Cub B, Xiang Guo, Xiao Chuan, Xing Mei, Xing Yi, Xiu Yang, Ya Jun, Yang Hua, Yuan Yue and Zhi Hua.
- One generator self-check initially expected six high-confidence rows instead of the actual five; only the assertion and summary string were corrected before generation. npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-03 — Direct category depth rounds1727-1746

### Thirty-fifth depth slice
- Added twenty direct records for Ji Xiao, Jiao Ao, Jiao Yi, Ke Nian, Lun Hui, Ni Hao, Ni Ke, Ni Na, Run Yue, Wu Jun, Wu Wen's 2024 Cub B, Xiang Guo, Xiao Chuan, Xing Mei, Xing Yi, Xiu Yang, Ya Jun, Yang Hua, Yuan Yue and Zhi Hua.
- Generated 20 batches, 20 source-row declarations, 15 distinct source IDs, 15 reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Five annual pages each support two separately reviewed Subject rows.
- Record distribution: ten location, eight lineage, one conflict and one transfer. Wu Wen's 2024 Cub B location is high confidence; the other nineteen records remain medium confidence.
- Ji Xiao, Jiao Ao, Lun Hui and Run Yue gain Chengdu birth-location depth without duplicating existing measurements.
- Ni Ke, Ni Na, Xiao Chuan and Yuan Yue gain Chengdu birth-location depth without duplicating measurements or inferring twin birth order.
- Xiu Yang gains Ya'an Bifengxia birth-location depth without duplicating the existing 220 g measurement.
- Wu Wen's unnamed second 2024 cub gains a bounded Ouwehands Zoo, Rhenen, Netherlands birth-location record. Sex remains unresolved and the documented neonatal death is unchanged.
- Jiao Yi, Ke Nian, Xiang Guo, Xing Mei, Ya Jun, Yang Hua, Zhi Hua and Wu Jun gain direct maternal-lineage depth. No unsupported father or birth-order inference is added.
- Ni Hao gains a direct conflict record for source mother-name order 妮小 / Ni Xiao versus local 小妮 / Xiao Ni, without canonical overwrite.
- Xing Yi gains a dated 2018-01-10 temporary assignment to Guangzhou Zoo with Ya Yi. No later permanent residence is inferred.
- Existing records are not overwritten. No source adds, replaces or reclassifies media.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1727-1746.json`.

### Coverage and verification
- All twenty Subjects now have four direct records, nine categories and score -25.
- Wu Jun, Wu Wen's 2024 Cub B and Xing Yi each have three source families; the other seventeen Subjects retain two source families. All remain multi-source.
- Updated rounds1207-1226 only for the eleven Subjects enriched by this slice; rounds1227-1246 only for the nine Subjects enriched by this slice; rounds1427-1446 only for Ji Xiao, Jiao Ao, Jiao Yi, Ke Nian, Lun Hui and Ni Hao; and rounds1447-1466 only for the fourteen Subjects enriched by this slice. Untouched historical Subjects retain exact expectations.
- Focused rounds1727-1746 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 49/49.
- Full local research suite — PASS: 1,278/1,278. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 3,617 files, 778 Subject IDs, 2,726 normalized name keys, 10,693 record IDs, 9,739 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1746 contain 1,556 batches, 1,760 source-row declarations, 1,448 distinct source IDs, 3,861 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Zhi Shi, Zhi Shu, Bao Xin, Chuan Chuan and Er Xi, followed by Jing Rong, Liang Liang, Sheng Lan, Ya Guang, Ya Lao Da, Ya Lin, Ya Shuang, Ya Xiang, Ya Yun, Ya Zai, Hua Li, Jing Bao, Jiu Jiu, Li Dui and Liu Liu.
- Two initial workspace-open calls returned transient connector 502 responses; the known workspace remained accessible and no repository changes were lost. npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-03 — Direct category depth rounds1747-1766

### Thirty-sixth depth slice
- Added twenty direct records for Zhi Shi, Zhi Shu, Bao Xin, Chuan Chuan, Er Xi, Jing Rong, Liang Liang, Sheng Lan, Ya Guang, Ya Lao Da, Ya Lin, Ya Shuang, Ya Xiang, Ya Yun, Ya Zai, Hua Li, Jing Bao, Jiu Jiu, Li Dui and Liu Liu.
- Generated 20 batches, 20 source-row declarations, 18 distinct source IDs, 18 reviewed URLs, 20 direct fact records and 80 deterministic artifacts. One field-history page supports three separately anchored Ya-family location records.
- Record distribution: eight location, six sex, three transfer, and one each of lineage, name and conflict. Four records are high confidence and sixteen medium confidence.
- Zhi Shi gains Chengdu birth-location depth without duplicating 104.9 g or inferring twin order. Zhi Shu gains maternal-lineage depth to Zhi Zhi and same-date Zhi Hua without inferring order.
- Bao Xin gains a direct official-name record from the Chengdu Base newborn roster.
- Chuan Chuan, Liang Liang, Sheng Lan, Ya Lao Da, Ya Lin and Ya Yun gain direct sex depth.
- Er Xi, Jing Rong, Ya Guang, Ya Shuang, Ya Xiang, Ya Zai and Liu Liu gain direct birth-location depth. Jing Rong remains year-only, Ya Lin remains month-only in the selected report, and Ya Zai's source spelling variants are retained without canonical overwrite.
- Hua Li gains a dated 2016-09-30 Liyang assignment. Jing Bao and Li Dui gain dated 2020-05-29 Fenghuang assignments. No later permanent residence is inferred.
- Jing Bao and Li Dui transfer records do not resolve the profile Hetaoping wording versus annual-table Gengda Shenshuping birthplace difference.
- Jiu Jiu gains a direct identity-conflict record separating the 2015 Ge Ge offspring 九九 from the 2018 Hua Mei offspring named 玖玖 and the Madrid same-romanisation Subject.
- Existing measurements, names, birth-order precision, media classifications and conflicting birthplace records are not overwritten. No source adds, replaces or reclassifies media.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1747-1766.json`.

### Coverage and verification
- Zhi Shi and Zhi Shu now each have four direct records, two source families, nine categories and score -25.
- Bao Xin, Chuan Chuan, Jing Rong, Liang Liang, Ya Guang and Ya Lin now each have six direct records, three source families, six categories and score -25.
- Er Xi, Sheng Lan, Ya Lao Da, Ya Shuang, Ya Xiang, Ya Yun and Ya Zai now each have six direct records, two source families, six categories and score -25.
- Hua Li, Jing Bao and Li Dui each have four direct records, four source families, nine categories and score -25. Jiu Jiu and Liu Liu each have four direct records, three source families, nine categories and score -25.
- Updated rounds1207-1226 only for Liu Liu; rounds1227-1246 only for Zhi Shi, Zhi Shu and the four Ge Ge offspring; rounds1247-1266 only for Jing Rong; rounds1447-1466 only for Zhi Shi, Zhi Shu and Er Xi; and rounds1467-1486 only for the twelve Subjects enriched by this slice. Untouched historical Subjects retain exact expectations.
- Focused rounds1747-1766 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 101/101.
- Full local research suite — PASS: 1,286/1,286. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 3,657 files, 778 Subject IDs, 2,726 normalized name keys, 10,713 record IDs, 9,759 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1766 contain 1,576 batches, 1,780 source-row declarations, 1,466 distinct source IDs, 3,881 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Long Gu, Miao Yin, Shen Shen, Shun Shun and Wen Hui, followed by Xing Ya, Ya Ao, Fu Shuang, Xing Rong, Ya Xing, Yuan Xiao, An An's 2023 Cub A, An An's 2023 Cub B, Du Du, He He (Ge Ge offspring), Lan Zai, Xiao He Tao, Bing Zai, Feng Yi and He He (Shenshuping).
- The first full-suite run exposed one stale rounds1207-1226 score counter after Liu Liu's improvement; only that historical counter was updated before the clean rerun. npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-03 — Direct category depth rounds1767-1786

### Thirty-seventh depth slice
- Added twenty direct records for Long Gu, Miao Yin, Shen Shen, Shun Shun, Wen Hui, female Xing Ya, Ya Ao, Fu Shuang, Xing Rong, male Ya Xing, Yuan Xiao, An An's 2023 Cub A, An An's 2023 Cub B, Du Du, female He He, Lan Zai, Xiao He Tao, Bing Zai, Feng Yi and male He He.
- Generated 20 batches, 20 source-row declarations, 17 distinct source IDs, 17 reviewed URLs, 20 direct fact records and 80 deterministic artifacts. The 2015 birth table, 2018 birth table and Qinling 2023 breeding report each support two separately bounded Subject records.
- Record distribution: six location, five sex, four transfer, two name, and one each of conflict, growth measurement and movement. Six records are high confidence and fourteen medium confidence.
- Long Gu gains an unresolved one-day death-date conflict record: Panda News gives 2010-07-23 while the captured Pandapia profile gives 2010-07-22.
- Miao Yin gains a dated 2012-09-21 move to Dalian Forest Zoo with Jin Hu and Fei Yun. Ya Ao gains a dated 2006-03-29 move to Shanghai Wild Animal Park.
- Shen Shen gains an approximate 160 g birth-weight record using the profile's younger-twin role and ordered birth details.
- Shun Shun and female Xing Ya gain Chengdu birth-location depth; male Ya Xing gains Ya'an Bifengxia birth-location depth. Existing measurements and same-name boundaries are retained.
- Wen Hui, Xing Rong, Yuan Xiao, Bing Zai and the adult male He He gain direct sex depth.
- Fu Shuang and Feng Yi gain direct name depth. Fu Shuang's official Zoo Atlanta page currently returns protective HTTP 403, so the previously reviewed official content and access boundary are retained.
- An An's 2023 older and younger cubs gain institution-level Qinling Giant Panda Research Center location context. The mixed-sex litter still does not assign sex to either individual and no exact enclosure is inferred.
- Du Du gains a Ya'an Base non-public-area location record from the holder clarification relayed by CCTV.
- The female Ge Ge offspring He He gains a dated 2017-09-30 Nanjing Hongshan assignment. The profile's 2015-08-10 date does not overwrite the annual-table 2015-08-08 date.
- Lan Zai gains a year-precision 2016 transfer from Lanzhou Zoo to Ya'an for breeding cooperation. Xiao He Tao gains a dated 2017-12-15 movement into second-stage wild training at Wolong Tiantaishan.
- Existing names, measurements, birth-order precision, conflicting date or location assertions and media classifications are not overwritten. No source adds, replaces or reclassifies media.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1767-1786.json`.

### Coverage and verification
- Long Gu, Shun Shun and Wen Hui now each have four direct records, three source families, nine categories and score -25.
- Miao Yin, Shen Shen, female Xing Ya and Ya Ao now each have four direct records, four source families, nine categories and score -25.
- Fu Shuang and Xing Rong now each have six direct records, four source families, six categories and score -25. Male Ya Xing and Yuan Xiao each have six direct records, three source families, six categories and score -25.
- An An's 2023 Cub A, An An's 2023 Cub B, Du Du, female He He, Lan Zai and Xiao He Tao now each have four direct records, five source families, nine categories and score -25.
- Bing Zai, Feng Yi and the adult male He He now each have six direct records, four source families, six categories and score -25.
- Updated rounds1207-1226 only for Shun Shun; rounds1227-1246 only for Xiao He Tao, Ya Ao, Miao Yin, female Xing Ya and female He He; rounds1427-1446 only for Long Gu; rounds1447-1466 only for Shen Shen, Ya Ao and Fu Shuang; rounds1467-1486 only for the eight Subjects enriched by this slice; and rounds1487-1506 only for the eight Subjects enriched by this slice. Untouched historical Subjects retain exact expectations.
- Focused rounds1767-1786 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 142/142.
- Full local research suite — PASS: 1,294/1,294. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 3,697 files, 778 Subject IDs, 2,726 normalized name keys, 10,733 record IDs, 9,779 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1786 contain 1,596 batches, 1,800 source-row declarations, 1,483 distinct source IDs, 3,901 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Nong Nong, Sen Sen, Xiao Yuan Qi, Can Can's cub and Shui Xiu, followed by Fu Wa, Hsing-Hsing, Hui Hui, Qi Xi, Run Yang, Xian Xian, Xiang Bing, Xiang Shan, Ai Bang's 2016 Cub 66, Ai Jiu, Ai Lin, Ai Si, An An's 2022 Cub, Ao Ao and Ao Ke.
- One coverage detail query returned a transient local `spawn UNKNOWN` and succeeded on retry. A multi-file patch call was rejected before applying changes, so the same historical updates were applied with exact text replacements. One Panda.fr review request ended with an SSL EOF after all required profile and Qinling evidence had already been captured; no unverified measurement was imported.
- npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path. All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-03 — Direct category depth rounds1787-1806

### Thirty-eighth depth slice
- Added twenty direct records for Nong Nong, Sen Sen, Xiao Yuan Qi, Can Can's bounded cub, Shui Xiu, Fu Wa, Smithsonian Hsing-Hsing, Hui Hui, Qi Xi, Run Yang, Xian Xian, Xiang Bing, Xiang Shan, Ai Bang's bounded 2016 cub, Ai Jiu, Ai Lin, Ai Si, An An's bounded 2022 cub, Ao Ao and Ao Ke.
- Generated 20 batches, 20 source-row declarations, 17 distinct source IDs, 17 reviewed URLs, 20 direct fact records and 80 deterministic artifacts. The 2020 annual table supports two separately named birth-location rows and the 2022 table supports two lineage rows plus one bounded unnamed-cub location row.
- Record distribution: nine location, three lineage, two name, and one each of birth, sex, behaviour, social, name meaning and appearance. Two records are high confidence and eighteen medium confidence.
- Nong Nong gains Gengda Shenshuping birth-location depth. Sen Sen gains a direct named Hetaoping birth-row record.
- Xiao Yuan Qi gains institution-level Qinling Giant Panda Research Center context for Ya Ya's unique dated male cub; the adoption-name mapping remains provisional and no exact enclosure is inferred.
- Can Can's bounded photographed cub gains the shared 2024-09-10 birth date while remaining unresolved between Canyang and Qingyang and without an individual sex assignment.
- Shui Xiu gains direct female-sex depth from the wild rescue history. Fu Wa gains direct name depth from a Xinhua Mianyang caption while remaining separate from the 2015 female namesake.
- Smithsonian Hsing-Hsing gains an independent U.S. National Archives behaviour record documenting bamboo feeding at the National Zoo, removing the single-source-only condition.
- Hui Hui and Xian Xian gain Hetaoping birth-location depth. Hui Hui's twin-order conflict remains unresolved.
- Qi Xi gains Chengdu birth-location depth while retaining the source-specific 七喜 character form. Run Yang gains maternal-lineage depth to Yuan Run and same-day Run Ze without inferring twin status or order.
- Xiang Bing gains a bounded social observation with an unidentified young panda; no maternity is inferred. Xiang Shan gains the documented 拆二代 nickname explanation.
- Ai Bang's bounded 2016 cub, Ai Jiu and An An's bounded 2022 cub gain birth-location depth without duplicating existing weights or assigning unsupported formal names.
- Ai Lin and Ai Si gain direct maternal-lineage and same-litter depth without birth-order inference. Ao Ao gains Chengdu birth-location depth while event weights and order remain unassigned. Ao Ke gains the documented 颜王 appearance title.
- Existing measurements, provisional identity mappings, character forms, same-name boundaries and media classifications are not overwritten. No source adds, replaces or reclassifies media.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1787-1806.json`.

### Coverage and verification
- Nong Nong and Sen Sen now each have six direct records, four source families, six categories and score -25. Xiao Yuan Qi has four direct records, six source families, nine categories and score -25.
- Can Can's bounded cub and Shui Xiu now each have six direct records, five source families, six categories and score -25.
- Fu Wa has eight direct records, four source families, six categories and score -26. Smithsonian Hsing-Hsing has seven direct records, two source families, seven categories and score -30.
- Hui Hui, Xian Xian and Xiang Shan now each have three direct records, three source families, eleven categories and score -26. Qi Xi, Run Yang and Xiang Bing each have three direct records, two source families, eleven categories and score -26.
- Ai Bang's bounded 2016 cub, Ai Jiu, Ai Lin, Ai Si and An An's bounded 2022 cub each have five direct records, two source families, eight categories and score -26. Ao Ao and Ao Ke each have five direct records, three source families, eight categories and score -26.
- Updated rounds1247-1266 only for the six Subjects enriched by this slice; rounds1407-1426 and rounds1667-1686 only for Ao Ao; rounds1487-1506 only for the ten Subjects enriched by this slice; and rounds1507-1526 only for the seven Subjects enriched by this slice. Untouched historical Subjects retain exact expectations.
- Focused rounds1787-1806 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 98/98.
- Full local research suite — PASS: 1,302/1,302. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 3,737 files, 778 Subject IDs, 2,726 normalized name keys, 10,753 record IDs, 9,799 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1806 contain 1,616 batches, 1,820 source-row declarations, 1,500 distinct source IDs, 3,921 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Ao Ran, Bao Ge, Bao Mei, Bing Cheng and Bing Xue, followed by Bo Wen, CC, Cheng Feng, Cheng Lang, Chu Xin, Chun Chun, Chun Hui, Chun Lai, Da Ni, Fu Sheng, Han Han, Hua Ao, Hua Long, Ji Fu and Ji Li.
- The first coverage pass exposed eight records that added direct depth without adding a new category; these were changed to location, lineage, social, name-meaning or appearance records before final validation. Several CodexPro connectors returned a shared transient 502 during the slice; the original workspace recovered and all validations completed without lost changes.
- npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path. All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-03 — Direct category depth rounds1807-1826

### Thirty-ninth depth slice
- Added twenty direct records for Ao Ran, Bao Ge, Bao Mei, Bing Cheng, Bing Xue, Bo Wen, CC, Cheng Feng, Cheng Lang, Chu Xin, Chun Chun, Chun Hui, Chun Lai, Da Ni, Fu Sheng, Han Han, Hua Ao, Hua Long, Ji Fu and Ji Li.
- Generated 20 batches, 20 source-row declarations, 19 distinct source IDs, 19 reviewed URLs, 20 direct fact records and 80 deterministic artifacts. The Xinhua A Bao twin report supports two separately bounded institutional-location records.
- Record distribution: seven transfer, four lineage, two location, two name meaning, and one each of alias, death, maternal care, movement and cultural context. All twenty records are medium confidence.
- Ao Ran gains profile-asserted Xian Xian lineage, Ao Ke twin relation and older-cub role. Bo Wen gains Yang Hua lineage, Ya Wen twin relation and younger-cub role.
- Bao Ge and Bao Mei gain Chengdu Research Base institutional birth context by exact sex, weight and older/younger role mapping. Exact enclosure is not inferred and existing weights are not duplicated.
- Bing Cheng gains a year-precision 2018 move to the Dujiangyan Base. Bing Xue gains the documented nickname 雪大朵.
- CC gains the C919 commercial-maiden-flight naming rationale. Cheng Feng and Cheng Lang each gain a May 2026 move to Chengdu Research Base.
- Chu Xin gains a dated 2018-08-21 assignment to Changchun Northeast Tiger Park. Chun Chun gains a dated 2007-05-23 death record at the Hetaoping wild-training base while the twin-order conflict remains unresolved.
- Chun Hui and Chun Lai gain direct Cai Yun lineage and reciprocal twin-role depth from their separate profiles.
- Da Ni gains the 大妮—大鲵 homophone, 志坚 nickname and global naming-campaign context. Fu Sheng gains direct allomaternal-care depth from maternal aunt Olympia.
- Han Han gains a dated 2018-11-29 return flight to Chengdu with Tuan Zi due to the Linyi panda-house renovation.
- Hua Ao gains a dated 2019-02-18 assignment to Jinan Zoo. Hua Long gains a dated 2023-07-18 assignment to Yueyang Chinese Giant Panda Garden.
- Ji Fu gains the 2023-02-06 Geely Auto and Li Shufu Charity Foundation adoption and public-vote naming context while the one-day birth-date conflict remains unresolved.
- Ji Li gains a dated 2011-12-30 assignment to Xiamen Haicang Wildlife Zoo; the existing 2012 return event is not duplicated.
- Profile-stated litter roles are kept separate from annual-table row order. Assignment wording does not establish permanent residence. No source adds, replaces or reclassifies media.
- Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1807-1826.json`.

### Coverage and verification
- All twenty Subjects now have five direct records, eight categories and score -26.
- Bing Xue retains two source families; the other nineteen Subjects now have three source families. All twenty remain multi-source.
- Updated rounds1247-1266 only for the nine Subjects enriched by this slice; rounds1267-1286 only for the eleven Subjects enriched by this slice; rounds1507-1526 only for the first ten Subjects; and rounds1527-1546 only for the final ten Subjects. Untouched historical Subjects retain exact expectations.
- Focused rounds1807-1826 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 68/68.
- Full local research suite — PASS: 1,310/1,310. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 3,777 files, 778 Subject IDs, 2,726 normalized name keys, 10,773 record IDs, 9,819 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1826 contain 1,636 batches, 1,840 source-row declarations, 1,519 distinct source IDs, 3,941 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Ji You, Jiao Xiao, Jiao Yang, Jin Baobao and Jin Rui, followed by Liu Yi, Lun Wen, Lun Wu, Lv Di, Ni Ni, 99, Ning Ning, Qi Qiao, Qing Chong Yang, Qing Zhu Yu, Rong Sheng, Ru Ru, Run Jiu, Run Ze and Sa Er.
- `progress.md` exceeded the connector's single-read size limit, so the final section was located through bounded text search before exact append. npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path.
- All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-03 — Direct category depth rounds1827-1846

### Fortieth depth slice
- Added twenty direct records for Ji You, Jiao Xiao, Jiao Yang, Jin Baobao, Jin Rui, Liu Yi, Lun Wen, Lun Wu, Lv Di, Ni Ni, 99, Ning Ning, Qi Qiao, Qing Chong Yang, Qing Zhu Yu, Rong Sheng, Ru Ru, Run Jiu, Run Ze and Sa Er.
- Generated 20 batches, 20 source-row declarations, 20 distinct source IDs, 20 reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Every Subject uses a distinct reviewed individual-profile page.
- Record distribution: seven transfer, five name meaning, three death, three alias, one personality and one adoption. All twenty records are medium confidence.
- Ji You gains a dated 2020-07-05 return to Chengdu Research Base. Jiao Xiao gains a dated 2014-04-29 assignment to Straits (Fuzhou) Panda World.
- Jiao Yang gains a month-precision February 2003 young-cub death record; no day or location is invented. Jin Baobao gains a dated 2025-11-04 move to the CCRCGP Mianyang Base.
- Jin Rui gains the documented nickname Jerry. Liu Yi gains a dated 2017-01-04 assignment to Changzhou Yancheng Wild Animal World while the Liu Yi / Cheng Xiao name conflict remains unresolved.
- Lun Wen gains the bounded profile traits gentle and well-behaved; these are not treated as immutable temperament. Lun Wu gains the documented nicknames 小鳌拜 and 邪恶摇粒绒.
- Lv Di gains a dated 1992-02-13 Hetaoping death record without duplicating the existing hand-rearing or birth-weight evidence.
- Ni Ni gains the Beijing Olympics “Beijing welcomes you” paired-name rationale. 99 gains the C919 commercial-maiden-flight joint-name rationale with CC without a twin-status inference.
- Ning Ning gains a dated 2023-03-24 death record. The page's clinical context remains explicitly user-contributed and is not treated as an independently verified diagnosis.
- Qi Qiao gains a dated 2016-09-26 move with Qi Xi to Ordos Wildlife Park while the 七巧 / 奇巧 character-form conflict remains unresolved.
- Qing Chong Yang gains the 2021-02-04 Xuexi Qiangguo adoption and rename to Qiang Qiang. Qing Zhu Yu gains the dated 2024-04-29 Madrid Zoo travel plan with Jin Xi; the planned ten-year duration does not establish completion or current residence.
- Rong Sheng gains the Rongcheng/Chengdu name origin. Ru Ru gains the Book of Songs phrase 如月之恒，如日之升 and public-selection context.
- Run Jiu gains the nine-suture and health-longevity name rationale without duplicating medical or weight records. Run Ze gains the documented nicknames 三狗, 粘人精 and 小妈宝.
- Sa Er gains a dated 2018-04-19 arrival with Qian Qian at Hohhot Daqingshan Wildlife Park for a planned three-year science-education stay; completion and current residence are not inferred.
- No source adds, replaces or reclassifies media. Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1827-1846.json`.

### Coverage and verification
- All twenty Subjects now have five direct records, three source families, eight categories and score -26. All remain multi-source.
- Updated rounds1267-1286 only for the five Subjects enriched by this slice; rounds1287-1306 only for the fifteen Subjects enriched by this slice; rounds1527-1546 only for the first seven Subjects; and rounds1547-1566 only for the final thirteen Subjects. Untouched historical Subjects retain exact expectations.
- Focused rounds1827-1846 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 68/68.
- Full local research suite — PASS: 1,318/1,318. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 3,817 files, 778 Subject IDs, 2,726 normalized name keys, 10,793 record IDs, 9,839 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1846 contain 1,656 batches, 1,860 source-row declarations, 1,539 distinct source IDs, 3,961 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Shan Hu, Shu Hui, Shu Lan, Shuang Hao and Su Lin's 2019 Cub A, followed by Su Xing, Su Yang, Ting Ting, Ting Zai, Wei Wei, Xiao Ni, Xiao Qiao, Xiao Shuang, Xiao Ya, Xing An, Xing Fan, Xing Qing, Xing Yu, Xing Yuan and Xing Yun.
- A shared CodexPro bridge outage returned repeated 502 responses across every available connector instance. During the outage the generator and tests were prepared and syntax-checked in an isolated temporary environment; after recovery they were written to the original workspace and all validations completed without lost repository changes.
- npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path. All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-03 — Direct category depth rounds1847-1866

### Forty-first depth slice
- Added twenty direct records for Shan Hu, Shu Hui, Shu Lan, Shuang Hao, Su Lin's 2019 Cub A, Su Xing, Su Yang, Ting Ting, Ting Zai, Wei Wei, Xiao Ni, Xiao Qiao, Xiao Shuang, Xiao Ya, Xing An, Xing Fan, Xing Qing, Xing Yu, Xing Yuan and Xing Yun.
- Generated 20 batches, 20 source-row declarations, 20 distinct source IDs, 20 reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Every Subject uses a distinct reviewed individual-profile page.
- Record distribution: eleven transfer, three name meaning, one death, one training, one evidence scope, one alias, one growth measurement and one medical. All twenty records are medium confidence.
- Shan Hu gains a year-precision 2018 death sequence with explicit user-contributed page attribution. Shu Hui gains phase-one wild-training participation without an outcome inference.
- Shu Lan gains a dated 2017-03-16 move to the CCRCGP Dujiangyan Base, separate from the existing 1996 Chengdu-to-Lanzhou migration route. Shuang Hao gains the China-Japan friendship and lasting-peace name rationale.
- Su Lin's 2019 Cub A gains a bounded evidence-scope record: the descriptive name, missing studbook number, unresolved final name and annual-table-versus-profile sex conflict remain unresolved.
- Su Xing gains a dated 2025-07-25 assignment to Linyi Zoological and Botanical Garden without replacing the earlier Chengdu transfer. Su Yang gains the documented nickname 苏小宝.
- Ting Ting gains a dated 2026-07-13 return to the China Conservation and Research Center for the Giant Panda without a sub-base inference. Ting Zai gains a directly bound 166-gram birth-weight record.
- Wei Wei gains a normalized 2021-10-27 return to the CCRCGP Dujiangyan Base while the twin-order conflict remains unresolved. Xiao Ni gains a month-precision January 2022 return to Chengdu Research Base.
- Xiao Qiao gains a dated 2020-05-28 assignment to Tianjin Eco-City Elion Elf Park. Xiao Shuang gains the commemorative Li Xiaoshuang / 1996 Atlanta Olympics name origin.
- Xiao Ya gains a dated 2020-08-25 assignment to Shandong Quancheng Europark Animal Kingdom. Xing An gains a dated 2020-05-29 assignment to Hunan Fenghuang Chinese Giant Panda Garden.
- Xing Fan gains a dated 2019-01-22 Nantong Forest Safari Park assignment for a planned five-year science-education programme; completion and current residence are not inferred.
- Xing Qing gains the profile-reported heart-disease and unsuccessful-emergency-treatment context without an independent diagnosis or invented exact death date.
- Xing Yu and Xing Yuan gain separate dated 2018-02-07 and 2018-02-27 assignments to Quanzhou Maritime Silk Road Wildlife World. Xing Yun gains the 好运连连 name meaning without duplicating the Xingxing-nursery milestone.
- Assignment, return and planned-stay wording does not establish permanent or current residence. Year- and month-only precision, same-name mother boundaries, sex conflicts and twin-order conflicts remain explicit.
- No source adds, replaces or reclassifies media. Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1847-1866.json`.

### Coverage and verification
- All twenty Subjects now have five direct records, three source families, eight categories and score -26. All remain multi-source.
- Updated rounds1307-1326 only for the sixteen Subjects enriched by this slice; rounds1327-1346 only for the final four Subjects; rounds1547-1566 only for the first four Subjects; and rounds1567-1586 only for the final sixteen Subjects. Untouched historical Subjects retain exact expectations.
- Focused rounds1847-1866 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 68/68.
- Full local research suite — PASS: 1,326/1,326. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 3,857 files, 778 Subject IDs, 2,726 normalized name keys, 10,813 record IDs, 9,859 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1866 contain 1,676 batches, 1,880 source-row declarations, 1,559 distinct source IDs, 3,981 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Xiu Xiu, Ya Er, Ya Song, Ya Wen and Ya Yi, followed by Ye Ye, Yin Ke, Ying Xue, You Bang, Yuan Run, Yuan Yuan, Yun Wen, Yun Wu, Yun Yun, Zhao Yang, Zhen Lan, Zheng Zai, Zhi Ma, Zhi Yu and Zhuang Mei.
- A shared CodexPro bridge outage interrupted deterministic and historical verification with repeated 502 responses across standard and alternate connector instances. After recovery, deterministic rerun, historical updates and all full validations completed successfully.
- npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path. All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-03 — Direct category depth rounds1867-1886

### Forty-second depth slice
- Added twenty direct records for Xiu Xiu, Ya Er, Ya Song, Ya Wen, Ya Yi, Ye Ye, Yin Ke, Ying Xue, You Bang, Yuan Run, Yuan Yuan, Yun Wen, Yun Wu, Yun Yun, Zhao Yang, Zhen Lan, Zheng Zai, Zhi Ma, Zhi Yu and Zhuang Mei.
- Generated 20 batches, 20 source-row declarations, 20 distinct source IDs, 20 reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Every Subject uses a distinct reviewed individual-profile page.
- Record distribution: eight transfer, three alias, and one each for naming, reproduction context, evidence scope, conservation milestone, family context, birth event, adoption, name meaning and wild training. All twenty records are medium confidence.
- Xiu Xiu gains the documented naming by then-premier Zhu Rongji together with Qing Qing while the profile's internal death chronology conflict remains outside the naming record.
- Ya Er gains a dated 2020-08-25 assignment to Shandong Quancheng Europark Animal Kingdom. Ya Song gains the bounded context that she was the cub from Ya Li's second pregnancy without a litter-size inference.
- Ya Wen gains an evidence-scope record preserving the named older-twin identity and the absence of a displayed studbook number after individual and family-profile review. Ya Yi gains a dated 2018-01-10 assignment with Xing Yi to Guangzhou Zoo.
- Ye Ye gains two separate 2017 base moves: 2017-03-15 to Ya'an Bifengxia and 2017-04-13 to Wolong Shenshuping. Existing breeding and care records are not duplicated.
- Yin Ke gains a dated 2025-11-04 move to the CCRCGP Mianyang Base while an earlier ambiguous 2025 institution-level return remains separate.
- Ying Xue gains the profile's conservation-milestone wording for the 2017-11-23 joint release with Ba Xi as the world's second simultaneous release of two giant pandas.
- You Bang gains the documented nickname 抱腿狂魔 and bounded leg-hugging rationale. Yuan Run gains a dated 2018-01-12 move to Chengdu Research Base.
- Yuan Yuan gains the family context that mother Bing Bing was 17 years old at Yuan Yuan's birth while same-name Subjects and existing reproduction totals remain separate.
- Yun Wen gains a shared litter-event time of 08:20 without converting it into an individual delivery time. Yun Wu gains lifetime adoption by Guobao Life Insurance on 2019-01-23 without a rename inference.
- Yun Yun gains a dated 2023-08-27 return to the CCRCGP Dujiangyan Base while earlier Panyu and Huzhou Deqing moves remain contextual. Zhao Yang gains a dated 2023-07-18 assignment to Yueyang Chinese Giant Panda Garden.
- Zhen Lan gains the documented nickname 珍帅气 without an inferred studbook number or nickname origin. Zheng Zai gains a dated 2022-08-25 group move to the Qinling Foping rescue and breeding base.
- Zhi Ma gains the sesame-seed visual name rationale without duplicating the 2017 captive-twin milestone. Zhi Yu gains the alternate form 子羽 and the nicknames 三眼猫, 二郎神 and 雅拉索 without extending the forehead-treatment medical context.
- Zhuang Mei gains a dated 2017-12-15 entry with daughter Xiao Hetao into second-stage rewilding training at Wolong Tiantaishan; training outcome and the cross-profile twin-date conflict remain unresolved.
- No source adds, replaces or reclassifies media. Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1867-1886.json`.

### Coverage and verification
- All twenty Subjects now have five direct records, three source families, eight categories and score -26. All remain multi-source.
- Updated rounds1327-1346 only for the first twelve Subjects; rounds1347-1366 only for the final eight Subjects; rounds1567-1586 only for Xiu Xiu and Ya Er; rounds1587-1606 only for the middle seventeen Subjects; and rounds1607-1626 only for Zhuang Mei. Untouched historical Subjects retain exact expectations.
- Focused rounds1867-1886 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 78/78.
- Full local research suite — PASS: 1,334/1,334. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 3,897 files, 778 Subject IDs, 2,726 normalized name keys, 10,833 record IDs, 9,879 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1886 contain 1,696 batches, 1,900 source-row declarations, 1,579 distinct source IDs, 4,001 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Zi Lin, Zi Su, Xiao Bai Tu, Su Su and Ai Le, followed by Ai Mi, Cheng Cheng, Hua Rong, Jin Jin, Ling Zhu, Lu Lu, Mei Ling, Olympia, Qing Zai, Shan Zai, Sheng Lan, Xiao Jiao, Xin Yue, Yang Hu and Yu Lei.
- Standard CodexPro endpoints repeatedly returned shared 502 responses during coverage confirmation and test-file creation. The stable `codexpro` wrapper was opened against the same workspace and used to complete writes, deterministic verification, historical updates and all full validations without changing scope.
- npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path. All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-03 — Direct category depth rounds1887-1906

### Forty-third depth slice
- Added twenty direct records for Zi Lin, Zi Su, Xiao Bai Tu, Su Su, Ai Le, Ai Mi, Cheng Cheng, Hua Rong, Jin Jin, Ling Zhu, Lu Lu, Mei Ling, Olympia, Qing Zai, Shan Zai, Sheng Lan, Xiao Jiao, Xin Yue, Yang Hu and Yu Lei.
- Generated 20 batches, 20 source-row declarations, 20 distinct source IDs, 20 reviewed URLs, 20 direct fact records and 80 deterministic artifacts. Nineteen records use distinct individual-profile pages and Ling Zhu uses the exact-event Xinhua report.
- Record distribution: four location, three alias, two transfer, two death, two lineage, two family context, and one each for identity, cultural context, milestone, evidence conflict and residence. All twenty records are medium confidence.
- Zi Lin and Zi Su gain separate Wolong Shenshuping birthplace records while cross-date twin roles and ordered weight lower bounds remain unchanged.
- Xiao Bai Tu gains a bounded identity-card record with studbook number 784; the previously verified individual avatar is not duplicated or reclassified.
- Su Su gains a month-precision May 1986 Mabian rescue-location and Chengdu Zoo destination record without inventing a day or duplicating the existing rescue and death facts.
- Ai Le gains the National Day calendar context for the exact 2022-10-01 birth date without importing the youngest-cohort claim. Ai Mi gains a dated 2023-11-16 move to Dujiangyan Panda Valley.
- Cheng Cheng gains a dated 2012-03-06 death record without an inferred cause or location. Hua Rong gains the direct Hua Mei / Wu Gang parent pair without replacing the existing annual-table maternal assertion.
- Jin Jin gains a year-precision 1990 death at Chengdu Research Base. Ling Zhu gains the Xinhua milestone that the unique Ling Lang birth event was CCRCGP's first captive cub of 2025; the later name remains event-bound.
- Lu Lu gains the Shaanxi Rare Wildlife Rescue and Breeding Research Center birthplace. Mei Ling gains the direct Hua Mei / Ling Ling parent pair without duplicating twin, breeding or transfer records.
- Olympia gains the documented nickname 科大. Qing Zai gains the documented nickname 闷逗. Sheng Lan gains the documented nickname 珍潇洒 while same-name and missing-studbook boundaries remain explicit.
- Shan Zai gains a source-internal evidence-conflict record preserving the title name 善仔 and narrative opening name 带带 without automatic alias merge or rename.
- Xiao Jiao gains the profile-stated position as Jiao Zi's eldest son. Xin Yue gains a dated Suzhou Taihu residence event bounded to the 2011-09-07 formal settlement and not treated as current residence.
- Yang Hu gains the profile-stated older-brother relationship to Mei Ling as family context without duplicating the death record. Yu Lei gains a dated 2020-05-29 assignment to Hunan Fenghuang Chinese Giant Panda Garden.
- No source adds, replaces or reclassifies media. Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1887-1906.json`.

### Coverage and verification
- All twenty Subjects improve from score -21 to score -26. Zi Lin and Zi Su now have 5 direct / 3 sources / 8 categories; Xiao Bai Tu has 7 / 3 / 5; Su Su has 3 / 4 / 11; the remaining sixteen have 5 / 4 / 8. All remain multi-source.
- Updated total-score distributions in rounds1247-1366; enriched exact shapes in rounds1507-1606; added a seven-Subject shape map in rounds1607-1626; and updated Su Su's special shape in rounds1667-1686. Untouched historical Subjects retain exact expectations.
- Focused rounds1887-1906 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 198/198.
- Full local research suite — PASS: 1,342/1,342. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 3,937 files, 778 Subject IDs, 2,726 normalized name keys, 10,853 record IDs, 9,899 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1906 contain 1,716 batches, 1,920 source-row declarations, 1,599 distinct source IDs, 4,021 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Yuan Lin, Yuan Zhou, Yun Hui, Zhan Wang and Zhu Hai, followed by Zhu Ling, Zi Lu, Ai Lian, Bai Xue, Da Shuang, Haizi, Beijing-lineage Lu Lu, Shi Shi, Tang Tang, Xue Xue, Ying Hua, Fu Wa, Hai Hai, Lan Bao and Lao Lao.
- A shared CodexPro 502 outage interrupted the first historical edit attempts. The same workspace recovered without lost changes; all thirteen historical updates and validations then completed successfully.
- npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path. All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-03 — Direct category depth rounds1907-1926

### Forty-fourth depth slice
- Added twenty direct records for Yuan Lin, Yuan Zhou, Yun Hui, Zhan Wang, Zhu Hai, Zhu Ling, Zi Lu, Ai Lian, Bai Xue, Da Shuang, Haizi, Beijing-lineage Lu Lu, Shi Shi, Tang Tang, Xue Xue, Ying Hua, Fu Wa, Hai Hai, Lan Bao and Lao Lao.
- Generated 20 batches, 20 source-row declarations, 20 distinct source IDs, 20 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. All records are medium confidence.
- Record distribution: five identity, two alias, two family context, two sex, and one each for appearance, growth measurement, lineage, development, residence, public activity, programme, behaviour and transfer.
- Yuan Lin gains bounded bird-shaped eye-patch and fluffy-face appearance notes without repeating the existing 2024 migration. Yuan Zhou gains a 203 g birth-weight record without repeating the 2025 Chengdu return.
- Yun Hui gains the direct Su Lin / Wu Gang parent pair and younger-brother Su Xing context without repeating maternal, medical or death records. Zhan Wang gains older-brother Yu Lei and name-only son Wang Yue family context without repeating the natural-mating record.
- Zhu Hai gains the profile wording that he died while still a young cub, without age calculation or death-record duplication. Zhu Ling gains a dated 2025-11-04 Mianyang residence event without repeating the earlier Liugong Island transfer.
- Zi Lu gains the profile-reported prior name element 徵 and current Zi Lu form without inventing a complete former legal name. Ai Lian gains the dated 2024-01-18 formal visitor-meeting activity with Qing Hua, Qing Lu and Qiao Yue.
- Bai Xue gains studbook 418 identity anchored by offspring Si Xue and Chuang Chuang. Da Shuang gains the planned three-year science-education loan beginning 2018-03-30 while inconsistent destination wording is withheld.
- Haizi gains studbook 544 and the displayed Chinese form 海子. Beijing-lineage Lu Lu gains studbook 503 and the exact Chinese form 芦芦, remaining separate from the younger 路路.
- Shi Shi gains studbook 467, exact birth date and the Cheng Cheng / Ha Lan parent pair. Tang Tang gains co-parent Pan Pan and additional offspring Lin Yang context from the exact Lin Yang profile.
- Xue Xue gains studbook 444 and remains separate from the younger studbook-850 namesake. Ying Hua gains a single captioned observation of playing with a ball after eating bamboo, not a stable personality classification.
- Fu Wa gains the nicknames 科小 and 壶娃 while remaining separate from the Mianyang namesake. Hai Hai and Lao Lao gain direct female and male sex records while the 林萍 / 林冰 maternal-name conflict remains unresolved.
- Lan Bao gains the profile-timeline 2012-04-15 Lanzhou return while the independent 2012-04-24 date remains an unresolved conflict.
- No source adds, replaces or reclassifies media. Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1907-1926.json`.

### Coverage and verification
- All twenty Subjects improve from score -21 to score -26. Yuan Lin now has 5 direct / 3 sources / 8 categories; the other first-six Subjects have 5 / 4 / 8; the nine lineage-style Subjects have 7 / 4 / 5; and the final four have 5 / 5 / 8. All remain multi-source.
- Updated only the affected total-score distributions in rounds1267-1366, added Zhu Hai and Zhu Ling to rounds1587-1606, added nine explicit shapes to rounds1607-1626, and added Hai Hai and Lao Lao to rounds1627-1646. Untouched historical Subjects retain exact expectations.
- Focused rounds1907-1926 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 111/111.
- Full local research suite — PASS: 1,350/1,350. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 3,977 files, 778 Subject IDs, 2,726 normalized name keys, 10,873 record IDs, 9,919 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1926 contain 1,736 batches, 1,940 source-row declarations, 1,619 distinct source IDs, 4,041 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Lin Yang, Mei Zhu, Qi Ji, Quan Mei and Si Jun Jun, followed by Si Nian, Xi Qing, Fu Duo Duo, Gong Zai, He Sheng, He Yu, Jin Shuang, Ke Yu, Nan Xiao Yue, Nao Nao, Nuo Mi, Shuang Qing, Wen Wen, Wen Xi and Xiao Bao.
- One stable-wrapper `py_compile` call was blocked by an external safety check; the same local command passed immediately through the standard workspace endpoint. No source or artifact changes were lost.
- npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path. All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-04 — Direct category depth rounds1927-1946

### Forty-fifth depth slice
- Added twenty direct records for Lin Yang, Mei Zhu, Qi Ji, Quan Mei, Si Jun Jun, Si Nian, Xi Qing, Fu Duo Duo, Gong Zai, He Sheng, He Yu, Jin Shuang, Ke Yu, Nan Xiao Yue, Nao Nao, Nuo Mi, Shuang Qing, Wen Wen, Wen Xi and Xiao Bao.
- Generated 20 batches, 20 source-row declarations, 20 distinct source IDs, 20 distinct reviewed individual-profile URLs, 20 direct fact records and 80 deterministic artifacts. All records are medium confidence.
- Record distribution: four family-context, four identity, two death, two behaviour, and one each for transfer, birth event, naming, appearance, medical, alias, cohort and adoption.
- Lin Yang gains a month-precision September 2023 move to the CCRCGP Dujiangyan Base without origin or current-residence inference. Mei Zhu gains the 03:38 birth time and 128-day maternal gestation without repeating her 178 g birth weight.
- Qi Ji and Xi Qing gain bounded maternal-sibling context for Xiao Yuan Qi while their mixed-sex twin roles and birth order are not re-inferred. Quan Mei gains a month-precision July 1997 death at Chengdu Research Base without a cause.
- Si Jun Jun gains the 2016-02-06 online-naming event while the Si Yun Yun romanisation remains a source variant. Si Nian gains the bounded 点绛唇 lower-lip appearance description.
- Fu Duo Duo and Pu Pu are directly retained as one individual anchored to mother Qi Fu. Gong Zai gains studbook 711 identity without importing design-reference or temperament leads.
- He Sheng gains the profile-reported unidentified-animal injury and sepsis account, explicitly retained as not independently verified official diagnosis. He Yu gains quiet temperament and wooden-climbing-frame preference as bounded profile observations.
- Jin Shuang gains studbook 1247 and alias You Xi without resolving birth order from studbook sequence. Ke Yu gains previous name Ke Nan and nickname Little Detective without inventing a nickname origin.
- Nan Xiao Yue gains the profile-stated third-cub position in Wang Jia's maternal history without recalculation. Nao Nao gains clever, active and tree-hanging observations without strengthening the same-date sibling claim.
- Nuo Mi gains older sister Yang Hua and the expanded maternal-sister roster without repeating son Yu Chen's birth. Shuang Qing gains a year-precision 2012 death without cause or location.
- Wen Wen gains the profile claim that he was the oldest male in the 2016 cohort, bounded as not independently validated against a complete global cohort. Wen Xi gains studbook 1424 identity without repeating the Wen Ya name history.
- Xiao Bao gains Dabao Group naming sponsorship, explicitly not interpreted as ownership, permanent adoption or care custody. Existing 8/9 August uncertainty and birth-order boundaries remain intact.
- No source adds, replaces or reclassifies media. Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1927-1946.json`.

### Coverage and verification
- The first seven Subjects now have 5 direct / 5 sources / 8 categories and score -26. Fu Duo Duo has 7 / 5 / 7 and score -25. He Sheng, Ke Yu, Nan Xiao Yue and Nuo Mi have 4 / 3 / 10 and score -27. The remaining eight later Subjects have 4 / 3 / 9 and score -25. All remain multi-source.
- Updated only affected historical coverage expectations in rounds1367-1386, rounds1387-1406, rounds1607-1626, rounds1627-1646 and rounds1647-1666. Untouched historical Subjects retain exact expectations.
- Focused rounds1927-1946 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 99/99.
- Full local research suite — PASS: 1,358/1,358. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 4,017 files, 778 Subject IDs, 2,726 normalized name keys, 10,893 record IDs, 9,939 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1946 contain 1,756 batches, 1,960 source-row declarations, 1,639 distinct source IDs, 4,061 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Ya Yun, Zhi Zhi, Ai Bang, Ba Xi and Bing Dian, followed by Chao Chao, Guai Guai, Jiao Zi, Jun Zu, Mei Mei, Pan Yue, Qing Qing, Lu Lin, Qian Qian, Zheng Zheng, Cheng Ji, Lang Lang, Cheng Shuang, Jin Ke and Ke Lin.
- A shared CodexPro 502 outage interrupted final full-suite validation, indexing and progress logging. The same workspace recovered on 2026-08-04 and all outstanding acceptance steps completed successfully without lost changes.
- npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path. All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-04 — Direct category depth rounds1947-1966

### Forty-sixth depth slice
- Added twenty direct records for Ya Yun, Zhi Zhi, Ai Bang, Ba Xi, Bing Dian, Chao Chao, Guai Guai, Jiao Zi, Jun Zu, Mei Mei, Pan Yue, Qing Qing, Lu Lin, Qian Qian, Zheng Zheng, Cheng Ji, Lang Lang, Cheng Shuang, Jin Ke and Ke Lin.
- Generated 20 batches, 20 source-row declarations, 20 distinct source IDs, 20 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. All records are medium confidence.
- Record distribution: five family-context, three identity, two transfer, two birth, and one each for alias, behaviour, appearance, naming, rescue, medical, birth event and sex.
- Ya Yun gains mother Ya Li, twin Ya Zhu and the profile-stated older-sister role without inferring birth order from table position. Zhi Zhi gains the documented nickname Zhi Zhi Mei Er.
- Ai Bang gains the 2012-12-14 return to Chengdu without current-residence inference. Ba Xi gains studbook 956 identity. Bing Dian gains bounded active and tree-climbing observations. Chao Chao gains the slightly heart-shaped nose-curve description without strengthening twin or birth-order status.
- Guai Guai gains an expanded maternal-sibling roster. Jiao Zi gains the naming sponsor and favoured-child-of-heaven meaning without ownership inference. Jun Zu gains an expanded offspring roster. Mei Mei gains the year-precision 1975 Meigu rescue and Chengdu Zoo transfer.
- Pan Yue gains the profile-stated first-offspring position and younger maternal siblings. Qing Qing gains the profile-reported acute hemorrhagic pancreatitis with liver and kidney failure, retained as not independently verified official diagnosis.
- Lu Lin gains the 2009-09-12 birth date and studbook 758 while local 芦林 remains distinct from profile 芦琳. Chengdu Qian Qian gains studbook 881 identity and remains separate from Ya'an Qian Qian. Zheng Zheng is directly identified as Ba Zi's mother without mapping unnamed 2023 twins.
- Cheng Ji gains the cross-midnight twin event with Cheng Gong. Lang Lang gains the 2009-04-30 move to Nanjing Hongshan Forest Zoo while the death-date conflict remains unresolved. Cheng Shuang gains male sex and studbook 857 while biological and foster maternity remain distinct. Jin Ke and Ke Lin gain studbook 743 and 678 identity respectively.
- No source adds, replaces or reclassifies media. Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1947-1966.json`.

### Coverage and verification
- Ya Yun and Zhi Zhi now have 4 direct / 3 sources / 10 categories and score -27. Guai Guai, Jiao Zi, Jun Zu, Pan Yue and Qing Qing have 4 / 4 / 10 and score -27. Lu Lin and Zheng Zheng have 6 / 4 / 7 and score -27. Cheng Ji has 4 / 5 / 10 and score -27. Cheng Shuang and Jin Ke have 6 / 5 / 7 and score -27.
- Ai Bang, Ba Xi, Bing Dian, Chao Chao and Mei Mei have 4 / 4 / 9 and score -25. Chengdu Qian Qian has 6 / 4 / 6 and score -25. Lang Lang has 4 / 5 / 9 and score -25. Ke Lin has 6 / 5 / 6 and score -25. All remain multi-source.
- Updated only affected historical coverage expectations in rounds1207-1226, rounds1367-1386, rounds1387-1406, rounds1627-1646 and rounds1647-1666.
- Focused rounds1947-1966 verification — PASS: 8/8 before and after deterministic rerun. Full local research suite — PASS: 1,366/1,366. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 4,057 files, 778 Subject IDs, 2,726 normalized name keys, 10,913 record IDs, 9,959 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1966 contain 1,776 batches, 1,980 source-row declarations, 1,659 distinct source IDs, 4,081 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Miao Miao, Bing Bing, Long Hui, Guo Guo and Huan Cai, followed by Jin Yu, Bai Ji, Chu Lin, Fu Lai, Fu Shun, Ha Lan, Jing Ao, Jing Yun, Po, Tuan Zi, Ya Lao Er, Bao Quan, Cai Yun, Cheng Da and Bei Chen.
- Shared CodexPro 502 errors affected several long discovery calls. Explicit non-overlapping module groups completed the full suite, and the final development gate subsequently reran all 1,366 tests successfully in one command.
- npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path. All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-04 — Direct category depth rounds1967-1986

### Forty-seventh depth slice
- Added twenty direct records for Miao Miao, Bing Bing, Long Hui, Guo Guo, Huan Cai, Jin Yu, Bai Ji, Chu Lin, Fu Lai, Fu Shun, Ha Lan, Jing Ao, Jing Yun, Po, Tuan Zi, Ya Lao Er, Bao Quan, Cai Yun, Cheng Da and Bei Chen.
- Generated 20 batches, 20 source-row declarations, 20 distinct source IDs, 20 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. All records are medium confidence.
- Record distribution: six transfer, two reproduction, two veterinary-care, and one each for birth, distinguishing feature, name meaning, conflict, anecdote, identity, cultural context, health, birth event and alias.
- Miao Miao gains a three-offspring roster while biological mother Jiao Zi and foster mother Li Li remain distinct. Bing Bing gains a bounded Winnipeg, Kofu, Chengdu and Hefei movement timeline. Long Hui gains the exact 2000-09-26 Wolong birth anchor.
- Guo Guo gains the bounded fluffy-faced profile description. Huan Cai gains the profile-reported final clinical timeline and acute hemorrhagic necrotizing enteritis account. Jin Yu gains the 2024-07-17 move to Chengdu Zoo.
- Bai Ji gains the Qiang-language name meaning, nickname Ping Yue and naming date. Chu Lin retains the natural-mating and artificial-insemination conception history without resolving paternity. Fu Lai gains the January 2018 intestinal-obstruction treatment and surgery timeline. Fu Shun gains the bounded head-first-fall anecdote without injury inference.
- Ha Lan gains the profile-reported total of twenty-five offspring without complete-studbook reconciliation. Jing Ao gains studbook 963 identity and twin anchors. Jing Yun gains the 2018-04-20 move to Cangzhou Zoo. Po gains the Kung Fu Panda cultural naming context without ownership or sponsorship inference.
- Tuan Zi gains the 2018 return to Chengdu during Linyi renovation and the 2019 move to Nanjing Ziqing Lake. Ya Lao Er gains the profile-reported malignant-tumour account. Bao Quan gains a year-precision 2023 move to Bifengxia. Cai Yun gains the Jinan, Dujiangyan, Bifengxia and Shenshuping movement sequence.
- Cheng Da gains the two delivery times and birth weights for her 2017 first litter. Bei Chen gains the official nickname Xiao Tian Bao without converting the smiling description into an immutable personality trait.
- No source adds, replaces or reclassifies media. Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1967-1986.json`.

### Coverage and verification
- Miao Miao now has 6 direct / 5 sources / 7 categories and score -27. Bing Bing has 4 / 5 / 10 and score -27.
- Long Hui has 8 / 3 / 7 and score -28. Guo Guo and Huan Cai have 3 / 3 / 12 and score -28. Jin Yu and Bao Quan have 5 / 3 / 9 and score -28. Cai Yun and Cheng Da have 5 / 4 / 9 and score -28.
- Bai Ji, Chu Lin, Fu Lai, Fu Shun, Ha Lan, Jing Ao, Jing Yun, Po, Tuan Zi and Ya Lao Er have 7 / 3 / 6 and score -28. Bei Chen has 7 / 4 / 6 and score -28. All remain multi-source.
- Updated only affected historical coverage expectations in rounds1247-1266, rounds1267-1286, rounds1347-1366, rounds1367-1386, rounds1387-1406, rounds1407-1426, rounds1647-1666, rounds1667-1686 and rounds1707-1726.
- Focused rounds1967-1986 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 98/98. Full local research suite — PASS: 1,374/1,374. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 4,097 files, 778 Subject IDs, 2,726 normalized name keys, 10,933 record IDs, 9,979 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-1986 contain 1,796 batches, 2,000 source-row declarations, 1,679 distinct source IDs, 4,101 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Cui Cui, Er Qiao, Happy, Qing He and Xi Mei, followed by Yao Man, Can Yang, Hua Yang, Xiao Yatou, the Man Lan cub, Qin Hua, Shuang Er, Shuang Xiong, Xing Chen, Xing Guang, Ya Zhu, Wang Yue, Chang Ning, Chang Qing and Da Jiao.
- One coverage-audit invocation was blocked by an external safety check; the identical repository-local command passed immediately on retry with no lost changes.
- npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path. All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-04 — Direct category depth rounds1987-2006

### Forty-eighth depth slice
- Added twenty direct records for Cui Cui, Er Qiao, Happy, Qing He, Xi Mei, Yao Man, Can Yang, Hua Yang, Xiao Yatou, the Man Lan cub, Qin Hua, Shuang Er, Shuang Xiong, Xing Chen, Xing Guang, Ya Zhu, Wang Yue, Chang Ning, Chang Qing and Da Jiao.
- Generated 20 batches, 20 source-row declarations, 20 distinct source IDs, 20 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. All records are medium confidence.
- Record distribution: seven birth events, four identity, two reproduction, two distinguishing-feature, and one each for alias, name, birth, sex and relationship.
- Cui Cui gains a bounded individual-profile identity and remains separate from the 2018 male Cui Cui / Bora. Er Qiao gains the Li Li and Qiao Qiao source-name forms without merging unrelated same-name Subjects. Happy gains the historical Vincennes archive name form.
- Qing He gains the bounded Qi Cheng and Qi Hang offspring roster. Xi Mei gains the exact 2000-08-08 birth anchor and studbook 511. Yao Man gains studbook 759 identity. Can Yang gains directly recorded male sex without birth-order inference.
- Hua Yang gains mother Shui Xiu and the unnamed non-surviving litter-mate outcome without creating an inferred Subject. Xiao Yatou gains studbook 635 identity. The Man Lan cub gains the exact 2025-09-19 22:26 birth event.
- Qin Hua gains the exact 2020-10-11 09:31 birth event and 167 g weight. Shuang Er gains a bounded birth-event bundle with 40 g weight. Shuang Xiong and Ya Zhu gain bounded distinguishing-feature descriptions without immutable identity inference.
- Xing Chen and Xing Guang gain profile-bounded birth-event and twin-role bundles while their mother Xing Ya remains separate from the existing male Netherlands Subject. Wang Yue and Chang Qing gain bounded birth-event bundles. Chang Ning gains direct profile identity. Da Jiao gains the profile-displayed Jiao Ao and Jiao Yi offspring roster.
- No source adds, replaces or reclassifies media. Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds1987-2006.json`.

### Coverage and verification
- Cui Cui, Xi Mei, Yao Man, Can Yang, Hua Yang and Xiao Yatou now have 7 direct / 4 sources / 6 categories and score -28. Er Qiao, Happy and Qing He have 7 / 3 / 6 and score -28.
- The Man Lan cub has 7 / 4 / 9 and score -29. Qin Hua has 7 / 5 / 9 and score -29. Shuang Er has 4 / 2 / 11 and score -29.
- Shuang Xiong, Xing Chen, Xing Guang and Ya Zhu have 4 / 3 / 11 and score -29. Wang Yue, Chang Qing and Da Jiao have 6 / 3 / 8 and score -29. Chang Ning has 6 / 4 / 8 and score -29. All remain multi-source.
- Updated only affected historical coverage expectations in rounds1347-1366, rounds1387-1406, rounds1407-1426, rounds1667-1686 and rounds1687-1706.
- Focused rounds1987-2006 verification — PASS: 8/8 after the sole wording-assertion correction and again after deterministic rerun. Related current and historical verification — PASS: 57/57. Full local research suite — PASS: 1,382/1,382. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 4,137 files, 778 Subject IDs, 2,726 normalized name keys, 10,953 record IDs, 9,999 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-2006 contain 1,816 batches, 2,020 source-row declarations, 1,699 distinct source IDs, 4,121 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Fu Fu, Tao Tao, Ya Zhi, Yu Chen and Yue Hua, followed by Yue Xuan, Zi Ang, Zi Shi, Fei Fei, Gong Zhu, Na Na, Shan Shan, Jin Hui, Kobe, Pang Yuan, Qin Chuan, Wu Jie, Xing Rui, early-lineage Qing Qing and A Bao.
- The first broad context export returned a shared CodexPro 502; split bounded context exports and direct file reads completed the same review without lost changes.
- npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path. All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-04 — Direct category depth rounds2007-2026

### Forty-ninth depth slice
- Added twenty direct records for Fu Fu, Tao Tao, Ya Zhi, Yu Chen, Yue Hua, Yue Xuan, Zi Ang, Zi Shi, Fei Fei, Gong Zhu, Na Na, Shan Shan, Jin Hui, Kobe, Pang Yuan, Qin Chuan, Wu Jie, Xing Rui, early-lineage Qing Qing and A Bao.
- Generated 20 batches, 20 source-row declarations, 20 distinct source IDs, 20 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. All records are medium confidence.
- Record distribution: thirteen birth events, four lineage records, one public debut, one sex record and one identity-history record.
- Fu Fu gains a bounded birth-event bundle with studbook 532, Hetaoping birthplace, mother Long Gu and same-litter Xiang Xiang. Tao Tao gains studbook 633, broad-Wolong birthplace and parents Xi Mei and Lu Lu while the source character form does not overwrite the local name and the selected profile does not re-prove the Si Jia twin relationship.
- Ya Zhi gains studbook 1306, mother Ya Li and fourth-offspring context. Yu Chen gains mother Nuo Mi and first-offspring wording. Yue Hua and Yue Xuan gain profile-bounded older/younger twin roles while mother Nan Xiao Yue remains unresolved.
- Zi Ang and Zi Shi gain studbooks 1407 and 1406 and profile-bounded younger/older twin roles while mother Pan Yue remains unresolved. Fei Fei, Gong Zhu and Na Na gain bounded parent-pair lineage records without complete-roster claims or same-name co-parent linking.
- Shan Shan gains the 2020-06-01 Anshan Zoo first public appearance with Gang Gang. Jin Hui gains a bounded birth-event and older-sibling bundle. Kobe gains parents Su Su and Yue Yue with studbook 386 and Chengdu Zoo birthplace.
- Pang Yuan gains a bounded younger-twin birth event. Qin Chuan gains studbook 713 and parent-name anchors without same-name father linking or twin inference. Wu Jie gains studbook 690, broad-Wolong birthplace and parents Ye Ye and Wu Gang without duplicating the Fu Long roommate context.
- Xing Rui gains a bounded birth-event bundle while profile-displayed birth order remains non-canonical. Early-lineage Qing Qing gains directly recorded female sex with studbook 278 and same-name separation. A Bao gains the documented historical correction from an initial male assumption to confirmed female identity without creating a second Subject.
- No source adds, replaces or reclassifies media. Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds2007-2026.json`.

### Coverage and verification
- Fu Fu, Tao Tao, Ya Zhi, Yu Chen, Yue Hua, Yue Xuan, Zi Ang and Zi Shi now have 6 direct / 3 sources / 8 categories and score -29.
- Fei Fei, Gong Zhu, Na Na and Shan Shan have 8 / 4 / 5 and score -29. Xing Rui also has 8 / 4 / 5 and score -29.
- Kobe, Pang Yuan, Qin Chuan and Wu Jie have 6 / 4 / 8 and score -29. Jin Hui and early-lineage Qing Qing have 6 / 5 / 8 and score -29. A Bao has 6 / 6 / 8 and score -29. All remain multi-source.
- Updated only affected historical coverage expectations in rounds1407-1426, rounds1687-1706 and rounds1707-1726.
- Focused rounds2007-2026 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 35/35. Full local research suite — PASS: 1,390/1,390. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 4,177 files, 778 Subject IDs, 2,726 normalized name keys, 10,973 record IDs, 10,019 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-2026 contain 1,836 batches, 2,040 source-row declarations, 1,719 distinct source IDs, 4,141 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Fu Long, Mei Lan, Tai Shan, the Xi Dou cub and Xi Lan, followed by Fu Duo Duo, Cheng Dui, Cheng Jiu, Cheng Shi, Chun Sheng, Hao Jing, Hao Yu, Hao Yue, He Mei, He Qi, Hua Yan, Ji Ran, Ji Xiao, Jiao Ao and Jiao Yi.
- npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path. All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-04 — Direct category depth rounds2027-2046

### Fiftieth depth slice
- Added twenty direct records for Fu Long, Mei Lan, Tai Shan, the Xi Dou cub, Xi Lan, Fu Duo Duo, Cheng Dui, Cheng Jiu, Cheng Shi, Chun Sheng, Hao Jing, Hao Yu, Hao Yue, He Mei, He Qi, Hua Yan, Ji Ran, Ji Xiao, Jiao Ao and Jiao Yi.
- Generated 20 batches, 20 source-row declarations, 20 distinct source IDs, 20 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. All records are medium confidence.
- Record distribution: fifteen birth events and one each for acoustic research, birthday event, public observation, transfer event and release event.
- Fu Long gains a bounded acoustic-research bundle with about 5,000 calls in the first week, at least four call types in the first three months and continuation of the study in Bifengxia. Legacy `fu-long` evidence is mapped to the canonical Vienna 2007 Subject without recreating the legacy identifier.
- Mei Lan gains the directly captioned 2023-05-29 seventh-birthday event at Dujiangyan, including birthday foods, while remaining separate from the male Atlanta namesake and without promoting birthday chronology into a new canonical birth assertion.
- Tai Shan gains a bounded Smithsonian birth-event bundle. The Xi Dou cub gains a relation-scoped 2025-07-17 Shenshuping public observation without inferred formal name, sex or birth date. Xi Lan gains the May 2014 return-to-China event without ordinal inference.
- Fu Duo Duo gains a birth-event bundle including 187.6 g weight. Cheng Dui, Cheng Jiu, Chun Sheng, Hao Jing, Hao Yue, He Mei, Ji Ran and Ji Xiao gain annual-registry birth-event bundles with explicit missing-field and birth-order boundaries.
- Cheng Shi, Hao Yu, He Qi, Jiao Ao and Jiao Yi gain individual-profile birth-event bundles with studbook anchors while selected profiles do not promote missing birthplaces, fathers or weights.
- Hua Yan gains the 2016-10-20 release event with Zhang Meng to Sichuan Liziping National Nature Reserve; the record remains a specialist-profile snapshot and does not supersede primary holder or studbook evidence.
- No source adds, replaces or reclassifies media. Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds2027-2046.json`.

### Coverage and verification
- Fu Long, Mei Lan and Tai Shan now have 8 direct / 3 sources / 8 categories and score -30. The Xi Dou cub and Xi Lan have 8 / 4 / 8 and score -30. Fu Duo Duo has 8 / 5 / 8 and score -30.
- Cheng Dui, Cheng Jiu, Chun Sheng, Hao Jing, Hao Yue, He Mei, Ji Ran and Ji Xiao have 5 / 2 / 10 and score -30.
- Cheng Shi, Hao Yu, He Qi, Hua Yan, Jiao Ao and Jiao Yi have 5 / 3 / 10 and score -30. All remain multi-source.
- Updated only affected historical coverage expectations in rounds1207-1226, rounds1407-1426, rounds1427-1446, rounds1487-1506, rounds1627-1646, rounds1707-1726, rounds1727-1746 and rounds1927-1946.
- Focused rounds2027-2046 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 81/81. Full local research suite — PASS: 1,398/1,398. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 4,217 files, 778 Subject IDs, 2,726 normalized name keys, 10,993 record IDs, 10,039 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-2046 contain 1,856 batches, 2,060 source-row declarations, 1,739 distinct source IDs, 4,161 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Ke Nian, Lun Hui, Ni Hao, Ni Ke and Ni Na, followed by Run Yue, Xiang Guo, Xiao Chuan, Xing Mei, Xiu Yang, Ya Jun, Yang Hua, Yuan Yue, Zhi Hua, Zhi Shi, Zhi Shu, Er Xi, Kou Kou, Oreo and Sheng Lan.
- npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path. All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-04 — Direct category depth rounds2047-2066

### Fifty-first depth slice
- Added twenty direct records for Ke Nian, Lun Hui, Ni Hao, Ni Ke, Ni Na, Run Yue, Xiang Guo, Xiao Chuan, Xing Mei, Xiu Yang, Ya Jun, Yang Hua, Yuan Yue, Zhi Hua, Zhi Shi, Zhi Shu, Er Xi, Kou Kou, Oreo and Sheng Lan.
- Generated 20 batches, 20 source-row declarations, 20 distinct source IDs, 20 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. All records are medium confidence.
- Record distribution: nineteen birth events and one birthday event.
- Ke Nian gains a bounded birth-event bundle without promoting an unavailable studbook number or birthplace. Lun Hui gains studbook 1264, mother Mei Lun and younger-sibling context while 214.6 g remains annual-registry-sourced. Ni Hao gains studbook 1307 and mother Xiao Ni while preserving the source rendering conflict between 小妮 and 妮小.
- Ni Ke and Ni Na gain profile-bounded studbook, birth-weight, mother and twin bundles; older/younger roles remain explicitly limited to the selected profiles and are not inferred from annual-table order. Run Yue gains the 12:32 birth time and 172.6 g weight. Xiang Guo gains studbook 1239 and first-offspring wording.
- Xiao Chuan gains studbook 958, 89.5 g weight and named twin Xiao Ya with profile-bounded birth order. Xing Mei gains both parents and Yong Yong first-offspring context. The 2025 Xiu Yang gains a Bifengxia birth-event bundle separated from older same-name profile records.
- Ya Jun, Yang Hua, Yuan Yue, Zhi Hua, Zhi Shi and Zhi Shu gain bounded profile birth-event bundles. Yuan Yue preserves the 园月 / 圆月 source-character boundary; Zhi Hua and Zhi Shu sibling order remains profile-displayed rather than inferred from same-date rows.
- Er Xi gains a direct annual-registry birth event. Kobe Kou Kou gains a bounded institutional birth-arrival-death chronology with second-male same-name separation. Oreo gains a holder-reported year-precision birth event while the exact date remains annual-registry-sourced. Sheng Lan gains the 2024-07-19 Shenshuping birthday-season co-feeding event without inferred birth facts.
- No source adds, replaces or reclassifies media. Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds2047-2066.json`.

### Coverage and verification
- Ke Nian, Lun Hui, Ni Hao, Ni Ke, Ni Na, Run Yue, Xiang Guo, Xiao Chuan, Xing Mei, Ya Jun, Yang Hua, Yuan Yue, Zhi Hua, Zhi Shi and Zhi Shu now have 5 direct / 3 sources / 10 categories and score -30.
- Xiu Yang has 5 / 2 / 10 and score -30. Er Xi has 7 / 2 / 7 and score -30. Kou Kou, Oreo and Sheng Lan have 7 / 3 / 7 and score -30. All remain multi-source.
- Updated only affected historical coverage expectations in rounds1207-1226, rounds1227-1246, rounds1427-1446, rounds1447-1466, rounds1467-1486, rounds1487-1506, rounds1727-1746 and rounds1747-1766.
- Focused rounds2047-2066 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 81/81. Full local research suite — PASS: 1,406/1,406. Development acceptance — PASS: `npm run verify:dev -- --scope research`.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 4,257 files, 778 Subject IDs, 2,726 normalized name keys, 11,013 record IDs, 10,059 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-2066 contain 1,876 batches, 2,080 source-row declarations, 1,759 distinct source IDs, 4,181 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Xi Meng, Ya Lao Da, Ya Shuang, Ya Xiang and Ya Yun, followed by Ya Zai, A Ling, Cheng Lan, Da Mei, Gong Zai, He Yu, Jin Shuang, Jiu Jiu, Liu Liu, Long Gu, Nao Nao, Shuang Qing, Shun Shun, Wen Hui and Wen Wen.
- The first broad context export and several reads encountered transient shared 502 errors; split local context reads and one-pass repository scans completed the same evidence review without lost changes. npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path. All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-04 — Direct category depth rounds2067-2086

### Fifty-second depth slice
- Added twenty direct records for Xi Meng, Ya Lao Da, Ya Shuang, Ya Xiang, Ya Yun, Ya Zai, A Ling, Cheng Lan, Da Mei, Gong Zai, He Yu, Jin Shuang, Jiu Jiu, Liu Liu, Long Gu, Nao Nao, Shuang Qing, Shun Shun, Wen Hui and Wen Wen.
- Generated 20 batches, 20 source-row declarations, 20 distinct source IDs, 20 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. All records are medium confidence.
- Record distribution: fourteen birth events, five profile-identity records and one maternal-family profile.
- Xi Meng gains studbook 399, male sex and the 1993-09-19 birth anchor while Tian Tian, Bo Si and Shen Wei relationships remain attached to the independent forestry history.
- Ya Lao Da, Ya Shuang, Ya Xiang, Ya Yun and Ya Zai gain exact normalized-name bindings to separate individual profiles. These records remain identity-only: profile avatars are review inputs rather than new media, and birth, twin, parent or reproduction facts are not re-attributed.
- Ya Zai preserves the Ya Zai / Ya Zi romanisation boundary. A Ling gains studbook 739, female sex, the 2008-09-14 Bifengxia birth and mother Ye Ye while the daughter name Wen Wen / 汶汶 remains unresolved.
- Cheng Lan and Da Mei gain studbooks 1074 and 1073, exact times, weights, mother Cheng Da and profile-displayed twin roles. Gong Zai gains studbook 711 and mother Cheng Gong. He Yu gains studbook 1029 and twin He Feng while 151.9 g remains annual-registry-sourced.
- Jin Shuang gains studbook 1247, mother Miao Miao, twin-name Jin Xi and alias You Xi without creating an unresolved twin Subject. The 2015 Ge Ge offspring Jiu Jiu gains a bounded maternal-family profile and remains separate from the 2018 Hua Mei offspring 玖玖 and the Madrid same-romanisation Subject; conflicting Pandapia birth fields remain excluded.
- Liu Liu and Shun Shun gain exact times, weights, mother Xiao Ya Tou and profile-displayed twin roles; Shun Shun remains separated from the Hainan namesake. Long Gu remains year-precision only with studbook 414 and a bounded reproductive summary.
- Nao Nao and Shuang Qing gain profile-bounded birth bundles without strengthening same-date sibling wording into unsupported twin terminology. Wen Hui gains studbook 960 from a unique profile-name match while mother, birthplace and sole-survivor context remain independently sourced. Wen Wen gains studbook 994 and mother Wen Li without promoting a father or birthplace.
- No source adds, replaces or reclassifies media. Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds2067-2086.json`.

### Coverage and verification
- Xi Meng, Ya Lao Da, Ya Shuang, Ya Xiang, Ya Yun and Ya Zai now have 7 direct / 3 sources / 7 categories and score -30.
- A Ling, Gong Zai, He Yu, Jin Shuang, Nao Nao, Shuang Qing and Wen Wen have 5 / 3 / 10 and score -30. Cheng Lan, Da Mei, Jiu Jiu, Liu Liu, Long Gu, Shun Shun and Wen Hui have 5 / 4 / 10 and score -30. All remain multi-source.
- Updated only affected historical coverage expectations in rounds1207-1226, rounds1227-1246, rounds1367-1386, rounds1387-1406, rounds1407-1426, rounds1427-1446, rounds1467-1486, rounds1627-1646, rounds1647-1666, rounds1707-1726, rounds1747-1766, rounds1767-1786 and rounds1927-1946.
- Focused rounds2067-2086 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 130/130. Full local research suite — PASS: 1,414/1,414. Development acceptance — PASS: `npm run verify:dev -- --scope research`, which reran all 1,414 tests.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 4,297 files, 778 Subject IDs, 2,726 normalized name keys, 11,033 record IDs, 10,079 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-2086 contain 1,896 batches, 2,100 source-row declarations, 1,779 distinct source IDs, 4,201 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Wen Xi, Wu Jun, Wu Wen's 2024 Cub B, Xiao Bao and Xing Yi, followed by Bao Xin, Chuan Chuan, Jing Rong, Liang Liang, Ya Guang, Ya Lin, Ya Xing, Yuan Xiao, Ai Bang, Ba Xi, Bing Dian, Chao Chao, Hua Li, Jing Bao and Li Dui.
- A shared CodexPro 502 outage temporarily blocked the post-update validation chain across several connectors. The original PandaAtlas connection later recovered; affected modules, the full suite and the development gate all passed without further file changes.
- npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path. All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-04 — Direct category depth rounds2087-2106

### Fifty-third depth slice
- Added twenty direct records for Wen Xi, Wu Jun, Wu Wen's 2024 Cub B, Xiao Bao, Xing Yi, Bao Xin, Chuan Chuan, Jing Rong, Liang Liang, Ya Guang, Ya Lin, Ya Xing, Yuan Xiao, Ai Bang, Ba Xi, Bing Dian, Chao Chao, Hua Li, Jing Bao and Li Dui.
- Generated 20 batches, 20 source-row declarations, 20 distinct source IDs, 20 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. All records are medium confidence.
- Record distribution: eleven birth events and one each for neonatal event, public event, breeding event, profile identity, transfer event, mating event, public observation, pre-release event and migration event.
- Wen Xi gains a bounded profile birth-event bundle with studbook 1424 while previous-name and birthplace evidence remain independent. Wu Jun gains studbook 689, Wolong birthplace, mother Ye Ye and a profile-displayed twin role that does not become canonical birth order.
- Wu Wen's second 2024 cub gains a relation-scoped neonatal event: local date 2024-07-12, more than one hour after the surviving cub, visibly smaller and dying soon after birth. Sex, numeric weight and the surviving cub's name remain unresolved, and the Beijing-date profile rendering does not overwrite the local report date.
- Xiao Bao gains a bounded profile birth event while retaining the annual source's 8/9 August uncertainty and no canonical birth-order resolution. Xing Yi gains studbook 899, mother Xing Rong and twin Xing Er while alias, birthplace and twin order remain source-bounded.
- Bao Xin gains the official 2021 Chengdu newborn online-presentation context without adoption, ownership or exact-event-date inference. Chuan Chuan gains the 1992 Shanghai-to-Chongqing breeding event with Xin Xing and first-litter outcome without individual cub attribution.
- Jing Rong gains a year-precision 1992 Chengdu Zoo birth event with mother Qing Qing and same-birth sibling Li Li. Liang Liang gains the exact 1983-06-22 Chapultepec birth, male sex and parent lineage while no death date is inferred.
- Ya Guang gains a specialist studbook identity bundle with number 530, parents and same-litter Ya Xiang; the interface remains secondary rather than a primary studbook. Ya Lin gains the 2013-01-09 Hangzhou-to-Chengdu breeding-programme transfer and remains separate from the Macao namesake.
- Ya Xing gains the early-March 2025 natural-mating chronology with Ling Lang without automatic sire attribution. Yuan Xiao gains an image-specific 2026-06-03 Shenshuping public observation without new behaviour, birth or media claims.
- Ai Bang gains a bounded birth-event bundle with studbook 663, mother Meimei and twin Ming Bang. Ba Xi gains the 2017-11-21 pre-release examination, measurements, normal indicators and telemetry collar without converting the report's upcoming release into a completed event.
- Bing Dian gains bounded Shenzhen, Chengdu Zoo and Luoyang institutional periods plus a March 2015 Chengdu Base observation; chronology gaps and current residence remain unresolved. Chao Chao gains a profile birth event without strengthened twin terminology or canonical birth order.
- Hua Li, Jing Bao and Li Dui gain profile-bounded studbook, date and sex birth-event bundles. Jing Bao and Li Dui retain the annual table's Gengda Shenshuping birthplace despite conflicting profile wording; profile avatars are not duplicated.
- No source adds, replaces or reclassifies media. Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds2087-2106.json`.

### Coverage and verification
- Wen Xi, Wu Jun, Wu Wen's 2024 Cub B, Xiao Bao and Xing Yi now have 5 direct / 3 sources / 10 categories and score -30.
- Chuan Chuan, Jing Rong, Liang Liang and Ya Lin have 7 / 3 / 7 and score -30. Bao Xin, Ya Guang, Ya Xing and Yuan Xiao have 7 / 4 / 7 and score -30.
- Ai Bang, Ba Xi, Chao Chao, Hua Li, Jing Bao and Li Dui have 5 / 4 / 10 and score -30. Bing Dian has 5 / 5 / 10 and score -30. All remain multi-source.
- Updated only affected historical coverage expectations in rounds1207-1226, rounds1227-1246, rounds1247-1266, rounds1367-1386, rounds1387-1406, rounds1447-1466, rounds1467-1486, rounds1627-1646, rounds1647-1666, rounds1727-1746, rounds1747-1766, rounds1767-1786, rounds1927-1946 and rounds1947-1966.
- Focused rounds2087-2106 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 135/135. Full local research suite — PASS: 1,422/1,422. Development acceptance — PASS: `npm run verify:dev -- --scope research`, which reran all 1,422 tests.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 4,337 files, 778 Subject IDs, 2,726 normalized name keys, 11,053 record IDs, 10,099 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-2106 contain 1,916 batches, 2,120 source-row declarations, 1,799 distinct source IDs, 4,221 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Mei Mei, Miao Yin, Shen Shen, Xing Ya and Ya Ao, followed by Bing Zai, Feng Yi, Fu Shuang, He He of Shenshuping, Nong Nong, Chengdu Qian Qian, Sen Sen, Xing Rong, An An's 2023 Cub A, An An's 2023 Cub B, Du Du, Ge Ge's He He, Lan Zai, Lang Lang and Xiao He Tao.
- The first complete-suite run exposed fourteen stale coverage expectations only; after targeted updates, affected modules, the full suite and the development gate all passed.
- npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path. All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-05 — Direct category depth rounds2107-2126

### Fifty-fourth depth slice
- Added twenty direct records for Mei Mei, Miao Yin, Shen Shen, female Chengdu Xing Ya, Ya Ao, Bing Zai, Feng Yi, Fu Shuang, male Shenshuping He He, Nong Nong, Chengdu Qian Qian, Sen Sen, Xing Rong, An An's 2023 Cub A, An An's 2023 Cub B, Du Du, female Ge Ge-offspring He He, Lan Zai, Lang Lang and Xiao He Tao.
- Generated 20 batches, 20 source-row declarations, 20 distinct source IDs, 20 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. All records are medium confidence.
- Record distribution: fourteen birth events and one each for reproduction event, planned-transfer event, wild-introduction event, public profile, public observation and rewilding event.
- Founder Mei Mei remains year-precision with studbook 152 and no inferred exact birthday. Miao Yin gains studbook 781. Shen Shen gains a bounded profile birth bundle with approximate 160 g weight while conflicting twin-role evidence remains unresolved.
- Female Chengdu Xing Ya gains studbook 681, mother Er Yatou, same-litter Xing Rong and Chengdu birthplace while remaining separate from the male Ouwehands namesake. Ya Ao gains studbook 583, date, sex and mother Princess without allowing profile location wording to overwrite broader Wolong evidence.
- Bing Zai gains a birth-event bundle with alias Bing Dundun, 148.2 g weight, mother Bing Bing and same-litter Bing Bao. Feng Yi gains the 2015-05-07 natural mating and 2015-08-18 13:45 Kuala Lumpur parturition chronology without an inferred cub name.
- Fu Shuang gains a planned Zoo Atlanta transfer under the 2026 cooperation agreement; arrival and current residence are not asserted. Male Shenshuping He He gains the wild-introduction twin milestone with Mei Mei without inferred paternity.
- Nong Nong gains the public growth-story profile and nickname Mu Qu Chen. Chengdu Qian Qian gains studbook 881 while remaining separate from Ya'an Qian Qian. Sen Sen gains an image-specific 2025-11-06 Shenshuping observation without inferred behaviour or new media.
- Xing Rong gains the first Dujiangyan rewilding-cohort context with studbook 680, both parents and 86 kg programme weight; no individual entry date is inferred.
- An An's 2023 older and younger cubs gain profile-bounded birth events while the mixed-sex litter remains unassigned at individual level. Du Du remains separate from the historical 1986 namesake and gains no unsupported parentage.
- Female Ge Ge-offspring He He gains studbook 970 while the 2015-08-08 versus 2015-08-10 date conflict and male same-name boundaries remain explicit. Lan Zai gains studbook 592. Lang Lang retains the 2010-12-16 versus 2010-12-18 death-date conflict. Xiao He Tao gains studbook 1019 without duplicating wild-training or release history.
- No source adds, replaces or reclassifies media. Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds2107-2126.json`.

### Coverage and verification
- Mei Mei, Miao Yin, Shen Shen, female Xing Ya and Ya Ao now have 5 direct / 4 sources / 10 categories and score -30.
- Chengdu Qian Qian has 7 / 4 / 7 and score -30. Bing Zai, Feng Yi, Fu Shuang, male He He, Nong Nong, Sen Sen and Xing Rong have 7 / 5 / 7 and score -30.
- An An's two 2023 cubs, Du Du, female Ge Ge-offspring He He, Lan Zai, Lang Lang and Xiao He Tao have 5 / 5 / 10 and score -30. All remain multi-source.
- Updated only affected historical coverage expectations in rounds1227-1246, rounds1367-1386, rounds1447-1466, rounds1467-1486, rounds1487-1506, rounds1627-1646, rounds1647-1666, rounds1767-1786, rounds1787-1806 and rounds1947-1966.
- Focused rounds2107-2126 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 94/94. Full local research suite — PASS: 1,430/1,430. Development acceptance — PASS: `npm run verify:dev -- --scope research`, which reran all 1,430 tests.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 4,377 files, 778 Subject IDs, 2,726 normalized name keys, 11,073 record IDs, 10,119 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-2126 contain 1,936 batches, 2,140 source-row declarations, 1,819 distinct source IDs, 4,241 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Can Can's cub, Ke Lin, Shui Xiu and Xiao Yuan Qi, followed by Fu Wa, Yuan Man, Chi-Chi, Huan Huan, Kang Kang, Qi Xi, Run Yang, Xiang Bing, Ai Bang's 2016 Cub 66, Ai Jiu, Ai Lin, Ai Si, An An's 2022 cub, Bing Xue, Mei Mei of Qi Yuan's line and Xi Yue.
- The first complete-suite run exposed ten stale coverage modules only; after targeted updates and one additional Lang Lang shape correction, affected modules, the full suite and the development gate all passed.
- npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path. All records remain offline-only; no formal-vault import, commit or push was performed.

## Session: 2026-08-05 — Direct category depth rounds2127-2146

### Fifty-fifth depth slice
- Added twenty direct records for Can Can's cub, Ke Lin, Shui Xiu, Xiao Yuan Qi, Fu Wa, Yuan Man, Chi-Chi, Huan Huan, Kang Kang, Qi Xi, Run Yang, Xiang Bing, Ai Bang's 2016 Cub 66, Ai Jiu, Ai Lin, Ai Si, An An's 2022 cub, Bing Xue, Mei Mei of Qi Yuan's line and Xi Yue.
- Generated 20 batches, 20 source-row declarations, 20 distinct source IDs, 20 distinct reviewed URLs, 20 direct fact records and 80 deterministic artifacts. All records are medium confidence.
- Record distribution: four birth events, six profile-identity records and one each for parturition, adoption identity, public observation, birthday, capture-transfer, breeding, archival-video profile, maternal-family profile, neonatal event and village observation.
- Can Can's photographed cub remains unresolved between same-date litter mates Can Yang and Qing Yang; the shared 2024-09-10 date is retained without assigning individual name or sex. Ke Lin gains studbook 678, date, sex and mother Jiao Zi without duplicating the Rong Yao relationship or avatar.
- Shui Xiu gains the 2016-09-05 23:05 Hetaoping semi-wild-enclosure parturition, 155-day gestation and Xiang Ge mating context without an inferred cub name. Xiao Yuan Qi remains an adoption-name identity with official or studbook name and primary identity confirmation pending.
- Fu Wa gains an image-specific 2025-12-29 Mianyang observation and remains separate from Ke Lin's 2015 female twin namesake. Yuan Man gains the dated ninth-birthday event with Qi Guo, food and enrichment context.
- Chi-Chi gains the 1957-07-04 capture, Peking Zoo transport, 1958 selection and 1958-09-05 London arrival chronology; the approximate age at capture does not create an exact birth date.
- Huan Huan gains the Fei Fei breeding relationship and Japan's first successful giant-panda artificial-insemination breeding milestone with year-precision birth context. Kang Kang gains an official Ueno historical-video identity profile without thumbnail behaviour inference or media duplication and remains separate from Macao and Shanghai namesakes.
- Qi Xi gains studbook 925 while retaining the 七喜 / 奇喜 name conflict. Run Yang gains studbook 1326, female sex and same-day brother Run Ze without twin inference. Xiang Bing gains studbook 665 and bounded maternal and offspring roles while the exact Bing Bing Subject remains unresolved.
- Ai Bang's 2016 cub remains identified by milk name 66, without a studbook or inferred death date. Ai Jiu gains studbook 1235, exact time, 219 g weight and immediate maternal holding. Ai Lin and Ai Si retain profile-bounded twin roles without independent clock-time birth order.
- An An's 2022 cub remains separate from other An An maternal identities and gains no duplicated annual weight or location. Bing Xue retains unsupported twin status. Mei Mei gains the corrected 梅梅 name, studbook 408 and daughter Qi Yuan while remaining separate from founder Mei Mei studbook 152.
- Xi Yue gains only the official captioned observation of eating honey at a villager's home; birth, location history, paternity and the existing verified image are not duplicated.
- No source adds, replaces or reclassifies media. Formal evidence review is stored at `data/local-panda-research/media/audits/direct-evidence-audit-rounds2127-2146.json`.

### Coverage and verification
- Can Can's cub and Shui Xiu now have 7 direct / 6 sources / 7 categories and score -30. Ke Lin has 7 / 5 / 7 and score -30. Xiao Yuan Qi has 5 / 6 / 10 and score -30.
- Fu Wa has 9 / 4 / 7 and Yuan Man has 9 / 5 / 7, both score -31. Chi-Chi, Huan Huan and Kang Kang have 8 / 2 / 8 and score -35.
- Qi Xi, Run Yang and Xiang Bing have 4 / 2 / 12 and score -31. Ai Bang's 2016 cub, Ai Jiu, Ai Lin, Ai Si, An An's 2022 cub and Bing Xue have 6 / 2 / 9 and score -31.
- Mei Mei of Qi Yuan's line has 8 / 2 / 6 and Xi Yue has 8 / 3 / 6, both score -31. All twenty remain multi-source.
- Updated only affected historical coverage expectations in rounds1247-1266, rounds1387-1406, rounds1487-1506, rounds1507-1526, rounds1627-1646, rounds1647-1666, rounds1787-1806, rounds1807-1826 and rounds1947-1966.
- Focused rounds2127-2146 verification — PASS: 8/8 before and after deterministic rerun. Related current and historical verification — PASS: 86/86. Full local research suite — PASS: 1,438/1,438. Development acceptance — PASS: `npm run verify:dev -- --scope research`, which reran all 1,438 tests.
- Research validation — PASS: 691 deduplicated sources, 4,099 records, 4,026 direct records, 72 secondary leads, 352 Subjects and 37 categories.
- Refreshed index: 4,417 files, 778 Subject IDs, 2,726 normalized name keys, 11,093 record IDs, 10,139 Subject/predicate keys, 1,558 media IDs, 1,330 confirmed-Subject media IDs, 1,549 asset URLs and 695 SHA-256 values.
- Refreshed coverage audit remains at 1,558 candidate rows, 671 Subjects with individual media, zero media-covered Subjects without facts and four fact-bearing Subjects without individual media.
- Combined rounds191-2146 contain 1,956 batches, 2,160 source-row declarations, 1,839 distinct source IDs, 4,261 fact records, 371 total media rows, 360 confirmed individual media rows and 369 distinct assets.
- The next queue begins with Hui Hui, Xian Xian and Xiang Shan, followed by Ao Ao, Ao Ke, Ao Ran, Bao Ge, Bao Mei, Bing Cheng, Bo Wen, CC, Cheng Feng, Cheng Lang, Chu Xin, Chun Chun, Chun Hui, Chun Lai, Da Ni, Fu Sheng and Han Han.
- The first complete-suite run exposed nine stale coverage modules only; after targeted expectation updates, affected modules, the full suite and the development gate all passed.
- npm scripts were executed through `cmd.exe` because Node remained unavailable in the Linux Bash path. All records remain offline-only; no formal-vault import, commit or push was performed.
