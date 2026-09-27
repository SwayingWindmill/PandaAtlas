# ZhiPanda individual panda detail template v2

## Decision

The detail page uses one stable template for all panda individuals. **Chester Zoo remains the visual-world reference**: strong photography, the floating pill navigation, deep-teal/forest fields, large type, restrained natural accent surfaces, generous chapter spacing, image-led transitions and minimal chrome. **Monterey Bay Aquarium's Blacktip Reef Shark page is the opening information-architecture reference**: the main animal image and durable profile facts form one first-viewport identity scene instead of a Hero followed by a second Overview block.

Other individual-animal sites inform **what information is worth presenting and how the opening facts are ordered**, not a second competing visual language.

The template is progressive. It never requires every panda to fill every chapter.

## Reading order

### Layer 1 — identity (the normal core)

1. Combined Hero + Profile Overview identity scene — image/no-photo field plus stable identity facts in one first viewport
2. Infinite verified-photo carousel inside the Hero media field when enough confirmed media exists
3. About / 关于{name}
4. Panda Facts — 2–6 high-value display facts that add to, rather than repeat, the Overview

### Layer 2 — the individual world (conditional)

5. How to recognize — only when recognition data remains after the quick Facts card
6. Personality & daily life — only when multiple additional behaviour/personality records remain
7. Family — only when confirmed relationships exist
8. Life stories — only when additional breeding/rescue/care/significance facts remain after the quick Facts card
9. Life Track — only when timeline events exist
10. Places lived — only when residency/place evidence exists

### Layer 3 — continuation (conditional/supporting)

11. Recent moments — only for living pandas with a recent dated moment (18-month window)
12. Photo archive — only when verified media remains after Hero/carousel/story media
13. Sources — quiet, expandable support layer
14. Continue to a related panda — full-photo ending when a usable relation exists

## Current canonical research/detail status

The research/detail projection is regenerated from the canonical research store rather than hard-coded. A fresh audit on **2026-09-27** reports **1287 canonical subjects in both the catalogue and detail projection**, with **0 critical profile contradictions**. Of those subjects, 810 have no flagged audit issue and 477 have at least one warning or informational completeness/media issue. Current queues include 329 subjects that have individual media but no Hero-eligible photograph under the strict UI policy, 116 subjects whose direct records remain below the detail-promotion threshold, 13 subjects with public highlights not yet promoted into profile fields, and 12 deliberately sparse profiles without a public fact payload.

This count is not the same as the strict curation CSV layer or the active PublicRead release. The curation layer currently validates **813 panda rows**; the research/detail canonical layer contains **1287 subjects**; the public site must show only the subjects in the active Publication/PublicRead release. Treat these as three different lifecycle layers rather than competing totals.

## Coverage snapshot — 2026-09-08, 1157-subject frontend research catalogue

The following detailed coverage table is a dated **2026-09-08** snapshot rebuilt via `.ai-bridge/fan-v08-research-catalog.json` and `fan-v08-research-details.json`. At that point the generated frontend catalogue contained **1157 canonical detail subjects**; 1106 matched the then-current detail projection and 993 had safe direct records. Keep these percentages as a historical baseline until the full coverage metrics are regenerated for the current 1287-subject catalogue.

| Capability | Pandas | Coverage | Template consequence |
| --- | ---: | ---: | --- |
| Confirmed individual media in the research store | 902 | 78.0% | Media identity coverage is broad, but not every confirmed asset is suitable as a photographic Hero. |
| Hero-eligible real photograph under the current strict UI filter | 531 | 45.9% | A first-class no-photo Hero is a normal state, not an edge case; avatar/profile PNGs are not promoted as photographs. |
| No individual media at all | 255 | 22.0% | These profiles rely entirely on the combined no-photo + identity Overview opening. |
| At least one usable projected research fact | 889 | 76.8% | About/story content is broadly available. |
| About-ready core/facts | 952 | 82.3% | Most profiles can support a meaningful introduction. |
| 2+ projected facts before semantic display-slot reduction | 707 | 61.1% | Panda Facts is a majority pattern, while semantic selection may reduce the final card count. |
| 4+ projected facts before semantic display-slot reduction | 463 | 40.0% | Rich profiles are common but not universal. |
| Place/residency fact | 541 | 46.8% | Places is a substantial optional chapter, not a required slot. |
| At least one timeline moment | 640 | 55.3% | Life Track is broadly useful but not guaranteed. |
| Confirmed structured family relation | 622 | 53.8% | Family is now available to a majority after relation-value extraction was fixed upstream. |
| Rich life-story depth (2+ life/significance facts) | 296 | 25.6% | Full Life Stories belongs to richer profiles only. |
| Living panda with a dated moment in the last 18 months | 240 | 20.7% | Recent Moments is a valuable living-profile feature, not a default chapter. |
| Personality depth (3+ daily-life facts) | 123 | 10.6% | Dedicated personality scenes should remain selective and meaningful. |
| Recognition depth (2+ strict appearance/distinguishing facts) | 11 | 1.0% | Dedicated “How to recognize” remains a premium sparse-data chapter; acquisition should target this field if broader coverage is desired. |
| Sources | 999 | 86.3% | Trust/support layer has strong coverage. |
| Essentially name-only records | 64 | 5.5% | Sparse/no-photo page state must remain intentionally minimal rather than padded. |

For this dated 2026-09-08 coverage snapshot, the repeatable full-profile audit (`scripts/prototypes/audit_fan_v08_detail_profiles.py`) reported **0 critical profile contradictions**. The current 2026-09-27 audit status and queues are recorded above; do not use this snapshot's older queue sizes as current operating totals.

## Conclusion from coverage

**Yes: the majority of pandas can satisfy the core detail template. No: the majority cannot and should not satisfy every advanced chapter.**

The system therefore treats Layer 1 as the normal experience and Layer 2/3 as progressive enrichment. The page should become longer because the panda has richer evidence, never because the template demands decorative completeness.

## Profile classification — two axes, not one panda-type enum

The detail template now derives a conservative profile classification from qualified facts. This is a **presentation projection**, not a replacement for archive facts, and it is not shown as a public badge by default.

### Era axis

- `living` — explicitly alive.
- `historical` — explicitly deceased or has a confirmed death date.
- `unknown` — no safe current/deceased conclusion.

“Historical panda” therefore describes the record's time state, not its origin. A historical individual can still have a managed, wild-rescue or release journey.

### Life-journey axis

- `managed` — strong managed-care evidence such as residency, transfer, husbandry, enrichment, public debut or diplomacy.
- `wild_native` — explicit subject-level wild identity/monitoring evidence without stronger managed/rescue/release evidence.
- `wild_rescued_in_care` — explicit wild rescue with no confirmed return to the wild.
- `wild_rescued_released` — explicit wild rescue plus confirmed release/return to the wild.
- `rewilding_training` — the individual itself is explicitly in wild-training/reintroduction preparation; maternal helpers are not automatically classified as trainees.
- `rewilding_released` — explicit rewilding-training evidence plus confirmed release.
- `released_to_wild` — a confirmed release exists, but the current evidence does not safely establish whether the origin was wild-rescue or captive-born reintroduction.
- `unknown` — the detail projection does not contain enough evidence to classify the life journey safely.

The model deliberately preserves `unknown` instead of inferring from a name, zoo association or a missing rescue record. This means “normal captive panda”, “wild panda”, “wild-rescue panda” and “rewilding panda” are now distinct template contexts, while `historical` remains orthogonal to all of them.

The classification is available on the prototype detail root as `data-profile-era` and `data-profile-journey` so browser QA and future conditional copy/layout can verify the correct template context without adding visual chrome.

The dated 2026-09-08 conservative audit over the 1157-subject schema-v2 projection found **541 living**, **193 historical** and **423 unknown-era** profiles. For the life-journey axis it proved **372 managed**, **9 wild-rescued in care**, **3 wild-rescued and released**, **9 rewilding-training**, **2 rewilding-released**, **6 other confirmed releases whose origin/training path was not yet safe to infer**, and **1 explicitly native-wild monitored** profile; the remaining **755** were `unknown` on this axis. These numbers measure **classification evidence coverage**, not the real biological/captive population split; collection should improve them rather than the UI guessing.

## Content selection rules

### Panda Facts

- 2–6 cards.
- One card per semantic slot: identity, birth, personality/daily life, family, place, life event, significance.
- No one-card chapter.
- Administrative fallbacks (sex, deceased status, studbook) only fill sparse records and otherwise live as quiet metadata.
- Acquisition/editorial mechanics (`Subject`, slug, internal IDs, media discovery notes, Commons file metadata) never enter public cards.

### Deep trait chapters

Quick Facts is the first summary layer. Dedicated chapters only use **additional** facts not already consumed by a quick card.

- Recognition: strict `appearance` / `distinguishing_feature` evidence.
- Personality: multiple additional personality/behaviour/preference/routine/social observations.
- This prevents the page from repeating the same single fact as both a card and a full-screen chapter.

### Family and life-story composition

- Family uses one current-panda anchor portrait plus an asymmetric relative wall. The 1/2/3/4-relative states recompose instead of reserving empty grid cells.
- Life Stories are editorially ranked from the qualified fact set. Rescue/release, wild follow-up, conservation/diplomacy, major milestones and meaningful parenting/reproduction lead; measurements, age snapshots and image-capture metadata are supporting material only.
- A story category made only of low-value measurements/snapshots does not create its own large chapter.
- Public story copy removes acquisition/curation tail notes such as “do not infer…” while preserving the underlying sourced fact and uncertainty.

### Recent moments

- Living pandas only.
- Dated moments within 18 months of the generated detail projection.
- Up to three newest items in the detail page, with a continuation link to all Moments.

## Visual contract

- Chester Zoo is the single visual parent.
- Deep teal/forest is the world colour; natural pale green and warm reading surfaces support it.
- No new visual language is imported from the information-architecture references.
- Large sections, not dashboard containers.
- Photography and type create hierarchy; borders and UI chrome stay secondary.
- No rainbow Facts palette.
- Missing content removes the chapter entirely.

## Acquisition priorities suggested by the template

The current template analysis also gives the data collection system a clear breadth-first target order:

1. **Recognition traits** — only ~1% currently have enough depth for a dedicated scene.
2. **Personality / daily behaviour** — dedicated-scene depth is ~11%.
3. **Family relations** — ~27% have structured relations.
4. **Recent dated moments for living pandas** — ~22% currently support a recent-update chapter.
5. **Life-story facts** — ~27% have enough depth for a real story chapter.
6. Continue broad photo coverage, already strong at ~82%.

These are enrichment priorities, not gates for publication.
