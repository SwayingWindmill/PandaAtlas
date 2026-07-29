# Panda Atlas Context Map

## Trusted Archive

Owns stable panda identities, structured names, sourced assertions, relationships, residencies, domain events, publication readiness, and the Mei Xiang family golden dataset.

Glossary: [`contracts/golden-dataset/CONTEXT.md`](contracts/golden-dataset/CONTEXT.md)

## Curation Intake

Owns source discovery and working records that have not yet become trusted archive conclusions. Intake data can be incomplete, contradictory, or awaiting review.

Working area: `data/curation/`

## Public Projection

Owns the reviewed, versioned, public-safe representation consumed by APIs, Worker/D1, downloadable snapshots, and browser experiences. It does not own professional or restricted truth.

Architecture decision: [`docs/architecture/adr-0001-single-source-api-boundary.md`](docs/architecture/adr-0001-single-source-api-boundary.md)

## Public Activity

Owns the rebuildable public-safe ActivityItem projection, source-event consumption receipts, stable Panda/institution targets, correction and retraction presentation state, editorial announcements, and the integration events consumed by Feed and Notification Orchestration. It does not own Archive facts, Follows, Feed eligibility, notification preferences, submissions, review state, or private evidence.

Architecture: [`docs/architecture/public-activity-projection.md`](docs/architecture/public-activity-projection.md)

## Relationships

- Curation Intake proposes evidence and candidate records to the Trusted Archive.
- The Trusted Archive decides which conclusions and dependencies are publishable.
- Public Projection derives only from published Trusted Archive state.
- Public Activity consumes explicit public-safe events from published Archive Releases or authorized editorial commands; projection failure never rolls back Archive publication.
- Feed and Notification Orchestration consume Public Activity events but retain ownership of Follow eligibility, account state, preferences, channels, and delivery.
- The golden dataset is the shared acceptance fixture spanning the archive and projection contexts; it is not a replacement for production data.
