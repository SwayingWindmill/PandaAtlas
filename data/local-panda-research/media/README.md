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
npm run check:local-panda-media
npm run collect:local-panda-media
npm run test:local-panda-media
```

`check` validates candidate metadata without downloading. `collect` downloads or refreshes files and rewrites the deterministic inventory.
