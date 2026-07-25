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

As of 2026-07-25, the vault contains **276 sources** and **1,556 structured records**: 1,539 direct-evidence records and seventeen explicitly marked secondary leads requiring primary-source follow-up. The evidence layer is dominated by institutional, government, archival, and official-zoo material. Media coverage spans 69 individually identified pandas, with no collected individual lacking at least one structured fact record.

The local media layer contains **239 candidates**, **232 downloaded files**, and **921,058,982 bytes** of binaries. Rights metadata is retained but does not gate local acquisition. Seven candidate URLs remain failed and are preserved as replacement leads.

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

All records remain `publication_status=local_only`. Nothing in the collection log implies approval for website publication or media reuse.
