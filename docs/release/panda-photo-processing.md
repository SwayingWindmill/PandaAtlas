# Panda photo intake and processing

This workflow turns processable photo records (`approved` or `collection_only`) into a controlled internal media build. It does not upload to R2 or publish anything; publication owns delivery.

## Curator input

Curators maintain only these fields in `data/curation/pandas/media.csv`:

- `panda_slug`
- `asset`
- `source_url`
- `rights`
- `credit`
- `alt_zh`
- `alt_en`
- `review_status`
- optional `notes`

A photo never compensates for incomplete or unverified panda facts.

## Asset intake

Two asset forms are supported:

1. A local file below `data/curation/pandas/media-inbox/`.
2. An HTTPS asset URL, only when the operator explicitly passes `--allow-network` after reviewing the source and rights record.

The inbox and generated build are ignored by Git. Do not commit photo binaries to the repository.

The processor rejects:

- local paths outside `media-inbox/`;
- non-HTTPS remote assets;
- remote access unless explicitly enabled;
- files larger than 25 MiB;
- unsupported or invalid images;
- animated images;
- images above the pixel safety limit;
- curation data that fails `npm run check:panda-curation`.

## Processing

Run the unit tests:

```bash
npm run test:panda-media
```

Process approved local records:

```bash
npm run process:panda-media
```

Process reviewed HTTPS assets:

```bash
npm run process:panda-media -- --allow-network
```

An existing output is immutable by default. A custom output directory must not overlap the curation input tree. Use `--force` only for an intentional rebuild:

```bash
npm run process:panda-media -- --force
```

A forced rebuild is created separately and atomically installed only after all records succeed. If processing fails, the previous output remains intact.

## Generated output

The default output is `.media-work/` at the repository root:

```text
.media-work/
├── manifest.json
├── originals/
└── derivatives/
```

For each processable photo, the processor generates:

- a deterministic media ID;
- an exact internal archived original with SHA-256, MIME type, dimensions, and byte size;
- WebP derivatives at widths up to 480 and 1200 pixels without upscaling and without inherited EXIF metadata;
- an internal manifest containing the curator-entered source, rights, credit, bilingual alt text, and system-generated technical metadata.

Pillow is pinned through `tools/panda-data/uv.lock`, and the processing tests run in the curation verification scope. Cross-platform byte identity is not assumed; each generated file carries its own SHA-256.

## Publication boundary

The generated manifest is an internal build artifact. R2 upload, publication, frontend rendering and cache behavior are handled separately. A published release is never rewritten when a photo is replaced or withdrawn; `withdrawn` and `rejected` records are not processed.
