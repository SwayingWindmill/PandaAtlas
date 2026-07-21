# Reviewed batch 2026.07.21.1 — Xi Lun licensed-media expansion

Issue: #91

Base release: `2026.07.20.2`

This batch adds exactly one public panda, Xi Lun (`xi-lun`), while preserving all prior immutable records and media history. The shared Zoo Atlanta 2024 return event is extended only by adding Xi Lun as the fourth reviewed participant.

## Reviewed profile

- stable ID: `d24087cd-70d6-5902-92dd-ecc95186937b`
- names: 喜伦 / Xi Lun
- sex: female
- birth: 2016-09-03
- parents: Lun Lun and Yang Yang, confirmed by reviewed assertions
- current residency: Chengdu Research Base of Giant Panda Breeding, last verified 2026-07-20
- reviewed events: birth, public debut, and 2024 return to Chengdu
- bilingual profile content: approved

## Media evidence

The exact Wikimedia Commons metadata candidate was created in issue #89. It records the original file identity, uploader, license, required attribution, dimensions, bytes, MIME, and SHA-1 without downloading the original image.

Wikimedia returned HTTP 429 when the media processor requested the 18 MB original and instructed clients to use available thumbnail sizes. PandaAtlas did not rotate identity, proxy, or User-Agent. Processing therefore used the official `Special:Redirect/file` thumbnail endpoint with a requested width of 1600.

Reviewed processing input:

- actual response: 1920 × 1280 JPEG
- bytes: 762,843
- SHA-256: `20ccab1f901b6821fda2b8b3f699a903fcd371a4adb119c5272c771fb0a06d92`

Generated public derivatives:

- 480 × 320 WebP, 41,100 bytes, SHA-256 `512163b2e0abbdb809b70e244e1c08b9eee5d1dfc4a8f50284eb77f3d4fba134`
- 1200 × 800 WebP, 232,944 bytes, SHA-256 `59646c0e1cca83a35fa76efface934feb490ccc5a58871e5dc518f6f2e7485f6`

Media ID: `media-xi-lun-de9774371d2f2427`

No original or derivative image bytes are tracked in Git. The reviewed manifests bind the source metadata and processor output; a later authorized media-upload operation must use the exact derivative bytes and hashes.

## Reproduction

```bash
npm run check:xi-lun-photo-batch
npm run test:xi-lun-photo-batch
npm run check:xi-lun-photo-release
```

The batch builder validates the Commons candidate, source-integrity record, processor manifest, media manifest, curation rows, current residency, events, parentage, base immutability, and derivative metadata before reproducing `source.json`.

## Deployment boundary

This batch is repository evidence only. It does not activate D1, upload R2 media, deploy API or Web Workers, or modify Production.
