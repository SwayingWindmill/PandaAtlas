# PandaAtlas reviewed batch 2026.07.20.1

This batch adds the first three complete panda profiles with reviewed photographs:

- Lun Lun / 伦伦
- Yang Yang / 洋洋
- Ya Lun / 雅伦

The existing seven Public Beta pandas remain in the release and retain their existing no-photo or source-link-only media policies. This batch does not claim platform-wide photo completeness.

## Trust boundary

Each new panda includes:

- stable ID, canonical slug, approved Chinese and English names and summaries;
- source-backed birth date, sex, and life status;
- one reviewed current primary residency with a `2026-07-20` verification date;
- at least three reviewed lifecycle or residency events;
- reviewed source records for every confirmed fact;
- reviewed parentage assertions for Ya Lun;
- one individually identified CC BY-SA 4.0 photograph with public credit and bilingual alt text.

Photo captions are not used as evidence for panda facts. Zoo Atlanta official pages support identity, events, residency, and parentage. The exact Wikimedia Commons file pages support only photo identity, authorship, and license.

## Files

- `source.json`: deterministic reviewed source used by the Public Release builder.
- `media-manifest.json`: sanitized derivative manifest; it contains no original-image path or local processing path.
- `../../public-releases/2026.07.20.1/`: immutable CSV, JSON, D1, and manifest output.

Original photographs and generated binary files are intentionally excluded from Git. The controlled processing workspace is `.media-work/`.

## Reproduce

```powershell
npm run check:panda-curation
npm run test:panda-media
npm run build:atlanta-photo-batch
npm run check:atlanta-photo-batch
npm run test:atlanta-photo-batch
npm run check:atlanta-photo-release
```

Build the immutable release from `source.json`:

```powershell
uv run --isolated --directory services/api --frozen --extra dev python scripts/build_public_release.py `
  --source ../../data/reviewed-batches/2026.07.20.1/source.json `
  --output ../../data/public-releases `
  --publication-batch-id atlanta-first-photo-batch `
  --projection-code-version public-release-v4 `
  --database-migration-version 0007 `
  --released-at 2026-07-20T03:30:00Z
```

## R2 media

Verify the six generated WebP derivatives without writing to R2:

```powershell
npm run check:atlanta-photo-media
```

Upload only after the batch and release gates pass:

```powershell
npm run upload:atlanta-photo-media
```

The uploader verifies byte size and SHA-256 before writing immutable keys, then fetches every remote object and verifies it again:

```text
panda-atlas-media/releases/2026.07.20.1/
```

No original JPEG is uploaded by this workflow.
