# Bilingual panda normalized values and summary generation v1

Issue: #131

Schema version: `panda-atlas-bilingual-summary/v1`

## Purpose

This module converts one immutable `FactEnrichmentBatch` into synchronized Chinese and English normalized values and sentence-level summary text. Every generated value and sentence retains its exact assertion basis and is projected into the existing #128 `TranslationValue` contract.

The generator is deterministic. It is not a general-purpose language model boundary and does not invent facts, translate unsupported free text, resolve conflicts, or select a value independently of the fact conclusions produced by the preceding enrichment stage.

Runtime modules live in `services/api/app/enrichment/`:

- `bilingual_summary.py` contains the deterministic value and sentence templates;
- `summary_contracts.py` defines immutable generated values, sentences, and the enclosing batch.

## Pipeline position

```text
source-specific parser
  -> identity extraction
  -> #130 identity resolution
  -> fact and relationship enrichment
  -> FactEnrichmentBatch
  -> build_bilingual_summary_batch
  -> bilingual values and traceable sentences
  -> PandaKnowledgeBundle with generated TranslationValue records
```

The summary batch has empty trusted and publication write targets. Immutable publication remains owned by the later publication stage.

## Complete input retention

`BilingualSummaryBatch` embeds the complete `FactEnrichmentBatch`, not only its batch ID or knowledge bundle ID. This permits an artifact loaded from JSON to revalidate:

- the source-local extracted facts;
- assertion confidence and lifecycle;
- selected field conclusions;
- the exact generated Chinese and English values;
- the exact generated sentences;
- generated translation projections;
- all content-derived IDs.

The output knowledge bundle may differ from the input knowledge bundle only in `created_at`, `bundle_id`, and record translations. Identity, assertions, conclusions, relationships, media, locations, and contributions cannot drift during summary generation.

## Eligible assertions

A fact may produce bilingual output only when it is:

- active;
- high or medium confidence;
- public scope.

Low-confidence, review-only, restricted, withdrawn, and superseded assertions never enter generated values or sentences.

Generated normalized values are assertion-level. Therefore multiple publishable assertions supporting different values may each retain a bilingual normalized representation.

Generated summary sentences are conclusion-level. A sentence is emitted only for a `confirmed` or `tentative` conclusion with a supported primary assertion. `disputed`, `unknown`, and `superseded` conclusions do not produce a single-value sentence.

## Supported normalized values

Version 1 provides deterministic templates for:

| Field path | Normalized input | Chinese and English output |
| --- | --- | --- |
| `birth.date` | ISO date | Localized full date |
| `death.date` | ISO date | Localized full date |
| `birth.year` | Four-digit year | Localized year |
| `identity.sex` | Reviewed enum | Reviewed fixed vocabulary |
| `status.current` | Reviewed enum | Reviewed fixed vocabulary |
| `residence.current` | Explicit `{zh, en}` object | Supplied reviewed pair |
| `death.cause` | Explicit `{zh, en}` object | Supplied reviewed pair |

Unsupported fields are retained in the fact enrichment batch but are not freely paraphrased. Free-text residence and death-cause values must first be converted by a reviewed parser or translation workflow into an explicit Chinese and English pair.

## Sentence templates

Supported sentence labels are fixed for:

- birth date;
- birth year;
- sex;
- current status;
- current residence;
- death date;
- death cause.

A confirmed direct assertion uses an unqualified label:

```text
出生日期：2020年7月4日。
Birth date: July 4, 2020.
```

A tentative direct assertion uses an explicit reporting qualifier:

```text
据报道，出生年份：2020年。
Reported birth year: 2020.
```

An inferred assertion uses an explicit inference qualifier. Generated text never hides whether its selected fact was direct or derived.

## Sentence-level traceability

Every `BilingualSummarySentence` contains:

- resolved record ID;
- stable sentence key;
- fact field path;
- sorted assertion IDs used by the sentence;
- source language;
- synchronized Chinese and English text;
- fact enrichment batch ID;
- generator version.

The sentence ID is derived from all of this content. A change to confidence, conclusion status, generator version, assertion basis, or generated text creates a different sentence ID.

## Translation projection

Each normalized value creates two generated `TranslationValue` records:

- locale `zh`;
- locale `en`.

Each sentence also creates one translation record per locale. Generated translations retain:

- assertion basis;
- generator version;
- generation time;
- source language;
- stable subject type and subject ID.

The knowledge contract independently validates that generated translations use active, non-low-confidence assertions.

## Regeneration semantics

Fact assertion IDs describe source-local evidence identity and can remain stable when a reviewer changes confidence. The enclosing `FactEnrichmentBatch` ID includes the full reviewed fact state. Summary value IDs, sentence IDs, translation IDs, output bundle ID, and summary batch ID all depend on that fact enrichment batch.

Consequently a confidence change from high to medium regenerates the summary even when the underlying fact ID remains stable. The text also changes from an unqualified statement to a reported statement.

Version 1 produces a new immutable summary batch. Marking translations from a previously published summary batch as `outdated` and linking replacement translation IDs remains a publication-history concern for a later integration slice.

## Semantic revalidation

On JSON reload, `BilingualSummaryBatch` calls the deterministic content generator again using the embedded `FactEnrichmentBatch` and generator version. The stored normalized values and sentences must exactly equal the recomputed result.

This prevents an artifact producer from changing text and merely recalculating hashes. The validator also regenerates the expected `TranslationValue` records and verifies that the output knowledge bundle contains exactly those translations in addition to any translations already present in the input bundle.

## Determinism and integrity

Input record and assertion ordering does not affect generated ordering. The following are content-derived and revalidated:

- normalized value IDs;
- summary sentence IDs;
- generated translation IDs;
- output knowledge bundle ID;
- bilingual summary batch ID.

Changing facts, confidence, lifecycle, conclusions, text, assertion basis, generator version, generation time, or translations while retaining an old ID causes validation failure.

## Contract and fixtures

Checked-in files:

- `contracts/panda-bilingual-summary.v1.json`;
- `contracts/panda-bilingual-summary-fixtures/v1/confirmed-birth.valid.json`;
- `contracts/panda-bilingual-summary-fixtures/v1/tentative-birth.valid.json`;
- `contracts/panda-bilingual-summary-fixtures/v1/disputed-birth.valid.json`.

The fixtures prove:

- confirmed facts generate unqualified synchronized sentences;
- tentative facts generate explicitly reported sentences;
- disputed facts retain bilingual values but generate no single-value summary sentence;
- complete fact enrichment input survives JSON round-trip validation.

Regenerate from `services/api`:

```bash
uv run python scripts/generate_bilingual_summary_contract.py
```

Targeted verification:

```bash
uv run pytest -q tests/enrichment
uv run ruff check app/enrichment tests/enrichment scripts/generate_identity_extraction_contract.py scripts/generate_fact_enrichment_contract.py scripts/generate_bilingual_summary_contract.py
uv run python -m compileall -q app/enrichment
```

## Deferred integration work

The Smithsonian current-pair path has now passed a bounded live replay through bilingual generation. Remaining work includes:

- additional source-specific production parsers;
- a second institutional discovery-to-enrichment cohort targeting `needs_primary_source` records;
- replacement links that mark translations from an older published summary batch `outdated`;
- additional reviewed templates for extensible health, behavior, award, and event fields.

Those additions must preserve the same identity, confidence, conflict, evidence, and semantic-revalidation boundaries.
