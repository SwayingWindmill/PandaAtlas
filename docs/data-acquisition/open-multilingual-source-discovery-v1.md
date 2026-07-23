# Open multilingual source discovery and intake v1

Issue: #129

Schema version: `panda-atlas-discovery-intake/v1`

## Purpose

This module discovers panda source material beyond the existing registry and emits deterministic intake manifests. It is the discovery boundary for public search, permitted APIs, authorized accounts, manually approved providers, and user-supplied URL providers.

Discovery never writes trusted panda facts or public pages. It produces source evidence and intake candidates for later identity reconciliation and fact extraction.

## Public interfaces

- `run_discovery_providers`: execute all registered providers for one multilingual query set.
- `run_discovery`: normalize provider events, compare them with a prior inventory, and build the manifest.
- `write_discovery_artifacts`: write deterministic manifest and inventory files.
- `DiscoveryProviderRegistry`: bind provider IDs to reviewed implementations.

Runtime modules live in `services/api/app/acquisition/discovery/`.

## Query and provider model

Each `DiscoveryQuery` records:

- a stable query ID;
- query text and language;
- provider ID;
- access basis;
- an internal access reference when the provider is not public.

Supported access bases are public, licensed API, authorized account, and manual permission. Access references are used only to select configured credentials or permissions. They are never copied into discovery manifests or inventories.

Provider implementations return ordered material or stop events. The executor rejects events that change the query ID or reviewed access basis.

## Multilingual coverage

The contract does not contain a fixed language allowlist. Chinese, English, Japanese, and Korean are first-class acceptance languages, while institution-local and additional languages use the same interface. The manifest records all query languages and each source material language.

## Source classification and trust

Every material item retains:

- the stable query IDs that discovered it;
- canonical and observed URLs;
- title and publisher;
- source kind;
- source language;
- first-hand status;
- access basis;
- publication and collection dates;
- content type and byte count;
- content SHA-256;
- optional snapshot or payload reference.

A host match records the existing reviewed source ID but does not itself raise source confidence. Known matches remain low and use the `known-source-registry-match-unscored` rationale until a separate source-quality assessment is applied. Unfamiliar hosts also remain discoverable at low confidence with the `unreviewed-source-default` rationale. Discovery never treats access approval or host recognition as factual authority.

## URL and content deduplication

URLs must use HTTPS. The canonicalizer:

- lowercases the host;
- removes fragments;
- removes default HTTPS ports;
- removes trailing path slashes;
- removes common tracking parameters;
- sorts retained query parameters.

Multiple observed URLs for the same canonical URL become one entry. Separate URLs with the same content SHA-256 share a content group; only the first deterministic representative emits an intake candidate.

## Incremental state

A prior `DiscoveryInventory` enables four change states:

- `new`: URL not present in the prior inventory;
- `changed`: same canonical URL with a different content hash;
- `removed`: prior material absent from a completed run;
- `unchanged`: same canonical URL and content hash.

Only new or changed content representatives emit intake candidates. Repeating the same complete run therefore emits no new candidates.

Removal is scoped to the stable query IDs that previously discovered each item. A partial run preserves material from queries that were not executed. A stopped query cannot prove absence, so unseen material associated with that query is carried forward in the inventory rather than marked removed.

## Stop boundaries

The following states terminate a query explicitly:

- CAPTCHA or human challenge;
- authorization mismatch;
- paywall;
- access-control boundary;
- policy mismatch;
- HTTP 403, 429, or 451;
- unexpected blocking.

A query cannot emit events after its stop event. The manifest state becomes `stopped`, and the URL, access basis, collection time, policy state, HTTP status, and explanation are retained. Stop events are data, not retry hints, and cannot be silently converted into successful material.

## Artifacts

`write_discovery_artifacts` writes:

- `panda-discovery-manifest.v1.json`;
- `panda-discovery-inventory.v1.json`.

The writer uses canonical JSON, writes atomically, and is idempotent when existing content is identical. Different existing content requires explicit overwrite.

The checked-in contract and fixtures are:

- `contracts/panda-discovery-intake.v1.json`;
- `contracts/panda-discovery-intake-fixtures/v1/completed.valid.json`;
- `contracts/panda-discovery-intake-fixtures/v1/incremental.valid.json`;
- `contracts/panda-discovery-intake-fixtures/v1/stopped.valid.json`.

Regenerate them from `services/api`:

```bash
uv run python scripts/generate_discovery_intake_contract.py
```

## Verification

```bash
uv run pytest -q tests/acquisition/test_multilingual_discovery.py tests/acquisition/test_discovery_schema_fixtures.py
uv run ruff check app/acquisition/discovery tests/acquisition/test_multilingual_discovery.py tests/acquisition/test_discovery_schema_fixtures.py scripts/generate_discovery_intake_contract.py
uv run python -m compileall -q app/acquisition/discovery
```
