# Smithsonian panda profiles adapter

Issue: [Implement the first approved official panda-profile adapter](https://github.com/SwayingWindmill/PandaAtlas/issues/101)

## Purpose

The Smithsonian adapter converts three reviewed official HTML pages into field-level acquisition candidates for the existing Panda Atlas curation inventory. It is a facts-only, review-only source adapter. It does not copy page prose, images, layout, or branding, and it does not update curation or publication data.

The adapter ID is `smithsonian-panda-profiles`. It is registered only for the reviewed source `smithsonian-national-zoo-panda-pages`.

## Reviewed request boundary

The source registry permits exactly three HTTPS GET targets:

- `/animals/giant-panda`;
- `/animals/giant-panda-faqs`;
- `/animals/history-giant-pandas-zoo`.

The generic runner enforces the reviewed policy:

- descriptive `PandaAtlasBot` user agent;
- `Accept: text/html`;
- no authentication, cookies, browser impersonation, proxy rotation, or JavaScript execution;
- one request at a time;
- at most two requests per minute;
- no query string or fragment;
- at most one same-host redirect;
- stop on reviewed authorization, policy, rate-limit, unavailable, legal, or human-challenge states.

The adapter never constructs or follows links outside those three exact registry paths.

## Parser architecture

`services/api/app/acquisition/smithsonian_pandas.py` uses the Python standard-library `HTMLParser` to build a small semantic tree. No browser or third-party DOM engine is required.

The parser validates before extraction:

- HTTP status is 200;
- response content type is HTML;
- live HTML bodies remain above the reviewed minimum-size floor;
- the exact page title and primary heading remain present;
- reviewed page sections, FAQ questions, timeline headings, and unique factual paragraphs remain present exactly once.

The parser does not silently choose the first matching paragraph when a phrase appears more than once. It uses a more specific reviewed anchor or stops with parser drift.

A parser or fixture failure is handled by the shared runner as a failed evidence-only terminal bundle. All captured page evidence remains available, but the bundle contains zero candidates.

## Source locations

Each candidate records:

- source page identity through its evidence snapshot URL and body SHA-256;
- a deterministic CSS selector for the exact paragraph that carried the value;
- adapter and parser version;
- source-local panda key;
- raw source value;
- normalized value after shared reconciliation.

CSS locators use stable semantic classes and local `nth-of-type` positions. They are references for curator review, not instructions to scrape unrelated page content.

## Covered panda records

The reviewed cohort resolves to 13 existing curation records:

- Bao Li;
- Qing Bao;
- An An;
- Qing Qing;
- Jia Mei;
- Tian Tian;
- Mei Xiang;
- Tai Shan;
- Bao Bao;
- Bei Bei;
- Xiao Qi Ji;
- Ling Ling, the historical Smithsonian panda;
- Hsing Hsing.

Adapters do not assign canonical slugs. They emit source-local keys such as `smithsonian:bao-li` and exact official-name candidates. Shared reconciliation performs the curation identity match inside the reviewed Smithsonian cohort.

## Extracted fields

The adapter emits only facts explicitly stated on the reviewed pages:

- official English names;
- sex;
- birth dates and birth locations;
- historical death status and dates;
- current Smithsonian habitat for the current pair;
- parent names;
- dated birth, naming, arrival, transfer, public-debut, and death events.

The fixture run currently produces 74 candidates across three evidence snapshots. All 74 match one of the 13 existing cohort identities.

## Parentage boundary

Parent values remain source text:

```json
{
  "field_path": "relationship.father",
  "raw_value": "An An"
}
```

The adapter never converts a parent name into a canonical slug. Shared reconciliation attaches the current curation parent for comparison but marks name-only parent candidates `not-compared`. A later curator decision can resolve the relationship with the preserved source evidence.

## Location boundary

The adapter distinguishes two location concepts within this ticket's scope:

- `identity.birthplace` for an explicitly stated birth location;
- `residency.current_location` for the current Smithsonian habitat.

A detailed Smithsonian habitat is represented as structured location components:

```json
{
  "facility": "David M. Rubenstein and Family Giant Panda Habitat",
  "institution": "Smithsonian National Zoo"
}
```

This allows conservative reconciliation to recognize the source-stated facility as an enrichment of the current coarse institution rather than a contradiction. The adapter does not add a city that the FAQ answer does not state.

Relative history-page locations such as `their new home` and `the Zoo` remain raw source context; they are not expanded into a formal institution or city. A departure statement does not become a current-location candidate. For the 2023 departure, the raw event preserves the stated departure institution, while normalized event location remains absent because the passage does not identify a destination or current holder.

## Dates and timeline years

Dates written directly with a year are preserved in raw form and normalized by shared reconciliation.

Some history-page events state only month and day inside a timeline section. For those events, the adapter records both values:

```json
{
  "event_date": "Aug. 23, 2013",
  "source_date_text": "Aug. 23",
  "section_year": "2013"
}
```

The parser accepts the combined date only when the nearest preceding timeline heading contains the expected four-digit year. If sentence and heading years disagree, parsing stops.

The shared reconciliation module normalizes `euthanized` to life status `deceased`; it does not infer a death status from an unrelated event or date.

## Explicit absence

The adapter emits `null` when a reviewed passage supplies the subject context but not the requested value, including:

- current-pair profile paragraphs that do not state current life status;
- the 2023 departure paragraph, which does not state a current holder for Tian Tian, Mei Xiang, or Xiao Qi Ji.

Shared reconciliation marks these candidates `not-compared`. Source omission is not evidence against a populated curation value.

## Offline fixtures

The committed fixtures are deliberately minimal:

- `smithsonian-giant-panda.html`;
- `smithsonian-giant-panda-faqs.html`;
- `smithsonian-history-giant-pandas.html`;
- `smithsonian-panda-pages.manifest.json`.

They contain only the semantic headings, FAQ structure, and factual sentence fragments required by the parser. Full Smithsonian page HTML, scripts, styles, images, navigation, and unrelated content are not committed.

The manifest uses the shared multi-request fixture contract. The parser trusts the runner's fixture mode—not a response header—when exempting the intentionally small offline pages from the reviewed live-body-size floor.

## Focused sanity command

```bash
uv run --project services/api python services/api/scripts/check_smithsonian_panda_profiles.py
```

The focused check verifies:

- three evidence snapshots;
- 74 deterministic candidates over repeated runs;
- exactly 13 matched curation identities;
- no ambiguous, unmatched, or contradiction state;
- preserved CSS provenance, response hashes, parser identity, and raw values;
- parent name-only safety;
- explicit absence safety;
- timeline date reconstruction and ISO normalization;
- structured-location enrichment;
- zero trusted and publication write targets.

The reviewed current HTML was also parsed locally through the same runner path. Its 74-candidate semantic projection matches the committed fixtures exactly; the full HTML remains under the ignored `.acquisition/` directory.

## Current fixture result

```text
candidate_count: 74
matched: 74
unchanged: 39
enrichment: 4
missing-current-value: 8
new: 9
not-compared: 14
contradiction: 0
trusted_write_targets: []
publication_write_targets: []
```

`new` includes source-backed events that are not yet present in curation. `missing-current-value` includes event kinds for matched pandas whose curation event inventory is currently empty. Neither state writes data automatically.

## Out of scope

This adapter does not:

- accept or reject candidates;
- export curation patches;
- infer canonical parent slugs;
- infer current holders from departures;
- infer aliases that the source does not state;
- download or reuse media;
- crawl Smithsonian links or news pages;
- execute JavaScript;
- bypass access controls or challenges;
- write PostgreSQL, curation CSV, Public Release, D1, R2, or frontend data;
- run broad tests, Release Gate, cross-platform CI, browser, accessibility, Staging, publication, hash, or rollback verification.
