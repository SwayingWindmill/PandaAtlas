# Xi Lun Wikimedia Commons metadata adapter

Issue: #89

## Purpose

This adapter closes Xi Lun's outstanding photo-license metadata gap without publishing a panda or media record. It queries one exact Wikimedia Commons file title and emits a review-state candidate with raw response evidence.

The adapter does not:

- download the original image;
- write curation CSV files;
- write PostgreSQL, D1, R2, Public Release, API, snapshot, or frontend data;
- approve identity or license metadata without curator review;
- use browser User-Agent impersonation against Wikimedia;
- switch identities, proxies, or User-Agents after a block or rate limit.

## Reviewed source

Source decisions are tracked in `data/acquisition-sources/registry.json` and bound to `source-review-2026-07-21.md` by SHA-256.

Current decisions:

- Wikimedia Commons Action API: approved for exact-title metadata requests.
- Zoo Atlanta pages: permission required; automated live fetch disabled.
- Fu Bao current-location research: manual review required; automated live fetch disabled.

The registry must be reviewed again before its expiry date or whenever applicable policies change.

## Commands

Offline, deterministic fixture:

```bash
npm run source:xi-lun
```

Explicit live metadata request:

```bash
npm run source:xi-lun:live
```

Focused tests:

```bash
npm run test:source-adapters
```

The live command sends one descriptive bot User-Agent request to the Wikimedia Action API. It requests `imageinfo` plus a filtered `extmetadata` field list. It does not request the upload URL returned in the response.

## Output

The report is written to:

```text
.release-gate/acquisition-sources/xi-lun-commons.json
```

It records:

- reviewed source configuration and expiry;
- exact API request URL and User-Agent;
- HTTP status, headers, response byte count, and response SHA-256;
- exact file title, uploader, upload timestamp, source and description URLs;
- dimensions, source byte count, MIME, and Wikimedia SHA-1;
- description, artist, credit, license, usage terms, and attribution requirement;
- `review_state: candidate`;
- `original_image_downloaded: false`;
- an empty publication-write-target list.

## Fail-closed behavior

The adapter rejects:

- source-registry review drift or expiry;
- non-approved or permission-required live sources;
- browser-style Wikimedia bot User-Agents;
- targets outside the approved host and path;
- API errors, warnings, missing pages, or multiple revisions;
- a file title or description that does not identify Xi Lun;
- artist/uploader disagreement;
- missing or changed license and attribution metadata;
- unexpected source hosts, MIME, dimensions, byte counts, or invalid SHA-1 values.

A passing report is evidence for a curator to review. It is not publication approval.
