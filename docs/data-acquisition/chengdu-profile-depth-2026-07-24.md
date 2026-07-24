# Chengdu profile-depth release — 2026-07-24

## Scope

This slice deepens four Chengdu profiles that were previously published as identity-first records:

- Bao Xin (`bao-xin`)
- Zhen Xi (`zhen-xi`)
- Qing Qing (`qing-qing-chengdu-2017-07-26`)
- Xiao Xin (`xiao-xin-chengdu-2017`)

It deliberately does not broaden to another institution.

## Official evidence added

The reviewed sources are exact Chengdu Research Base pages:

- the bilingual 2021 newborn profiles;
- the bilingual 2017 newborn cohort profiles;
- the 2024 official Zhen Xi observation article.

They support the four birth records, maternal names, reported birth weights, cohort presentations, and the 2024-04-01 Zhen Xi observation.

## Lineage

Four confirmed maternal assertions were added:

| Child | Mother | Status |
| --- | --- | --- |
| Bao Xin | A Bao / 阿宝 | confirmed |
| Zhen Xi | Qi Zhen / 奇珍 | confirmed |
| Qing Qing | Er Qiao / 二巧 | confirmed |
| Xiao Xin | Xiao Yatou / 小丫头 | confirmed |

The mother records are identity-first dependency profiles. Only the names and maternal roles confirmed by the exact official newborn pages were promoted. Secondary birth dates and current-location fields were intentionally not promoted. Fathers remain unknown.

## Events

The release contains exact-date birth and public-debut events for all four profiles. Zhen Xi also has an official observation event dated 2024-04-01.

`observation` was added to the shared Panda event contract. The Web timeline now renders the actual event type instead of labelling every event as a transfer.

## Media

Four official-source collection images were processed into eight immutable WebP derivatives.

- Bao Xin: individually associated with the official profile block.
- Zhen Xi: individually identified by the official caption.
- Qing Qing and Xiao Xin: cohort images only. Their alt text and curator notes explicitly avoid claiming which animal is which within the image.

The Chengdu file host requires the article URL as the HTTP `Referer`. The media processor now supplies the reviewed `source_url` as the controlled Referer for remote assets.

## Curation result

- sources: 361
- panda rows: 813
- events: 291
- media rows: 14

## Immutable release

- base: `2026.07.24.1`
- candidate: `2026.07.24.2`
- API panda profiles: 38
- events: 43
- facts: 109
- parentage assertions: 24
- media records: 38
- sources: 43
- Public Schema: `1.2.0`
- database migration: `0007`

Public Release manifest SHA-256:

`d2b3b6cc45ad5475e56df9d144bb6079fee01416201ebd3ea3fe8e4c72400b10`

D1 SQL SHA-256:

`88a6f573f06fddcb1e5ca2aced86cfb79eb7a350a1bc1fb4f0f23ef1bc0d75f7`

## Verification

- reviewed batch reproducibility check: passed;
- curation validator: passed;
- focused profile-depth/media/Public Release tests: 69 passed;
- full API regression: 287 passed, 13 skipped;
- Worker typecheck: passed;
- Web lint, typecheck, and production build: passed;
- private collection Release Gate: 7/7 passed.
