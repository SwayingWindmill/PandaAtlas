# Trusted Archive Glossary

## Golden Dataset

A small, versioned set of trusted archive records used as the shared acceptance truth across domain, API, projection, snapshot, browser, and manual testing. It represents deliberately chosen scenarios rather than the full panda catalog.

## Core Panda

One of the seven public Beta family identities: Mei Xiang, Tian Tian, Tai Shan, Bao Bao, Bei Bei, Xiao Qi Ji, or Bao Li. Core pandas count toward the golden dataset's required family scope.

## Dependency Stub

A stable identity referenced by a core record but not included in the seven-panda scope. A dependency stub prevents name-based references while making its intentionally incomplete status explicit.

## Stable Identity

An identity whose identifier does not change when names, spellings, slugs, locations, or publication state change.

## Structured Name

A language-tagged name record with a name kind, primary marker, optional validity period, and one or more source links. Official names, romanizations, pinyin, historical spellings, and informal aliases are distinct structured records rather than columns on the identity.

## Legacy Slug

A historical public URL key that resolves permanently to the canonical slug of the same stable identity. A legacy slug is not a second identity and cannot become canonical for another panda.

## External Identifier

A source-linked identity key assigned by an institution, studbook, or external catalog. Its system and value pair is unique and may be used for search and deduplication.

## Public Fields

Fields approved for public projection. Public fields may appear in APIs, D1, snapshots, and browser fixtures when their record is published.

## Restricted Fields

Professional or internal fields that must never enter public projection, including curator notes, internal completeness scores, review ownership, and unreviewed translation drafts.

## Source

A registered evidence record that identifies a publisher, title, URL, publication date, verification date, language, and access state.

## Fact Assertion

A source-backed statement about one field of one subject. Multiple assertions may coexist when evidence is tentative or conflicting. Assertions are retained as history and are never overwritten by a newer conclusion.

## Public Conclusion

A versioned, publishable interpretation derived from one or more fact assertions. It carries the assertion IDs, public source IDs, and last verification date while excluding restricted evidence content.

## Conclusion Status

The public interpretation state of a conclusion:

- `confirmed`: one publishable value is supported as the current conclusion.
- `provisional`: one publishable value is shown with explicit uncertainty.
- `disputed`: multiple incompatible publishable values remain unresolved.
- `superseded`: an older conclusion is retained as history but is no longer current.

## Parentage Assertion

A source-backed claim that one panda is a parent of another, with an explicit role and conclusion status. Public lineage derives from assertions rather than from editable father or mother fields.

## Residency

A time-bounded statement that a panda lived at a facility or at a deliberately coarse location. Primary residency intervals for one panda must not overlap.

## Current Place

The latest effective primary residency. An announced transfer does not change current place until a completed event or effective residency exists.

## Domain Event

A real-world occurrence such as a transfer. One event may have multiple panda participants and has a status such as announced or completed.

## Publication Status

The readiness of a record for projection: `published`, `draft`, or `restricted`. A published record cannot depend on an unpublished object.

## Fixture Consumer

One of the test layers that reads the golden dataset: domain, API, projection, snapshot, or browser. Consumers may adapt the fixture shape, but they must not maintain separate business truth.
