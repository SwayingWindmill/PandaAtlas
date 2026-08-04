# Local Panda Media Vault

This is the image-first, local-only media layer for Panda Atlas.

## Collection policy

- Rights status is **metadata, not an ingestion gate**.
- Restricted, unknown, press-use, open-license, public-domain, and explicitly authorized images may all be collected into the local vault.
- The collector does not reduce priority or reject a candidate because of its rights label.
- Source page, asset URL, credit, observed rights statement, individual identity, capture date, and retrieval hash are preserved whenever available.
- Every individually identified panda must receive an image-discovery pass. Media coverage is not complete until at least one distinct, identity-confirmed image has been collected; retain as many qualifying images as reviewed sources support, with a hard maximum of 20 individual images per panda. If none can be found, record a coverage gap. Group, transport, artifact, memorial, cultural-object, and research media remain separately typed and do not substitute for an individual image.
- Local collection does not automatically make an image eligible for publication. Any future export or public release must make a separate decision.
- Image binaries are stored under `files/` and are intentionally ignored by Git. Candidate and inventory metadata remain inspectable.

## Files

- `candidates.jsonl` — image URLs selected for local acquisition.
- `inventory.jsonl` — generated retrieval results, hashes, byte sizes, MIME types, and local filenames.
- `files/` — downloaded image bytes; local only and not committed.

## Commands

```bash
npm run import:local-panda-media
npm run import:local-panda-media-batch -- --batch-gzip-base64 <batch.jsonl.gz.b64>
npm run check:local-panda-media
npm run collect:local-panda-media
npm run extract:local-panda-media-facts
npm run test:local-panda-media
python3 scripts/research/discover_official_page_images.py --page-url <official-page> --output <discovery.json>
```

`import` merges candidates from the curated media release and Wikimedia discovery results into the local queue without filtering by rights state. `import:local-panda-media-batch` accepts reviewed candidates from official institutions and archives. `check` validates candidate metadata without downloading. `collect` downloads missing files, prunes orphaned binaries, and rewrites the deterministic inventory. `extract` converts explicit media-page evidence into local-only date, location, identity, behaviour, sex, research, cultural-context, diplomacy, and milestone facts.

## Current snapshot

As of 2026-07-26, the vault contains **587 candidates**. **582 media files** are present locally, totalling **998,129,279 bytes** (about 1.00 GB); five URLs remain unresolved. Two are earlier historic remote-asset failures, and three are traceable San Diego Zoo Hua Mei image URLs whose retired host now presents a TLS certificate for a different hostname. TLS verification is not disabled, and unresolved candidates remain as replacement leads rather than being removed. Thirteen Taipei family images were retrieved through identity-confirmed Xinhua and Wikimedia mirrors because the Taipei municipal asset host presented an incomplete certificate chain to the collector. The Adventure World batch adds twenty downloaded official profile images, providing one image for every panda in the complete Shirahama lineage. The Qinling core batch adds twelve qualifying individual images covering ten pandas plus two mother-cub group images; Zhu Zhu and Yong Yong were later closed by directly captioned individual images in priority rounds 7 and 9. The Qinling 2023 follow-up and evidence addendum add a captioned four-panda group image, one provisional Xiao Yuan Qi profile image, and provisional community-profile individual images for Long Qing, Long Ning, Chang Qing and Chang Le. Eleven priority image-gap batches now provide official, archived-official, open-license, institutional-record or explicitly mapped individual coverage for fifty-three pandas. Round 11 adds direct individual coverage for historic Macao Shu Xiang, Chengdu Bao Xin and Fu Shuang, restores Bao Xin's previously unresolved official asset, and moves the existing Commons Yang Yang image from duplicate `yang-yang` to canonical `yang-yang-atlanta`. Ping Ping, historic Qi Miao, Copenhagen Xing Er and the 2017 Chengdu cohort remain excluded where frame-level identity is not unique.

The strict coverage audit counts only `individual_panda` records toward completion. Group photographs and other related media are retained as supporting evidence but cannot replace an individual portrait. The current audit reports 162 pandas with qualifying individual images and 18 fact-bearing pandas without one. Community-profile, archived-official, open-license, institutional-record and cross-source-mapped individual images satisfy the structural coverage test but remain visibly provisional when primary identity or rights evidence is incomplete.

The full Commons queue contains 1,057 search tasks covering 799 pandas that still need image discovery. Fifty-five bounded Commons batches have been recorded. Each contains at most eight tasks, preserves response fixtures, records failed task IDs, and skips previously processed task IDs and duplicate query text. As the Commons long tail became low-yield, collection expanded to official zoo pages, government archives, institutional press resources, library collections, and public-domain historical repositories.

Media records distinguish `individual_panda`, `panda_group`, `unresolved_panda`, `historical_artifact`, `facility_signage`, `cultural_object`, `memorial_sculpture`, and `research_diagram` material. Cultural and research media are retained without being misbound to living panda profiles. A memorial object may use `represented_subject_ids` only when the page explicitly states which panda it represents.

Search targets are treated only as leads. Title and description evidence outrank category labels; location, capture year, life range, institution, and parent-child relationships disambiguate pandas sharing a name. Controlled full-phrase crosswalks may carry higher confidence than generic group inference, while community nickname evidence remains secondary. Short aliases use word boundaries so names such as `Pan`, `Po`, and `Rio` cannot match ordinary words such as `panda` or `photography`. Common-word aliases such as `Happy` require explicit naming context. Fictional characters, vehicles, merchandise, red pandas, taxidermy, unrelated specimens, and other noise are excluded; genuine giant-panda photographs with unresolved identity remain as unresolved candidates.

Official-page discovery parses public HTTPS HTML for standard image, lazy-load, `srcset`, Open Graph, Twitter image, and image-preload references. It performs bounded retry on transient URL errors but does not bypass authentication, access controls, CAPTCHA, paywalls, or invalid TLS identity.
