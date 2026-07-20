# Ueno family licensed-photo batch — 2026.07.20.2

This reviewed batch extends the live `2026.07.20.1` release from 10 to 14 public panda profiles.

## Promoted profiles

- `ri-ri` — 力力 / Ri Ri
- `shin-shin` — 真真 / Shin Shin
- `xiao-xiao` — 晓晓 / Xiao Xiao
- `lei-lei` — 蕾蕾 / Lei Lei

## Evidence boundary

Profile facts use Tokyo Zoological Park Society records for birth dates, sexes, Ueno history, the twins' names and parentage, the 2024 adult return, and the 2026 twin return. Later Ya'an index records are used only to recheck Ri Ri and Shin Shin current-place continuity. They do not override the official Ueno history.

Curation contains direct per-panda event rows so completeness can be reviewed independently. The public batch normalizes shared family events:

- Ri Ri and Shin Shin share the 2011 Ueno arrival and 2024 return events.
- Xiao Xiao and Lei Lei share the 2021 birth, 2021 naming, and 2026 return events.

## Media boundary

Each promoted profile has one reviewed CC BY-SA 4.0 Commons photograph. Ri Ri, Shin Shin, and Xiao Xiao use individual files. Lei Lei uses an exact-file twin photograph whose file page identifies both Lei Lei and Xiao Xiao; the bilingual alt text describes both pandas and does not imply an individual portrait.

Human-maintained fields are limited to source file, source page, rights, credit, bilingual alt text, panda association, and review status. The media processor generates IDs, hashes, MIME type, dimensions, byte size, and 480/1200 WebP derivatives. Public derivatives have EXIF removed.

Original files and generated derivatives remain outside Git under `.media-work-ueno/`. The tracked `media-manifest.json` contains no local original path. Before production activation, all eight WebP objects must be uploaded to `panda-atlas-media` under immutable release keys and fetched back for byte-size and SHA-256 verification.

## Build sequence

1. Validate curation with `npm run check:panda-curation`.
2. Process approved media into `.media-work-ueno` with network access explicitly enabled after rights review.
3. Create and review `media-manifest.json` from the four Ueno records only.
4. Generate `source.json` with `npm run build:ueno-family-photo-batch`.
5. Build the immutable Public Release into `data/public-releases/2026.07.20.2`.
6. Run the Default Release Gate on Linux and Windows.
7. Deploy in order: R2 media, compatible API Worker, D1 release transaction/import, Web Worker.
8. Verify the production release identity, 14-profile Atlas, four profiles, media, lineage, and retained rollback history.

Related issues: #75, #76, and integrity gate #70.
