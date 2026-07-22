# Curator decisions and curation patch proposals v1

Issue: [Add curator decisions and provenance-preserving curation-patch export](https://github.com/SwayingWindmill/PandaAtlas/issues/102)

## Purpose

Acquisition produces evidence candidates, never trusted facts. This workflow gives a curator three local-only operations:

1. summarize candidates;
2. append an accept, reject, or defer decision;
3. export effective accepted decisions as an auditable curation patch proposal.

A curation patch is not an applied patch. It is a typed proposal for a later intake process. The workflow does not edit `data/curation/pandas/*.csv`, PostgreSQL, Public Release, D1, R2, or frontend data.

## Local roots

All workflow files remain under ignored local directories:

```text
.acquisition/bundles/
.acquisition/decisions/
.acquisition/curation-patches/
```

Path traversal, symlink breakout, non-JSON output, and accidental overwrite are rejected.

## Review summary

```bash
uv run --project services/api python services/api/scripts/curate_acquisition_candidates.py \
  summary \
  --bundle smithsonian-profile-sanity-a.json
```

The summary groups by:

- canonical panda slug when available, otherwise stable panda ID or source identity;
- source ID;
- candidate kind;
- conflict state.

JSON output is available with `--format json`. An optional `--decisions` file adds effective decision counts while retaining all candidate IDs in each group.

## Decision log

```bash
uv run --project services/api python services/api/scripts/curate_acquisition_candidates.py \
  decide \
  --bundle smithsonian-profile-sanity-a.json \
  --decisions smithsonian-review.v1.json \
  --candidate-id candidate-... \
  --decision accepted \
  --reviewer curator@example.org \
  --note "Official profile explicitly states this value."
```

Each decision records:

- stable decision ID;
- candidate ID;
- evidence snapshot ID copied from that candidate;
- reviewer identity;
- timezone-aware decision timestamp;
- `accepted`, `rejected`, or `deferred`;
- optional note.

The decision log is append-only. A later decision does not delete an earlier decision. Summary and export use the latest timestamped decision for each candidate; identical timestamps for one candidate are rejected.

The versioned contract is `contracts/curator-decisions.v1.json` with schema version `panda-atlas-curator-decisions/v1`.

## Curation patch export

```bash
uv run --project services/api python services/api/scripts/curate_acquisition_candidates.py \
  export \
  --bundle smithsonian-profile-sanity-a.json \
  --decisions smithsonian-review.v1.json \
  --output smithsonian-proposals.v1.json
```

Only effective accepted decisions become proposals. The patch contains typed sections:

- `pandas`: proposed identity fields, including unmatched identities that may need a new panda intake record;
- `events`: structured domain-event proposals;
- `relationships`: parentage assertion proposals that preserve unresolved source text;
- `residencies`: location or residency proposals;
- `sources`: deduplicated evidence snapshots used by accepted proposals.

Media metadata is not exported in this contract because this ticket does not define media intake or authorize media reuse.

Every proposal preserves:

- acquisition bundle and run IDs;
- decision and reviewer details;
- source ID;
- evidence snapshot ID and body SHA-256;
- parser name and version;
- source locator;
- original source value;
- normalized value;
- prior trusted value and assertion IDs;
- original conflict state and candidate notes.

The versioned contract is `contracts/curation-patch.v1.json` with schema version `panda-atlas-curation-patch/v1`.

## Export refusals

Export fails closed when an effective accepted candidate has:

- an ambiguous or not-attempted identity match;
- an unmatched identity for an event, relationship, or residency proposal;
- an unresolved contradiction;
- a null normalized value representing source absence;
- media metadata outside this patch contract;
- missing evidence, a mismatched evidence hash, a blocked snapshot, or a non-200 snapshot;
- a source review that has not started or has expired;
- a decision or decision-log timestamp after the requested patch creation time.

Recording an accept decision is still allowed for audit purposes even when export will refuse it. Acceptance alone does not resolve an identity ambiguity or contradiction.

## Write boundary

Decision and patch files always expose:

```json
{
  "canonical_curation_write_targets": [],
  "trusted_write_targets": [],
  "publication_write_targets": []
}
```

No command opens a canonical curation CSV or database connection for writing.

## Focused sanity

```bash
uv run --project services/api python services/api/scripts/check_curator_decision_export.py
```

The focused check covers command parsing, append-only effective decisions, one proposal in each supported intake section, provenance retention, path confinement, stable output identities, and the refusal states listed above.

Verification: deferred to the map-closing ticket. Full tests, Release Gate, cross-platform CI, browser, accessibility, staging, publication, immutable-hash, and rollback verification are not owned by this ticket.
