# Acquisition candidate contract v1

Issue: [Define the acquisition run, evidence snapshot, and field-candidate contract](https://github.com/SwayingWindmill/PandaAtlas/issues/96)

## Purpose

The acquisition contract is the boundary between reviewed source access and curator-owned conclusions. A source adapter may capture evidence and propose field-level candidates, but it cannot write Trusted Archive or Public Projection data.

The machine-readable schema is [`contracts/acquisition-bundle.v1.json`](../../contracts/acquisition-bundle.v1.json). Python producers use `app.acquisition.contracts` and write bundles through `app.acquisition.bundles.write_local_bundle`.

## Bundle boundary

The v1 media type is identified by:

```text
panda-atlas-acquisition-bundle/v1
```

Generated bundles are local working artifacts under:

```text
.acquisition/bundles/
```

The writer rejects paths outside that root. `.acquisition/` is ignored by Git. A bundle always serializes empty `trusted_write_targets` and `publication_write_targets` arrays; constructing a bundle with either target populated raises an error.

The contract has four layers:

1. `AcquisitionRun` records which reviewed source, adapter, parser, cohort, and execution mode produced the bundle.
2. `EvidenceSnapshot` records the HTTP evidence envelope and content digest without storing response bytes in the bundle.
3. `FieldCandidate` records one source-backed proposed value for one field of one source subject.
4. `AcquisitionBundle` binds a run, its evidence snapshots, and its candidates into one versioned local artifact.

## Candidate kinds

An adapter emits only the kinds it can support explicitly:

- `identity` — official names, aliases, sex, birth information, life status, and external identifiers.
- `relationship` — explicitly stated parentage or other reviewed relationships.
- `residency` — a source-backed place and effective interval.
- `event` — a dated real-world occurrence such as birth, arrival, transfer, return, naming, or public debut.
- `media-metadata` — source and rights metadata only; this contract does not authorize image-byte acquisition.

Missing information is omitted. Adapters must not emit inferred values to make a record look complete.

## Evidence snapshots

An evidence snapshot preserves:

- reviewed `source_id`;
- requested and final HTTPS URL;
- timezone-aware capture time;
- HTTP status and normalized response headers;
- response byte count and lowercase SHA-256;
- access capability and block state;
- content type and notes.

The `evidence_snapshot_id` is a SHA-256 content identity derived from:

```text
source_id + requested_url + final_url + HTTP status + body_sha256
```

Capture time and incidental response headers do not participate in that identity. Fetching the same body again therefore refers to the same evidence content while retaining a new observation time in the new run. A changed body hash creates a new evidence snapshot identity.

Response bytes remain outside the bundle. A later evidence-attachment workflow may retain approved bytes in restricted storage, but this acquisition contract does not expose such a write target.

## Field candidates

Every field candidate preserves:

- source and evidence identity;
- candidate kind and canonical field path;
- a source-local subject key;
- exact source location, such as JSON path, API field, CSS selector, XPath, text span, or document section;
- raw source value and normalized candidate value;
- identity-match state and any matched stable panda identity;
- current trusted value and assertion IDs when available;
- parser name and version;
- comparison/conflict state;
- review state and notes.

Candidate values must be finite JSON values. NaN, Infinity, Python objects, database handles, and executable values are rejected.

### Identity states

- `not-attempted` — the adapter emitted a source subject but no matching process has run.
- `matched` — exactly one stable panda identity or canonical slug is identified.
- `ambiguous` — at least two stable identity candidates remain.
- `unmatched` — no existing panda identity is accepted.

Ambiguous and unmatched candidates remain reviewable evidence. They are never silently merged or discarded.

### Comparison states

- `not-compared`
- `new`
- `unchanged`
- `enrichment`
- `contradiction`
- `missing-current-value`

The conservative identity and field-diff ticket owns assigning these states. An adapter may leave every candidate as `not-compared`.

### Review states

- `unreviewed`
- `accepted`
- `rejected`
- `deferred`

Acquisition adapters emit `unreviewed`. A later curator-decision artifact owns changing the review decision; crawler execution alone cannot accept a fact.

## Stable candidate identities

The contract exposes two related hashes.

### `candidate_id`

The candidate ID identifies the exact parser output and includes:

```text
source_id
+ evidence_snapshot_id
+ candidate_kind
+ subject_key
+ field_path
+ source_locator
+ normalized_value
+ parser_name
+ parser_version
```

A parser or selector change therefore produces a separately auditable candidate record even when its semantic value is unchanged.

### `deduplication_key`

The deduplication key represents the semantic source evidence and includes:

```text
source_id
+ matched panda identity or source identity
+ candidate_kind
+ field_path
+ normalized_value
+ evidence_body_sha256
```

It deliberately excludes capture time, parser version, and selector. An unchanged source body and unchanged normalized value cannot create a second semantic candidate. A changed body creates a new key so the new evidence remains auditable, even when the normalized value happens to remain the same.

Within one bundle, duplicate snapshot IDs, candidate IDs, or deduplication keys are rejected.

## Parser and run invariants

A terminal run (`completed`, `blocked`, or `failed`) must carry `completed_at`; a `started` run must not. Live runs must carry both the source-review date and its expiry date.

All candidates in a bundle must:

- use the same `source_id` as the run;
- reference an evidence snapshot contained in the bundle;
- repeat the evidence snapshot body SHA-256 exactly;
- use the parser name and parser version declared by the run.

These constraints prevent a bundle from combining unrelated source evidence or hiding parser drift.

## Example producer shape

```python
from datetime import datetime, timezone

from app.acquisition.contracts import (
    AcquisitionBundle,
    AcquisitionCapability,
    AcquisitionMode,
    AcquisitionRun,
    AcquisitionRunState,
    CandidateKind,
    CurrentTrustedValue,
    EvidenceBlockState,
    EvidenceSnapshot,
    FieldCandidate,
    IdentityMatchState,
    PandaIdentityMatch,
    SourceLocator,
    SourceLocatorKind,
)
from app.acquisition.bundles import write_local_bundle

captured_at = datetime.now(timezone.utc)
body = b'{"name":"Example Panda"}'
snapshot = EvidenceSnapshot.from_http_response(
    source_id="reviewed-official-source",
    requested_url="https://example.org/api/pandas/example",
    final_url="https://example.org/api/pandas/example",
    captured_at=captured_at,
    status=200,
    headers={"content-type": "application/json"},
    body=body,
    block_state=EvidenceBlockState.CLEAR,
    capability=AcquisitionCapability.PUBLIC_HTTP,
)
run = AcquisitionRun(
    run_id="reviewed-official-source-example-20260722T010000Z",
    source_id="reviewed-official-source",
    adapter_id="official-profile-api",
    adapter_version="1.0.0",
    parser_name="official-profile-parser",
    parser_version="1.0.0",
    mode=AcquisitionMode.FIXTURE,
    state=AcquisitionRunState.COMPLETED,
    started_at=captured_at,
    completed_at=captured_at,
)
candidate = FieldCandidate(
    source_id=run.source_id,
    evidence_snapshot_id=snapshot.snapshot_id,
    evidence_body_sha256=snapshot.body_sha256,
    candidate_kind=CandidateKind.IDENTITY,
    subject_key="source-profile:example",
    field_path="identity.names.official.en",
    source_locator=SourceLocator(
        kind=SourceLocatorKind.JSON_PATH,
        value="$.name",
    ),
    raw_value="Example Panda",
    normalized_value={"language": "en", "value": "Example Panda"},
    identity_match=PandaIdentityMatch(
        state=IdentityMatchState.NOT_ATTEMPTED,
        source_identity="source-profile:example",
    ),
    current_trusted_value=CurrentTrustedValue(present=False),
    parser_name=run.parser_name,
    parser_version=run.parser_version,
)
bundle = AcquisitionBundle(
    run=run,
    evidence_snapshots=(snapshot,),
    candidates=(candidate,),
    created_at=captured_at,
)
write_local_bundle(bundle)
```

This example writes only a local candidate bundle. It does not modify curation CSV files, PostgreSQL, Public Release, D1, R2, or frontend data.

## Ownership of later work

- The reviewed registry and runner ticket migrates existing adapters onto this contract.
- The identity-matching ticket assigns matched identities and comparison states.
- The curator-decision ticket records accept/reject/defer decisions separately and exports accepted candidates as a curation-patch proposal.
- The map-closing ticket owns schema validation tests, deduplication tests, cross-platform CI, Release Gate, and final immutable evidence.
