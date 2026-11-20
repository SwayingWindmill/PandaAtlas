# Panda Atlas Glossary Map

Bounded contexts in the current V2 system (`services/api/src/modules/`):

## Trusted Archive

Owns stable panda identities (`panda`), structured names, sourced assertions, parentage assertions (`lineage`), places and institutions (`places`), residency/life-event history (`life-history`), source evidence (`evidence`), reviewed media metadata (`media`), and the Mei Xiang family golden dataset.

Glossary: [`contracts/golden-dataset/GLOSSARY.md`](contracts/golden-dataset/GLOSSARY.md)

## Curation Intake

Owns source discovery, continuous social/official collection (`services/collector`), offline curation validation/media tooling (`tools/panda-data`), and working records (`data/curation/`) that have not yet become trusted archive conclusions. Intake data can be incomplete, contradictory, or awaiting review.

## Public Projection & Updates

Owns immutable public release control (`publication`), derived `public_read` snapshots consumed by Web and Mobile clients (`public-read`), edge-cache purge coordination, public release update changelogs (`updates`), and follow-derived popularity counts (`popularity`). It does not own professional or restricted truth.

Glossaries and decisions: [`docs/architecture/GLOSSARY.md`](docs/architecture/GLOSSARY.md), [`docs/architecture/adr-0001-single-source-api-boundary.md`](docs/architecture/adr-0001-single-source-api-boundary.md)

## Learning & Curated Catalogs

Owns published 科普 articles, terms, face guides, and reference datasets (`learning`, `comparisons`, `overseas-status`, `venue-news`) under the unified `catalog` module.

## Ask Panda

Owns grounded Q&A responses over published archive facts, cited public sources, and per-account daily usage limits (`ask`).

## Fan Engagement & Games

Owns authenticated fan follows, place visits, seen-panda marks, collections (`engagement`), daily online check-ins and leave days (`daily-checkin`), and panda discovery games (`game`).

Product glossary: [`docs/architecture/GLOSSARY.md`](docs/architecture/GLOSSARY.md)

## Identity & Access

Owns application account state, staff role assignments, database-driven capabilities (`identity.capabilities`), suspensions/revocations, and recent-authentication checks layered over Supabase Auth (`identity`).

## Community Intake & Review

Owns authenticated structured contribution drafts, immutable submission revisions, contributor-supplied references (`contribution`), and editorial review cases (`review`) whose accepted decisions write approved facts to the Trusted Archive. It does not own publication or public media rights.

## Notification Orchestration

Owns account notification preferences, native inbox/read state, outbox-driven notification intents, delivery attempts, and digest batches (`notification`). It does not own Archive facts, Follow commands, or submission decisions.

## Privacy & Audit

Owns authenticated data export and erasure workflows (`privacy`) and append-only downstream audit projections (`audit`).

## Relationships & Canonical Vocabulary Freeze

- Curation Intake proposes evidence and curated records for review or batch ingestion into the Trusted Archive.
- The Trusted Archive owns canonical facts and decides which conclusions and dependencies are publishable.
- Public Projection (`publication` + `public-read`) derives immutable snapshots solely from published Trusted Archive state and drives `updates` changelog records.
- Community Intake accepts authenticated structured contributions; an approved `review` decision writes accepted facts into the Trusted Archive.
- Notification Orchestration consumes publication, update, and contributor-visible review events while retaining ownership of preferences, inbox state, and delivery.
- Fan Engagement & Games (`engagement`, `daily-checkin`, `game`) and Ask Panda (`ask`) read public projections and write only account-scoped state; Privacy coordinates export and erasure across owning modules.
- The golden dataset is the shared acceptance fixture spanning the archive and projection contexts; it is not a replacement for production data.
- **Vocabulary freeze:** All new contracts, tests, and documentation must use the canonical terms frozen in [`docs/architecture/GLOSSARY.md`](docs/architecture/GLOSSARY.md) and [`contracts/golden-dataset/GLOSSARY.md`](contracts/golden-dataset/GLOSSARY.md) instead of coining new synonyms for `Place`, `Follow`, `Place Visit`, `Daily Check-in`, or `Public Update`.
