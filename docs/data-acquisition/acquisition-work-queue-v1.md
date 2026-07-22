# Acquisition work queue v1

Issue: [Build the deterministic acquisition work queue for 809 panda records](https://github.com/SwayingWindmill/PandaAtlas/issues/97)

## Purpose

The acquisition work queue converts the current panda curation inventory into a deterministic, source-oriented planning artifact. It answers two questions without network access:

1. Which panda records have the largest evidence and completeness gaps?
2. Which reviewed institution, backlog target, or current source domain is the most coherent cohort for addressing each gap?

The queue does not fetch pages, change curation CSV files, write PostgreSQL, build a Public Release, update D1 or R2, or publish frontend data.

## Command

```bash
uv run --project services/api python services/api/scripts/build_acquisition_work_queue.py --overwrite
```

The default output is:

```text
.acquisition/work-queue/panda-acquisition-work-queue.v1.json
```

`.acquisition/` is ignored by Git. The writer rejects output paths outside `.acquisition/work-queue/` and serializes empty trusted and publication write-target lists.

## Inputs

The builder reads exactly these files:

- `data/curation/pandas/pandas.csv`
- `data/curation/pandas/sources.csv`
- `data/curation/pandas/events.csv`
- `data/curation/pandas/media.csv`
- `data/curation/pandas/source-expansion-backlog.csv`

Every input entry preserves its byte count, row count, repository path, and SHA-256. No clock time is included in the queue identity, so rebuilding from unchanged inputs and code produces the same ordering, record IDs, and queue ID.

## Queue shape

The schema identifier is:

```text
panda-atlas-acquisition-work-queue/v1
```

The queue contains input snapshots, cohort definitions and summaries, one work record for each unique panda and cohort opportunity, panda-level and record-level counts, and an explicit empty write boundary. A panda is always represented at least once. Duplicate panda/cohort pairs and omitted pandas are rejected.

## Cohort opportunities

A cohort is one of four kinds.

### Backlog target

A row from `source-expansion-backlog.csv`. A panda is assigned only when at least one conservative signal exists:

- the panda's own location, tags, intro, or notes contain the complete institution/source phrase or at least two high-specificity institution tokens;
- the backlog reason or notes explicitly name a uniquely named panda;
- one of the panda's current source IDs has a strict source-to-target association.

Non-unique English or Chinese names never create a backlog opportunity on their own. A backlog reference to one “Bing Bing” therefore cannot assign every panda with that English name.

### Official source domain

A current source domain containing an official, government, or institutional source. This lets adapters process a coherent existing source family when no backlog row has been linked.

### Discovery source domain

A current secondary source domain. These cohorts do not authorize that source as trusted evidence. They group records that need an official-source replacement or primary confirmation.

### Unassigned official-source review

The fallback when no deterministic institution, backlog, or source-domain opportunity can be found. This prevents a panda from disappearing from the queue while keeping the missing source decision explicit.

## Strict source-to-backlog association

Current source IDs are attached to a backlog cohort only when the source identity is strong enough:

- the complete target label appears in publisher, title, or URL identity; or
- the target label contains the full publisher and a target-specific token also appears in the source title or URL.

Source notes are not used for this association. Generic planning words such as `archive`, `history`, `records`, `legacy`, `profile`, and `index` are never institution anchors. When strict association is not possible, the source remains in its domain cohort rather than being guessed into a backlog target.

## Priority order

The numeric score uses non-overlapping evidence bands so gap bonuses cannot invert the required order:

| Evidence state | Base score |
| --- | ---: |
| `needs_primary_source` | 3000 |
| `partial` | 2000 |
| `verified` but not approved | 1000 |
| approved maintenance | 0 |

Gap bonuses are then added:

| Gap | Bonus |
| --- | ---: |
| both parents missing | 100 |
| current location missing | 100 |
| Chinese name missing | 90 |
| no structured events | 90 |
| current location still needs primary evidence | 60 |
| one parent missing | 50 |
| events exist but none are verified | 45 |
| no approved licensed media | 40 |
| exact day-level birth date missing | 35 |
| gender unknown | 25 |
| life status unknown | 25 |

Backlog priority contributes an additional 60, 30, or 10 points for priorities 1, 2, or 3. Every record contains the complete scoring reasons. Ordering is descending score, cohort ID, panda slug, then stable record ID.

## Missing-field signals

The queue surfaces these independently:

- `name_zh`
- `parentage`
- `complete_parentage`
- `structured_events`
- `verified_event_coverage`
- `current_location`
- `current_location_primary_evidence`
- `licensed_media`
- `exact_birth_date`
- `gender`
- `life_status`

Current source IDs, evidence state, review state, event counts, verified-event counts, and approved-media counts remain on every work record.

## Stable identities

A `record_id` is derived from canonical JSON containing the panda slug, cohort ID, current source IDs, source IDs associated with the cohort, evidence and review states, missing fields, and priority score.

The top-level `queue_id` is derived from the complete canonical queue payload, including input hashes, cohort summaries, and ordered records.

## Current baseline

Using the repository inputs on July 22, 2026, the builder produced:

- 809 pandas;
- 1,594 panda/cohort work records;
- 127 referenced cohorts;
- an average of 1.97 cohort opportunities per panda;
- a maximum of 7 opportunities for one panda;
- 543 pandas in `needs-primary-source`;
- 161 pandas in `partial-evidence`;
- 97 verified but unapproved pandas;
- 8 approved maintenance pandas.

Panda-level gaps were:

- 558 missing Chinese names;
- 671 missing both parents;
- 28 missing one parent;
- 625 with no structured events;
- 78 with events but no verified event;
- 703 with a current location that still needs primary evidence;
- 1 with no current location;
- 801 without approved licensed media;
- 154 without an exact day-level birth date;
- 44 with unknown gender;
- 23 with unknown life status.

The largest cohort is the existing `giantpandaglobal.com` discovery-source domain, covering 629 pandas. That is a replacement/confirmation batch, not permission to promote Giant Panda Global records as trusted facts.

## Ownership of later work

- The source registry and adapter runner ticket consumes cohort and source identifiers from this queue.
- The first institutional source review decides which official cohort can be fetched live.
- Identity matching and field diffing operate on field candidates, not directly on queue records.
- The map-closing ticket owns complete tests for sorting, identity collisions, cohort matching, deterministic output, path boundaries, and cross-platform behavior.
