# Reviewed source adapter runner v1

Issue: [Generalize the reviewed source registry and adapter runner](https://github.com/SwayingWindmill/PandaAtlas/issues/99)

## Purpose

The source adapter runner is the single execution seam between reviewed source policy and source-specific parsing. A caller chooses a source ID, adapter ID, mode, cohort, fixture, and local bundle path. Registry objects supplied by another caller are fully revalidated against the run date before use. The runner owns every cross-source concern:

- current source-review validation and expiry;
- source-to-adapter allowlisting;
- exact HTTPS host and path allowlists;
- descriptive User-Agent identity;
- Accept header, authentication, and cookie policy;
- per-host concurrency and request-rate spacing;
- redirect, retry, backoff, stop-status, and challenge behavior;
- evidence snapshots and terminal run state;
- versioned candidate bundles and the local-only write boundary.

An adapter owns only its request plan and deterministic parser. It cannot create an HTTP client, choose a User-Agent, change retry behavior, write a trusted store, or publish data.

## Command

The existing Xi Lun command remains a compatible fixture-mode default:

```bash
uv run --project services/api python services/api/scripts/run_source_adapter.py
```

The parameterized form is:

```bash
uv run --project services/api python services/api/scripts/run_source_adapter.py \
  --source-id wikimedia-commons-action-api \
  --adapter-id wikimedia-commons-xi-lun \
  --mode fixture \
  --cohort xi-lun-reviewed-media \
  --fixture services/api/tests/acquisition/fixtures/commons-xi-lun-imageinfo.json \
  --output-bundle examples/xi-lun.json \
  --overwrite
```

`--live` remains an alias for `--mode live`. It does not bypass the registry. The runner still requires an approved, unexpired source with `live_fetch=true`, a structured request policy, and an adapter allowlist entry.

Output paths are resolved below:

```text
.acquisition/bundles/
```

Absolute or relative paths that escape that directory are rejected by the bundle writer. Bundles expose empty trusted and publication write-target lists.

## Registry execution policy

Approved sources now include `allowed_adapter_ids` and a structured `request_policy`.

The request policy records:

- `user_agent`;
- `accept`;
- `allowed_methods`;
- `allow_query_string`;
- `authentication`;
- `send_cookies`;
- `timeout_seconds`;
- `redirect_policy` and `max_redirects`;
- `max_attempts`;
- `retry_server_errors`;
- `retry_backoff_seconds`;
- `honor_retry_after`;
- `stop_statuses`;
- `stop_on_challenge`.

The existing top-level source fields continue to own `max_requests_per_minute` and `concurrency_per_host`.

Current live policies are:

| Source | Adapter allowlist | Rate | Redirects | Attempts | Authentication |
| --- | --- | ---: | --- | ---: | --- |
| Wikimedia Commons Action API | `wikimedia-commons-xi-lun` | 6/min | denied | 1 | none |
| Smithsonian National Zoo panda pages | `smithsonian-panda-profiles` | 2/min | one same-host redirect | 2 for server errors | none |

Permission-required and manual-review-required sources have no adapter allowlist, no request policy, and zero automated request capacity. An approved source may temporarily set `live_fetch=false` while retaining its reviewed adapter, host, path, and request policy; in that state its rate and concurrency must be zero, fixture mode remains available, and live mode fails before network access.

## Adapter interface

A concrete adapter declares:

- `adapter_id` and `adapter_version`;
- one reviewed `source_id`;
- `parser_name` and `parser_version`;
- optional default cohort and fixture;
- `build_requests(source, cohort)`;
- `parse(context)`.

`build_requests` returns unique `AdapterRequest` values. The runner checks every request against the source scheme, host, port, credential, path, query-string, and fragment policy before fixture parsing or live access. Every response final URL is checked against the same policy before evidence or candidates are produced.

`parse` receives immutable mappings of response envelopes and v1 evidence snapshots. It returns only `FieldCandidate` values. The runner builds the `AcquisitionRun` and `AcquisitionBundle` around those values.

The default adapter registry currently contains two concrete adapters:

```text
wikimedia-commons-xi-lun
smithsonian-panda-profiles
```

The Smithsonian adapter plans three exact HTML requests and uses the same runner policy, evidence, reconciliation, and local bundle seam as the Commons adapter.

## Fixture mode

Fixture mode does not perform network access and does not call `assert_live_fetch_allowed`. It still requires:

- a known source ID;
- a known concrete adapter ID;
- the adapter to be allowlisted by that source;
- the adapter's planned URLs to remain inside the reviewed source target allowlist.

A one-request adapter accepts a response body file directly. Content type is inferred from its filename and an `x-panda-atlas-fixture` header is added.

A multi-request adapter uses a manifest:

```json
{
  "schema_version": "panda-atlas-acquisition-fixtures/v1",
  "responses": [
    {
      "request_id": "profile-page",
      "body_path": "profile-page.html",
      "status": 200,
      "final_url": "https://example.org/reviewed/profile",
      "headers": {
        "content-type": "text/html; charset=utf-8"
      }
    }
  ]
}
```

Manifest body paths must remain below the manifest directory, every planned request must appear exactly once, and unknown request IDs are rejected.

## Live mode

The generic runner currently supports reviewed public HTTP with no authentication or cookies. It executes sequentially, so per-host concurrency is one. It sleeps `60 / max_requests_per_minute` seconds between planned requests.

For each request it:

1. applies the registry User-Agent and Accept value;
2. uses the registry timeout;
3. disables automatic redirects;
4. enforces the reviewed redirect policy manually;
5. rejects cross-host redirects;
6. checks common CAPTCHA and anti-bot challenge markers;
7. stops on registry stop statuses and records a reviewed `Retry-After` value on 429;
8. retries server errors only when the registry permits it;
9. applies the registry backoff before a permitted retry;
10. accepts only HTTP 200 as a parser input.

The runner never rotates proxies, users, User-Agents, cookies, or identities. Reviewed-session authentication is represented by the registry type but is deliberately not executed by this runner yet.

## Terminal evidence

A completed run writes a bundle with:

- `state=completed`;
- ordered evidence snapshots;
- adapter-produced field candidates;
- source-review dates;
- the review document path and hash;
- a serialized snapshot of the source and request policy.

A stop-status, redirect-policy violation, or challenge writes a bundle with:

- `state=blocked`;
- all completed earlier responses in a multi-request run;
- the blocked response with its block state;
- no field candidates;
- a terminal message.

A fixture, request, or parser failure writes `state=failed`, preserves any available evidence, emits no candidates, and raises `AdapterRunStopped` after the local bundle is written.

Output-path and filesystem errors are not converted into parser failures.

## Commons migration

The Xi Lun Commons parser continues to expose the legacy `parse_xi_lun_result` interface for current callers. The concrete adapter reuses the same validation implementation and emits 20 v1 `media-metadata` field candidates covering:

- exact file identity;
- uploader and upload timestamp;
- original and description URLs;
- dimensions, bytes, MIME type, and SHA-1;
- description, artist, and credit;
- license name, URL, terms, and attribution requirement;
- original capture text and categories;
- the explicit fact that original image bytes were not downloaded.

The adapter preserves the reviewed source-local key `xi-lun` and leaves identity matching unattempted. The shared [conservative identity reconciliation](identity-reconciliation-v1.md) module resolves that key through the reviewed identity-link registry, normalizes the 20 values, attaches current curation values where mapped, and records field-level comparison states before the bundle is written.

## Smithsonian panda profiles

The registered [Smithsonian panda profiles adapter](smithsonian-panda-profiles-adapter.md) plans the three exact HTML pages approved by the source review. It uses a standard-library semantic HTML parser, emits 74 facts-only candidates for 13 existing cohort identities, preserves CSS provenance and raw source values, and fails with evidence but zero candidates when reviewed headings or factual anchors drift.

Its fixture manifest exercises the runner's multi-request path. Full source HTML and media are not committed.

## Reconciliation after parsing

Every successful adapter result is reconciled before `_build_bundle`:

- adapter-provided `matched` states are not accepted as merge authority;
- reviewed source keys and explicit external identifiers take precedence;
- exact names and aliases are used only inside an unambiguous named source cohort;
- raw values remain unchanged while normalized values, current values, identity states, and comparison states are added;
- reconciliation input hashes and state counts are written into run notes.

Invalid reconciliation inputs convert the source run into a failed evidence-only terminal bundle. Reconciliation never opens a trusted or publication write target.

## Out of scope

The runner and reconciliation modules still do not implement:

- curator decisions or curation-patch export;
- scheduled runs;
- trusted database writes;
- Public Release, D1, R2, or frontend publication;
- broad tests, Release Gate, browser or accessibility validation, or cross-platform CI.
