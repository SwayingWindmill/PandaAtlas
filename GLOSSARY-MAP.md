# Panda Atlas Glossary Map

Bounded contexts in the current V2 system (`services/api/src/modules/`):

## Trusted Archive

Owns stable panda identities (`panda`), structured names, sourced assertions, parentage assertions (`lineage`), places and institutions (`places`), residency/life-event history (`life-history`), source evidence (`evidence`), reviewed media metadata (`media`), publication readiness, and the Mei Xiang family golden dataset.

Glossary: [`contracts/golden-dataset/GLOSSARY.md`](contracts/golden-dataset/GLOSSARY.md)

## Curation Intake

Owns source discovery, continuous social/official collection (`services/collector`), offline curation validation/media tooling (`tools/panda-data`), and working records (`data/curation/`) that have not yet become trusted archive conclusions. Intake data can be incomplete, contradictory, or awaiting review.

## Public Projection & Updates

Owns immutable public releases (`publication`), derived `public_read` snapshots consumed by the Web and Mobile apps, edge-cache purge coordination, public release update changelogs (`updates`), and follow-derived popularity counts (`popularity`). It does not own professional or restricted truth.

Architecture decision: [`docs/architecture/adr-0001-single-source-api-boundary.md`](docs/architecture/adr-0001-single-source-api-boundary.md)

## Learning & Curated Catalogs

Owns published 科普 articles, terms, face guides, and challenges (`learning`) alongside singleton reviewed reference catalogs (`comparisons`, `overseas-status`, `venue-news`).

## Ask Panda

Owns grounded Q&A responses over published archive facts, cited public sources, and per-account daily usage limits (`ask`).

## Fan Engagement & Games

Owns authenticated fan favorites, venue follows, collections, physical location check-ins, seen-panda marks, online daily check-ins (`engagement`), and panda discovery games (`game`).

## Identity & Access

Owns application account state, staff role assignments, database-driven capabilities (`identity.capabilities`), suspensions/revocations, and recent-authentication checks layered over Supabase Auth (`identity`).

## Community Intake & Review

Owns authenticated structured contribution drafts, immutable submission revisions, contributor-supplied references (`contribution`), and editorial review cases (`review`) whose accepted decisions write approved facts to the Trusted Archive. It does not own publication or public media rights.

## Notification Orchestration

Owns account notification preferences, native inbox/read state, outbox-driven notification intents, delivery attempts, and digest batches (`notification`). It does not own Archive facts, Follow commands, or submission decisions.

## Privacy & Audit

Owns authenticated data export and erasure workflows (`privacy`) and append-only downstream audit projections (`audit`).

## Relationships

- Curation Intake proposes evidence and curated records for review or batch ingestion into the Trusted Archive.
- The Trusted Archive owns canonical facts and decides which conclusions and dependencies are publishable.
- Public Projection derives immutable snapshots solely from published Trusted Archive state and drives `updates` changelog records.
- Community Intake accepts authenticated structured contributions; an approved `review` decision writes accepted facts into the Trusted Archive.
- Notification Orchestration consumes publication, update, and contributor-visible review events while retaining ownership of preferences, inbox state, and delivery.
- Fan Engagement & Games and Ask Panda read public projections and write only account-scoped state; Privacy coordinates export and erasure across owning modules.
- The golden dataset is the shared acceptance fixture spanning the archive and projection contexts; it is not a replacement for production data.
