# Public Experiences Map-Close

Issue: #234

Parent map: #230

Public Release: `2026.07.31.1`

Public Schema: `1.3.0`

Projection: `public-experience-v1`

## Delivered surfaces

| Surface | Web route | FastAPI read route | Release-owned input |
| --- | --- | --- | --- |
| Panda Profile V2 | `/{locale}/pandas/{slug}` | `/api/v1/pandas/{panda_ref}/profile` | pandas, facts, residencies, events, parentage assertions, sources, profile cohort |
| Panda Moments | `/{locale}/moments` | `/api/v1/moments` | canonical source events plus explicitly derived birthday anniversaries |
| Family Stories | `/{locale}/families/{slug}` | `/api/v1/family-stories` and `/api/v1/family-stories/{story_ref}` | declared members, relationship assertions, events, sources, chapters, and revision metadata |

All core page content is server rendered. Query filtering and navigation remain usable without JavaScript.

## First-cohort fixtures

| Fixture | Purpose | Expected state |
| --- | --- | --- |
| Xi Lun | rich Profile V2 | licensed media, reviewed events, lineage, and current residency |
| Lun Hui | sparse Profile V2 | reviewed identity and current Chengdu residency with explicit content gaps |
| Yong Ba | historic Profile V2 | deceased historical identity, English romanized name only, no invented dates or Chinese name, no licensed media |
| Smithsonian Generations | multi-generation Family Story | 7 declared members, 9 confirmed relationships, 1 tentative relationship, and 2 explicitly excluded relationships |
| Ueno Twins | compact Family Story | 4 declared members, 4 confirmed relationships, and 5 referenced events |

## Evidence and inference boundaries

- Parentage status comes from reviewed parentage assertions. Flat `father_id` and `mother_id` compatibility fields are not used to infer tentative, disputed, or superseded evidence.
- Family Story scope is explicit. Members, relationships, events, and sources are included only by stable release IDs declared by the story record.
- Derived anniversaries are presentation occurrences linked to source events. They do not add or duplicate canonical event records.
- Historic and sparse fixtures preserve unknown fields instead of manufacturing dates, names, media, or relationships.
- Public source metadata may expose `evidence_tier`; restricted evidence bodies and curator fields remain excluded by the public-data boundary.

## Withdrawal and rollback behavior

Database withdrawals are applied before public experience responses are built.

- Withdrawing a panda removes dependent parentage assertions and events that can no longer be represented safely.
- A Family Story is removed when a declared member, required relationship, referenced event, or required source is unavailable.
- Direct story withdrawal removes only the selected story.
- The profile cohort is filtered to still-published panda slugs.
- Immutable release files remain intact; rollback changes the active release pointer rather than rewriting release history.

## Release artifacts

The immutable release directory contains:

- `api.json`
- `pandas.json`
- `pandas.csv`
- `d1.sql`
- `manifest.json`

The reviewed source is `data/reviewed-batches/2026.07.31.1/source.json`. The builder writes emitted release files as UTF-8 bytes so Windows newline conversion cannot drift manifest byte counts or SHA-256 values.

## Verification summary

- FastAPI: 437 passed, 27 environment-dependent tests skipped.
- Focused public experience and OpenAPI tests: 68 passed.
- Release contract tests: 254 passed.
- Candidate Beta hard gates: release integrity, public-data boundary, trusted archive, admin-token boundary, and waiver policy passed.
- Public experience browser journeys: 6 passed.
- Automated accessibility and 320 px journeys: 48 passed.
- Production build: Profile 114 kB First Load JS; Moments and Family Story 109 kB each.
- Canonical gzip budget: Moments and Family Story approximately 109.9 kB each against a 143,360-byte limit.

The map-close reports and sealed manifest are written under `.release-gate` by `npm run release:map-close`.
