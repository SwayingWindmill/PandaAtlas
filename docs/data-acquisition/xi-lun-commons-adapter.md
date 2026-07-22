# Xi Lun Wikimedia Commons metadata adapter

Issues: #89, #99

## Purpose

This adapter closes Xi Lun's outstanding photo-license metadata gap without publishing a panda or media record. It queries one exact Wikimedia Commons file title and emits field-level review candidates with raw response evidence.

The adapter does not:

- download the original image;
- write curation CSV files;
- write PostgreSQL, D1, R2, Public Release, API, snapshot, or frontend data;
- approve identity or license metadata without curator review;
- use browser User-Agent impersonation against Wikimedia;
- switch identities, proxies, cookies, or User-Agents after a block or rate limit.

## Reviewed source and runner

Source decisions are tracked in `data/acquisition-sources/registry.json` and bound to `source-review-2026-07-22.md` by SHA-256.

The registry allowlists the concrete adapter ID `wikimedia-commons-xi-lun`. The shared source adapter runner owns the reviewed User-Agent, Accept header, timeout, redirect, retry, backoff, stop-status, rate, concurrency, authentication, cookie, evidence, and bundle policies. The Commons adapter owns only the exact request and deterministic parser.

Current relevant decisions:

- Wikimedia Commons Action API: approved for the exact-title metadata request at six requests per minute and one request at a time.
- Smithsonian National Zoo panda pages: approved for a different adapter ID; the Commons adapter cannot run against it.
- Zoo Atlanta pages: permission required; automated live fetch disabled.
- Tokyo Zoo Net and Fu Bao current-location research: manual review required; automated live fetch disabled.

The registry must be reviewed again before its expiry date or whenever applicable policies change.

## Commands

Offline deterministic fixture:

```bash
npm run source:xi-lun
```

Explicit live metadata request:

```bash
npm run source:xi-lun:live
```

Equivalent parameterized fixture command:

```bash
uv run --project services/api python services/api/scripts/run_source_adapter.py \
  --source-id wikimedia-commons-action-api \
  --adapter-id wikimedia-commons-xi-lun \
  --mode fixture \
  --cohort xi-lun-reviewed-media \
  --output-bundle xi-lun/commons.json \
  --overwrite
```

The live command sends one descriptive bot User-Agent request to the Wikimedia Action API. It requests `imageinfo` plus a filtered `extmetadata` field list. It does not request the upload URL returned in the response.

Fixture mode remains available when an approved source is temporarily configured with `live_fetch=false` and zero request capacity. Live mode still fails before any request.

## Output

The versioned bundle is written below:

```text
.acquisition/bundles/
```

A caller may choose a relative JSON path below that directory. Paths that escape the local bundle root are rejected.

A completed Xi Lun bundle records:

- a v1 acquisition run with source, adapter, parser, mode, cohort, review dates, and terminal state;
- the reviewed source policy and review-document hash;
- one response evidence snapshot with URL, HTTP metadata, byte count, and body SHA-256;
- 20 `media-metadata` field candidates covering the exact file title, uploader, upload timestamp, source and description URLs, dimensions, source byte count, MIME, Wikimedia SHA-1, description, artist, credit, license, usage terms, attribution requirement, original capture text, categories, and `original_image_downloaded: false`;
- a matched Xi Lun identity assertion based on the exact reviewed file title and description;
- empty trusted and publication write-target lists.

The legacy `parse_xi_lun_result` interface remains available for current callers, but the command-line workflow now uses the formal acquisition bundle contract.

## Fail-closed behavior

The runner and adapter reject:

- source-registry review drift or expiry;
- unknown or non-allowlisted source and adapter combinations;
- non-approved or disabled live sources;
- browser-style or caller-overridden live User-Agents;
- targets, final URLs, query policy, ports, credentials, or fragments outside the approved source rules;
- redirect, rate-limit, authentication, challenge, and stop-status responses;
- API errors, warnings, missing pages, or multiple revisions;
- a file title or description that does not identify Xi Lun;
- artist/uploader disagreement;
- missing or changed license and attribution metadata;
- unexpected source hosts, MIME, dimensions, byte counts, or invalid SHA-1 values;
- output paths outside `.acquisition/bundles/`.

Blocked or failed live runs preserve available response evidence in a terminal bundle and emit no field candidates. A passing bundle is evidence for a curator to review. It is not publication approval.
