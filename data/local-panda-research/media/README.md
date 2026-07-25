# Local Panda Media Vault

This is the image-first, local-only media layer for Panda Atlas.

## Collection policy

- Rights status is **metadata, not an ingestion gate**.
- Restricted, unknown, press-use, open-license, public-domain, and explicitly authorized images may all be collected into the local vault.
- The collector does not reduce priority or reject a candidate because of its rights label.
- Source page, asset URL, credit, observed rights statement, individual identity, capture date, and retrieval hash are preserved whenever available.
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

As of 2026-07-26, the vault contains **253 candidates**. **246 media files** are present locally, totalling **926,583,490 bytes** (about 926.6 MB); seven URLs remain failed. Four are earlier historic remote-asset failures, and three are traceable San Diego Zoo Hua Mei image URLs whose retired host now presents a TLS certificate for a different hostname. TLS verification is not disabled, and the failed candidates remain as replacement leads rather than being removed.

The full Commons queue contains 1,057 search tasks covering 799 pandas that still need image discovery. Fifty-five bounded Commons batches have been recorded. Each contains at most eight tasks, preserves response fixtures, records failed task IDs, and skips previously processed task IDs and duplicate query text. As the Commons long tail became low-yield, collection expanded to official zoo pages, government archives, institutional press resources, library collections, and public-domain historical repositories.

Media records distinguish `individual_panda`, `panda_group`, `unresolved_panda`, `historical_artifact`, `facility_signage`, `cultural_object`, `memorial_sculpture`, and `research_diagram` material. Cultural and research media are retained without being misbound to living panda profiles. A memorial object may use `represented_subject_ids` only when the page explicitly states which panda it represents.

Search targets are treated only as leads. Title and description evidence outrank category labels; location, capture year, life range, institution, and parent-child relationships disambiguate pandas sharing a name. Controlled full-phrase crosswalks may carry higher confidence than generic group inference, while community nickname evidence remains secondary. Short aliases use word boundaries so names such as `Pan`, `Po`, and `Rio` cannot match ordinary words such as `panda` or `photography`. Common-word aliases such as `Happy` require explicit naming context. Fictional characters, vehicles, merchandise, red pandas, taxidermy, unrelated specimens, and other noise are excluded; genuine giant-panda photographs with unresolved identity remain as unresolved candidates.

Official-page discovery parses public HTTPS HTML for standard image, lazy-load, `srcset`, Open Graph, Twitter image, and image-preload references. It performs bounded retry on transient URL errors but does not bypass authentication, access controls, CAPTCHA, paywalls, or invalid TLS identity.
