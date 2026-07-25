# Local Panda Research Vault

This directory is the local-first research layer for Panda Atlas. It is intentionally broader than the current website and publication contracts. Records may be incomplete, conflicting, anecdotal, historic, or unsuitable for public release. Nothing in this directory is automatically promoted to production.

## Purpose

Capture as much traceable giant-panda information as practical before deciding what the future product should expose. The vault accepts:

- identity, aliases, name meanings, transliterations, and external identifiers;
- birth, death, sex, parentage, offspring, siblings, and other relationships;
- institutions, current and historic locations, transfers, returns, quarantine, and public debuts;
- health, veterinary care, reproduction, growth measurements, and husbandry training;
- personality, habits, preferences, keeper observations, enrichment, vocalisations, and other anecdotes;
- appearance and distinguishing features useful for individual identification;
- research, conservation, diplomacy, cultural context, public events, and notable milestones;
- photographs, video, livestream, archive, and rights leads without assuming reuse permission;
- unresolved claims, contradictions, secondary leads, and material that needs a primary source.

## Files

- `sources.jsonl` — one source page or dataset per line.
- `records/*.jsonl` — append-only research assertions and leads.
- `collection-plan.json` — coverage goals and collection priorities.
- `reports/coverage-gaps.json` — generated comparison of media holdings and structured fact coverage.
- `imports/` — reviewed, reproducible local import batches.
- `media/` — media candidates, generated local inventory, discovery evidence, and ignored local binaries.

## Record rules

1. Every record must point to a source in `sources.jsonl`.
2. Preserve the source language and write a concise factual summary instead of copying long prose.
3. Use `evidence_level=direct` only when the source explicitly supports the assertion.
4. Use `evidence_level=secondary_lead` for news reports, enthusiast databases, search results, or other material that should later be reconciled with a primary source.
5. Set `publication_status=local_only` for every record in this vault.
6. Conflicting assertions are stored separately; do not overwrite either claim.
7. Media rights status is preserved as metadata but does not block local collection or reduce local acquisition priority.
8. Do not store copyrighted media bytes in Git.
9. Do not store sensitive wild-panda coordinates or current movement information.
10. Automated collection must respect robots rules, terms, rate limits, authentication, and technical blocking.

## Validation and collection

```bash
npm run check:local-panda-research
npm run test:local-panda-research
npm run audit:local-panda-research
npm run import:local-panda-research-batch -- --batch <batch.json> --output <records.jsonl>
npm run check:local-panda-media
npm run collect:local-panda-media
npm run extract:local-panda-media-facts
npm run test:local-panda-media
```

The validator checks JSONL syntax, IDs, source references, timestamps, local-only publication status, evidence/review compatibility, and controlled vocabularies. The coverage audit compares structured facts with collected media, identifies pandas represented only by thin media metadata, and writes `reports/coverage-gaps.json` for the next official-source pass.

## Current snapshot

As of 2026-07-26, the vault contains **425 sources** and **2,853 structured records**: 2,836 direct-evidence records and seventeen explicitly marked secondary leads requiring primary-source follow-up. The evidence layer is dominated by institutional, government, archival, and official-zoo material. Media coverage spans 102 individually identified pandas, with no collected individual lacking at least one structured fact record.

The local media layer contains **475 candidates**, **468 downloaded files**, and **1,033,373,613 bytes** of binaries. Rights metadata is retained but does not gate local acquisition. Seven candidate URLs remain failed and are preserved as replacement leads.

## Collection log

- `2026-07-24-initial-web-research.jsonl` — first cross-regional pass across current profiles, transfers, health, anecdotes and media leads.
- `2026-07-24-overseas-official-profiles.jsonl` — official-source pass for Taipei, Ouwehands, Vienna, Copenhagen and Qatar, with detailed husbandry, enrichment, identity-correction and reproductive-behaviour records.
- `2026-07-25-official-followup.jsonl` and `2026-07-25-official-expanded.jsonl` — expanded overseas profiles, recent births, behaviour, husbandry and reproduction follow-up.
- `2026-07-25-media-derived-facts.jsonl` — reproducible extraction of explicit identity, date, location, behaviour, research, cultural and historical facts from reviewed media candidates.
- `2026-07-25-xiao-qi-ji-columbus.jsonl` — Xiao Qi Ji official development timeline plus 1992 Columbus Zoo historical-loan evidence.
- Dedicated official-source batches cover Edinburgh Tian Tian and Yang Guang, Malaysia's panda programme, Beijing Da Di/Gu Gu/Fu Xing, London Chi Chi, Fuzhou Basi, Ocean Park An An/Jia Jia/Le Le, Chiang Mai Chuang Chuang and Lin Hui, Madrid Po and De De, Smithsonian Ling Ling, Memphis Le Le and Ya Ya, San Diego Hua Mei, Adelaide Wang Wang, Moscow Ding Ding/Ru Yi/Katyusha, Vienna Yang Yang, and Vienna-born offspring Fu Long, Fu Hu, Fu Bao, Fu Feng and Fu Ban.
- `2026-07-25-vienna-offspring.jsonl` — individual-level Vienna offspring profiles covering birth and sex, naming, growth, identifying markings, behaviour, vocal-development research, husbandry training, enrichment, and transfers to China.
- `2026-07-25-berlin-family.jsonl` — multigenerational Zoo Berlin family records for Meng Meng, Jiao Qing, the 2019 brothers Meng Xiang and Meng Yuan, and the 2024 sisters Meng Hao and Meng Tian, covering identity, parentage, reproduction, twin care, growth, behaviour, health, public debuts and transfer to Chengdu. Conflicting official birth-time reports for Meng Tian are preserved as separate sourced values.
- `2026-07-25-singapore-family.jsonl` — official-source family records for Kai Kai, Jia Jia and Singapore-born Le Le, covering identity, temperament, enrichment, reproduction, maternal care, naming, growth, public debuts, husbandry training, independence, transfer to China and adaptation at the Dujiangyan base.
- `2026-07-25-canada-family.jsonl` — Toronto and Calgary programme records for Er Shun, Da Mao, Jia Panpan and Jia Yueyue, covering arrival and quarantine, artificial insemination, pseudopregnancy, fetal monitoring, twin birth and rotation care, sex confirmation, naming, growth, behaviour, physical identification, transfer within Canada and return-to-China leads. The 2015 official birth evidence retains paternity as unconfirmed rather than inferring it from semen use.
- `2026-07-25-lin-bing-family.jsonl` — Lin Bing's Chiang Mai-to-China life history, naming and public-cultural context, return, 2015 and 2017 litters, maternal care, and the verified lineage of the 2019-born Hong Kong An An. The same batch separately profiles An An and Ke Ke's Hong Kong arrival, weights, temperament, training, diet, public debut and first-year adaptation without merging the new An An with Ocean Park's earlier namesake.
- `2026-07-25-berlin-historic-pandas.jsonl` — Zoo Berlin and Museum für Naturkunde records for Happy, Tjen Tjen, Bao Bao and Yan Yan, plus Chi Chi's 1958 East Berlin stopover. The batch covers state-gift diplomacy, arrival and companionship, names, breeding attempts, deaths, longevity, specimen preparation, museum exhibition and Yan Yan's specimen return to China.
- `2026-07-25-smithsonian-family.jsonl` — multigenerational Smithsonian family records for Mei Xiang, Tian Tian, Tai Shan, Bao Bao and Bei Bei, with targeted additions for Xiao Qi Ji. The batch covers identity, arrival, artificial insemination, pseudopregnancy, parentage, naming, weights, developmental milestones, travel-crate training, returns to China, adaptation and verified offspring born in China.
- `2026-07-25-san-diego-family.jsonl` — San Diego Zoo Wildlife Alliance family records for Bai Yun, Gao Gao, Mei Sheng, Su Lin, Zhen Zhen, Yun Zi and Xiao Liwu. The batch covers assisted and natural reproduction, maternal and geriatric care, individual personality, enrichment preferences, hearing and blood-pressure training, return to China, post-transfer locations and verified descendants.
- `2026-07-26-everland-family.jsonl` — Everland Bao-family records for Ai Bao, Le Bao, Fu Bao, Rui Bao, Hui Bao and the unnamed 2026 female cub. The batch covers three successful natural-breeding litters, individual parentage, naming and romanization history, growth, twin rotation care, independence, Panda Second House residence, Fu Bao's return to Shenshuping, planned twin transfers and the latest unresolved naming status.
- `2026-07-26-ueno-family.jsonl` — official Ueno family records for Ri Ri, Shin Shin, Xiang Xiang, Xiao Xiao and Lei Lei, covering identity, parentage, naming, natural-breeding milestones, maternal care, health and hypertension management, growth, husbandry training, independence, quarantine, returns to China and early adaptation at Bifengxia and Ya'an.
- `2026-07-26-pairidaiza-family.jsonl` — Pairi Daiza family records for Hao Hao, Xing Hui, Tian Bao, Bao Di and Bao Mei, plus the zoo's panda-reproduction research programme. The batch covers identity, arrival, names, parentage, artificial insemination, twin rotation care, development, birthday enrichment, keeper observations, completed offspring transfers, Hao Hao's specialist-care return and the continuing Belgian residence of Xing Hui.
- `2026-07-26-beauval-family.jsonl` — ZooParc de Beauval family records for Yuan Zi, Huan Huan, Yuan Meng, Huanlili and Yuandudu, plus the 2021 twin-development timeline. The batch covers identity, parentage, names, personality, maternal and incubator care, growth, enrichment, Yuan Meng's Chengdu adaptation, the adult pair's completed 2025 return, Huan Huan's renal care and the twins' still-planned transfer after their fifth birthday.
- `2026-07-26-edinburgh-family.jsonl` — Edinburgh records for Tian Tian, Yang Guang and the UK-China cooperation programme, covering identity, conflicting Tian Tian birth-date evidence, pre-UK life history, offspring, artificial-insemination research, Yang Guang's tumour surgery and habitat behaviour, birthday enrichment, cultural impact, completed return, Bifengxia quarantine and post-return health.
- `2026-07-26-madrid-family.jsonl` — Zoo Aquarium Madrid family records for Bing Xing, Hua Zui Ba, Po, De De, Xing Bao, Chulina, You You and Jiu Jiu, plus both twin-development timelines and the 2007–2024 cooperation programme. The batch covers identity, parentage, artificial insemination, naming, growth, individual appearance and personality, maternal and incubator rotation care, outdoor debuts, completed returns to Chengdu, transport preparation and in-situ habitat support. Twin birth times and weights that official sources do not map to later names remain at family level.
- `2026-07-26-malaysia-family-deep.jsonl` — deepened Zoo Negara records for Xing Xing, Liang Liang, Nuan Nuan, Yi Yi and Sheng Yi, plus the 2014–2025 cooperation programme. The batch covers original and Malaysian names, parentage, personality and distinguishing features, natural-breeding outcomes, birthday enrichment, diet and dental care, completed cub and adult returns, Bifengxia quarantine, Nuan Nuan's Nanjing residence and the conflicting May 30/31 Sheng Yi birth-date reports.
- `2026-07-26-oceanpark-family.jsonl` — Ocean Park records for historic Jia Jia and An An, Ying Ying, Le Le, and Hong Kong-born twins Jia Jia and De De. The batch covers longevity and geriatric-behaviour research, posthumous education use, the 2010–2024 breeding programme, Ying Ying's record-setting first birth, neonatal milk and formula care, identifying eye patches, public debut, naming, personality, expanded-habitat skills and first-birthday enrichment. Historic and current namesakes remain separate IDs.
- `2026-07-26-vienna-founders.jsonl` — deepened Vienna founder records for Yang Yang and Long Hui, with targeted Yuan Yuan return updates and a programme-level cooperation profile. The batch covers identity, appearance, temperament, natural mating and five offspring, Long Hui's complete illness and joint pathology timeline, Yang Yang and Yuan Yuan's completed 2024 return for geriatric care, flight husbandry, twin-rearing research and conservation-funding allocation.
- `2026-07-26-chiangmai-founders.jsonl` — deepened Chiang Mai founder records for Chuang Chuang and Lin Hui, with targeted Lin Bing infancy additions and a programme-level China-Thailand cooperation profile. The batch covers identity, parentage, aliases, artificial insemination, maternal nursing, habitat monitoring, birthday behaviour, Chuang Chuang's heart-failure investigation, Lin Hui's vascular-tumour and final atherosclerosis/embolism findings, and the two-decade raising, breeding, disease-control and public-education partnership.

All records remain `publication_status=local_only`. Nothing in the collection log implies approval for website publication or media reuse.
