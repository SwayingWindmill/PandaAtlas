# Conservative identity reconciliation v1

Issue: [Implement conservative panda identity matching and field diffing](https://github.com/SwayingWindmill/PandaAtlas/issues/100)

## Purpose

Acquisition adapters preserve source-local subjects and field candidates. The reconciliation module connects those candidates to the existing curation inventory without granting crawler code permission to merge identities, overwrite facts, or publish conclusions.

The module has one interface:

```python
reconcile_candidates(candidates, source=source, cohort=cohort)
```

It returns every input candidate in the original order with:

- a normalized candidate value;
- a `matched`, `ambiguous`, or `unmatched` identity state;
- the current curation value when one can be selected safely;
- a field-level comparison state;
- an auditable reconciliation snapshot ID and match/comparison notes.

The raw source value, source locator, response evidence, parser identity, candidate review state, and competing candidates are preserved.

## Read-only reconciliation snapshot

The default snapshot reads:

- `data/curation/pandas/pandas.csv`;
- `data/curation/pandas/sources.csv`;
- `data/curation/pandas/events.csv`;
- `data/curation/pandas/media.csv`;
- `data/acquisition-sources/identity-links.json`;
- `contracts/golden-dataset/mei-xiang-family.v1.json`.

The current snapshot contains all 809 curation panda rows. The golden dataset supplements the subset that already has reviewed stable UUIDs, published names and aliases, external identifiers, fact assertion IDs, and parentage assertion IDs. The curation CSV remains the current working-value inventory for records that have not been promoted.

Each input contributes its repository path, byte count, row count where applicable, and SHA-256 to a deterministic reconciliation snapshot ID. Snapshot indexes and summary counts are exposed as immutable mappings. Running the same candidates against unchanged inputs produces the same normalized values, identity states, current values, comparison states, candidate identities, and reconciliation summary.

No PostgreSQL, Public Release, D1, R2, frontend, or curation write target is opened.

## Reviewed identity links

`data/acquisition-sources/identity-links.json` stores explicit source-local identity links that have been reviewed outside adapter code:

```json
{
  "source_id": "wikimedia-commons-action-api",
  "source_key": "xi-lun",
  "canonical_slug": "xi-lun",
  "basis": "The reviewed exact Commons file title and description explicitly identify Xi Lun."
}
```

Adapters cannot create merge authority by setting their own candidate state to `matched`. The shared reconciliation module derives the final identity state independently.

A source-key or external-identifier collision produces `ambiguous`; it never selects a winner.

## Match order

A source subject is matched in this order:

1. **Reviewed source key** — exact `(source_id, subject_key)` lookup in the identity-link registry.
2. **Explicit external identifier** — exact normalized `(system, value)` lookup from reviewed identity links or already-published trusted identities. The system is case-folded, while identifier value case and punctuation are preserved after Unicode compatibility and whitespace normalization; `A-1` does not match `A1`.
3. **Exact reviewed name or alias inside a named source cohort** — only when exactly one existing panda in that source scope has the exact normalized term.

There is no fuzzy, phonetic, proximity, parent, date, sex, location, or co-occurrence matching.

### Source-cohort scope

Exact-name matching requires a non-empty cohort label and a reviewed source scope. The scope is derived from curation source URLs that pass the same reviewed scheme, host, port, credential, path, query-string, and fragment policy as acquisition requests, then limited to panda rows that cite those curation source IDs. Explicit reviewed source-key links are also included.

Within that scope, curation names are eligible only when the panda row has `verified` or `partial` evidence. In this repository `partial` means the source is reliable but other database-critical fields remain incomplete. Rows marked `needs_primary_source` do not contribute name terms. Names and aliases from already-published golden identities remain eligible. Canonical slugs and legacy slugs are not treated as names.

This matters because the 809-row inventory contains many duplicate romanized names. For example, `Bao Li`, `An An`, `Qing Qing`, and `Tian Tian` are not globally unique. A name can match only when the reviewed institutional scope makes it unique.

### Identity states

- `matched` — one reviewed source key, external identifier, or exact scoped name resolves to one canonical panda. A stable UUID is included when one already exists; otherwise the canonical slug remains the stable curation reference.
- `ambiguous` — at least two existing identities remain. All competing stable IDs or canonical slugs are retained.
- `unmatched` — no existing identity is accepted.

An ambiguous candidate has no selected current value and remains `not-compared`. An unmatched candidate remains reviewable and is classified as a new source subject.

## Normalization

Normalization changes only `normalized_value`; `raw_value` remains the exact adapter output.

### Names

Names and aliases receive Unicode-safe whitespace normalization. Identity lookup uses the existing `normalize_identity_term` behavior: case folding, compatibility decomposition, diacritic removal, and alphanumeric comparison. The display value is not transliterated or rewritten.

### Sex

Reviewed source variants normalize to:

- `male`;
- `female`;
- `unknown`.

English abbreviations and explicit Chinese sex terms are supported. Unknown values are preserved as normalized text rather than guessed.

### Life status

Reviewed variants normalize to:

- `alive`;
- `deceased`;
- `unknown`.

A source omission does not become an `alive` candidate.

### Dates

Dates normalize to:

```json
{
  "value": "2021-08-04",
  "precision": "day"
}
```

Supported precision values are `day`, `month`, `year`, and `unknown`. Common ISO and English date representations are parsed. Text containing only a defensible year remains year precision. Unparseable text remains present with `unknown` precision; it is not discarded.

### Locations

Location text receives Unicode-safe whitespace normalization. Comparison may recognize a more detailed location when all current location tokens remain present as complete tokens. It does not use arbitrary substring matching: current `China` is compatible with `China, Sichuan`, but not `Chinatown Zoo`. The module does not geocode, translate, infer a holder, or collapse different institutions merely because they share a city or country.

### Parent references

A relationship candidate can be directly compared only when it carries an explicit canonical parent slug. A source name such as `An An` is preserved but returns `not-compared`; it is never converted into a parent slug by name matching.

`father_slug` and `mother_slug` from curation are used only as the current comparison value. They do not create evidence, certainty, or a new relationship candidate.

### Events

Event candidates normalize:

- event type;
- date plus precision;
- location;
- explicitly supplied related values.

They are compared with existing curation event rows for the matched panda. Related values receive whitespace normalization only; `Bao Bao` remains a source name and is not converted to `bao-bao`. The module does not manufacture related pandas from names or prose.

## Comparison states

### `new`

Used when:

- the source subject is unmatched;
- a matched panda has no mapped current field of that kind;
- a source-backed event type does not currently exist.

### `missing-current-value`

Used when the field is part of the curation model but the matched panda currently has a blank or unknown value.

### `unchanged`

Used when normalized candidate and current values are equal, or when a compatible date/location candidate is no more specific than the current value.

### `enrichment`

Used when the candidate is compatible and adds detail, including:

- an exact date that refines a current year or month;
- a more detailed location containing the current coarse location;
- a new reviewed alias;
- compatible additional event detail.

### `contradiction`

Used when both sides are populated but incompatible, including:

- different sex or life status;
- incompatible dates;
- distinct official names after a strong identity match;
- incompatible locations;
- an explicit canonical parent slug different from the current parent;
- incompatible existing event values.

A contradiction does not select a winner. Both candidate evidence and current value remain in the bundle.

### `not-compared`

Used when selecting or contradicting a current value would be unsafe, including:

- ambiguous identity;
- identity matching has not completed;
- a source explicitly emits an absent, `unknown`, `null`, or `none` value; source absence is not evidence against a populated current value;
- a parent candidate supplies only a name rather than an explicit canonical slug.

## Runner integration

A successful source run now follows this sequence:

1. the adapter builds allowlisted requests;
2. the runner captures evidence;
3. the adapter emits raw field candidates with source-local subject keys;
4. reconciliation performs identity matching, normalization, and field comparison;
5. the runner writes the completed v1 acquisition bundle below `.acquisition/bundles/`.

The run notes record the reconciliation schema, snapshot ID, identity-state counts, and conflict-state counts. The CLI summary exposes the same state counts.

If reconciliation fails because its read-only inputs are invalid, the runner writes a failed evidence-only terminal bundle and emits no candidates.

## Deterministic sanity command

The focused local check is:

```bash
uv run --project services/api python services/api/scripts/check_acquisition_reconciliation.py
```

It covers:

- unique exact-name matching inside the Smithsonian cohort despite global duplicate names;
- explicit ambiguous external identifiers;
- unmatched subjects;
- `new`, `unchanged`, `enrichment`, `contradiction`, and `missing-current-value`;
- name-only parent references remaining `not-compared`;
- preservation of raw date text beside normalized date precision;
- repeated-output equality.

## Out of scope

This module does not:

- accept, reject, or defer candidates;
- export curation patches;
- choose between competing evidence;
- update `pandas.csv`, `events.csv`, `media.csv`, or `sources.csv`;
- infer parentage or evidence status;
- perform fuzzy identity resolution;
- publish data;
- schedule acquisition;
- run broad tests, Release Gate, browser, accessibility, or cross-platform verification.
