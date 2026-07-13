# Trusted Archive Glossary

## Golden Dataset

A small, versioned set of trusted archive records used as the shared acceptance truth across domain, API, projection, snapshot, browser, and manual testing. It represents deliberately chosen scenarios rather than the full panda catalog.

## Core Panda

One of the seven public Beta family identities: Mei Xiang, Tian Tian, Tai Shan, Bao Bao, Bei Bei, Xiao Qi Ji, or Bao Li. Core pandas count toward the golden dataset's required family scope.

## Dependency Stub

A stable identity referenced by a core record but not included in the seven-panda scope. A dependency stub prevents name-based references while making its intentionally incomplete status explicit.

## Stable Identity

An identity whose identifier does not change when names, spellings, slugs, locations, or publication state change.

## Public Fields

Fields approved for public projection. Public fields may appear in APIs, D1, snapshots, and browser fixtures when their record is published.

## Restricted Fields

Professional or internal fields that must never enter public projection, including curator notes, internal completeness scores, review ownership, and unreviewed translation drafts.

## Source

A registered evidence record that identifies a publisher, title, URL, publication date, verification date, language, and access state.

## Fact Assertion

A source-backed statement about one field of one subject. Multiple assertions may coexist when evidence is tentative or conflicting.

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
