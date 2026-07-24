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
npm run check:local-panda-media
npm run collect:local-panda-media
npm run test:local-panda-media
```

`import` merges every candidate from the existing curated media release and Wikimedia discovery results into the local queue, without filtering by rights state. `check` validates candidate metadata without downloading. `collect` downloads missing files and rewrites the deterministic inventory.

## Current snapshot

As of 2026-07-25, the vault contains 43 candidates. Thirty-nine image files are present locally (about 191 MB); four historic Chengdu Base asset URLs currently fail because the remote files return HTTP 404 or terminate TLS. These failures remain in the inventory as replacement leads rather than being removed.

The full Commons queue contains 1,057 search tasks covering 799 pandas that still need image discovery. Local batches are intentionally bounded to eight tasks, preserve response fixtures, record failed task IDs, and skip already processed tasks in later batches. Search targets are treated only as leads: a file is attached to an individual only when its title, description, or categories contain a complete matching name. Short aliases use word boundaries so names such as `Pan`, `Po`, and `Rio` cannot match ordinary words such as `panda` or `photography`.
