# Smithsonian Commons media review — 2026-07-24

## Scope

This Issue #132 slice advances only the six review-ready Wikimedia Commons candidates produced by the merged discovery queue. It does not run broader discovery, change structured panda facts, upload to R2, activate D1, deploy API/Web, or modify the live `2026.07.24.2` release.

Base reviewed/public dataset: `2026.07.24.2`

New immutable reviewed/public dataset: `2026.07.24.3`

## Reviewed candidates

| Panda | Candidate | Identity | Rights | Curator role |
| --- | --- | ---: | --- | --- |
| Mei Xiang | `commons-candidate-73ee162326e52f8d7f6bb4aa` | 0.95 | CC BY-SA 4.0 | primary |
| Xiao Qi Ji | `commons-candidate-7c99cc1fb00e3519f119e770` | 0.95 | CC BY-SA 4.0 | primary |
| Xiao Qi Ji | `commons-candidate-ba6b6fecf09aa90d296dd228` | 0.85 | CC BY 2.0 | gallery |
| Xiao Qi Ji | `commons-candidate-cdfdd7cc694698fb52fd70e0` | 0.85 | CC BY 2.0 | gallery |
| Xiao Qi Ji | `commons-candidate-5bf1a592b3376ff690ec0f73` | 0.85 | CC BY 2.0 | gallery |
| Xiao Qi Ji | `commons-candidate-d905ec669d6111bb4e9016fe` | 0.85 | CC BY 2.0 | gallery |

The batch builder binds each decision to the immutable discovery result and checks the exact Commons file title, original URL, description URL, uploader, artist, license label and URL, attribution requirement, source byte count, dimensions, MIME type, Commons SHA-1, identity basis/confidence, and rights state/confidence.

## Original download and integrity review

All six original JPEGs were downloaded directly from the reviewed Commons original URLs through the existing bounded media processor. No thumbnail fallback or unrelated network enumeration was used.

| Candidate | Original bytes | Dimensions | Commons SHA-1 | Downloaded SHA-256 |
| --- | ---: | --- | --- | --- |
| `73ee1623…` | 16,946,734 | 5472 × 3648 | `93891d91768cf1c161a0ebced5922a7252058114` | `2b6dfcd1778368b042bdf2896380889df715dcb5885fd058276181a9862f8874` |
| `7c99cc1f…` | 16,518,783 | 5472 × 3648 | `e26b745e4b63c27b22322c1fd1fcec20adb0fc56` | `f2332c8f774add8a130e5eb60b236641f80c240fc527551725c1be73073693c1` |
| `ba6b6fec…` | 8,618,294 | 6000 × 4000 | `f7b7e4e636961c1094d99da03ff55be96e87ac54` | `15c42e21d67ba8d55b03eaccfe9182d1a5184a40e51580b80a93da57416ed478` |
| `cdfdd7cc…` | 8,313,238 | 6000 × 4000 | `81c8b11aaa2b240a2b6ac165832f2652c242999b` | `a96887ccb2d17490b9059003fb313d9cf6809d6fc3b3a0069293f26686cdb6db` |
| `5bf1a592…` | 9,036,827 | 6000 × 4000 | `c5b0c06924c2f1869963f49856189ff4e1a7bba5` | `36148511f2577c258e3c4ebfef5613e6ef89088d1e8d4f9635253fa87b252fae` |
| `d905ec66…` | 7,702,127 | 6000 × 4000 | `444f17175cafc07ac1c2c5e6a5c85d29724c810d` | `24c46d16c6cff8b1c636513a6404defdd33df60212f9ee7329d6567dfac4881b` |

Every downloaded SHA-1, byte count, dimension, and MIME value matched the discovery metadata. Originals remain in ignored `.media-work` storage and are not committed.

## Duplicate review

The six originals were compared across all 15 pairs using exact SHA-256 and 64-bit grayscale dHash (`dhash-64-grayscale-lanczos`).

- Exact duplicate groups: 0
- Near-duplicate pairs: 0
- Near-duplicate threshold: Hamming distance ≤ 6
- Observed distance range: 27–39
- Decision: retain all six as distinct images

Existing released original bytes are not stored in Git, so cross-release perceptual comparison is not reproducible from a clean checkout. The dual media library continues to collapse exact duplicate public delivery SHA-256 values.

## Media processing and curator selection

Each original produced controlled 480 px and 1200 px WebP derivatives. Public records reference only the reviewed derivatives under the immutable `2026.07.24.3` media route.

Administrator selection overrides explicitly choose:

- Mei Xiang primary: `media-candidate-4fa4d413315ad2a0e8607262`
- Xiao Qi Ji primary: `media-candidate-1abd1ede7481e51fe2978903`
- Xiao Qi Ji gallery: the primary plus all four distinct 0.85-confidence alternatives

The selection result is identical for the private-collection and public-open scopes.

## Immutable release result

`data/public-releases/2026.07.24.3/manifest.json` records:

| Record | Count |
| --- | ---: |
| Pandas | 38 |
| Media | 42 |
| Sources | 49 |
| Facts | 109 |
| Events | 43 |
| Residencies | 26 |
| Parentage assertions | 24 |

The prior release had 38 media and 43 sources. This slice replaces two designed empty states with six available media records, for a net media increase of four, and adds six media-rights sources.

Dual media library coverage changed as follows:

| Metric | Before | After |
| --- | ---: | ---: |
| Candidate rows | 14 | 20 |
| Pandas with candidates | 14 | 16 |
| Private collection main images | 14 | 16 |
| Public open main images | 9 | 11 |
| Pandas needing discovery | 799 | 797 |
| Restricted candidates | 4 | 4 |
| Low-identity candidates | 3 | 3 |

## Public website presentation

All six reviewed images use open Creative Commons licenses and are eligible for the public-open library. The public profile contract therefore preserves every image rather than reducing each panda to a single delivery asset.

- Mei Xiang page: one primary image.
- Xiao Qi Ji page: one primary image plus four gallery images.
- The API orders the reviewed primary first and uses it for `cover_image_url`.
- The Web profile renders every media item, displays the total open-license image count, labels primary versus gallery images, and preserves per-image rights, credit, and original-source links.
- Browser regression coverage verifies the Chinese and English Mei Xiang and Xiao Qi Ji pages render 1 and 5 images respectively.

## Reproducible commands

```text
npm run check:panda-curation
npm run test:smithsonian-commons-media-batch
npm run check:smithsonian-commons-media-batch
npm run test:media-library
npm run check:media-library
```

The original download/processing command is intentionally network-enabled and is not part of clean-checkout deterministic checks:

```text
uv run --isolated --directory services/api --frozen --extra dev python ../../scripts/curation/process_panda_media.py --allow-network --output-dir ../../.media-work/2026.07.24.3 --panda-slug mei-xiang --panda-slug xiao-qi-ji
```

## Verification status

- Collection Release Gate: 14/14 passed.
- FastAPI regression: 297 passed, 13 skipped.
- Release Gate configuration tests: 202 passed.
- Smithsonian profile browser tests: 2 passed, covering Chinese and English pages and complete 1/5-image galleries.
- Web lint, typecheck, and production build: passed.
- Commons discovery tests: 13 passed; fixture, cohort, and source-registry descriptors now normalize LF/CRLF before hashing.
- Smithsonian batch tests: 5 passed; media-library tests: 10 passed.

The Beta hard-gate release integrity, public-data boundary, admin-token boundary, and waiver-policy checks pass for `2026.07.24.3`. The remaining trusted-archive failure is inherited unchanged from `2026.07.24.2`: `lun-hui` is `identity_first_pass` while the current hard gate requires `complete_first_pass`. This media slice does not modify Lun Hui or structured panda facts.

## Publication boundary

This slice creates reviewed batch artifacts, an immutable Public Release, media-library selection evidence, and website gallery support only. It performs no R2 upload, D1 activation, API deployment, Web deployment, production smoke test, rollback drill, or live version change. The production release remains `2026.07.24.2` until a separate release operation is explicitly authorized.
