# Mei Xiang Family Golden Dataset

`mei-xiang-family.v1.json` is the canonical acceptance fixture for the first Panda Atlas trusted-archive slice. It is separate from `data/curation/`, which remains a broad working intake layer.

## Scope

The contract contains stable identities for:

1. Mei Xiang
2. Tian Tian
3. Tai Shan
4. Bao Bao
5. Bei Bei
6. Xiao Qi Ji
7. Bao Li

Mei Xiang and Tian Tian have complete first-pass fixture records. The other five records are published identity-first profiles with bilingual summaries, sourced key facts, current-place verification, reviewed relationships, explicit media states, and structured internal `missing_requirements` explaining why they remain below the complete-archive tier.

The fixture also covers registered sources, multilingual names, aliases, external identifiers, old slugs, source-backed facts, confirmed and tentative parentage, non-overlapping residencies, announced and completed multi-participant events, freshness policy, media-license states, approved bilingual content, and restricted draft content.

## Access boundary

Every domain record has:

- `public`: fields eligible for public projection when the record is published.
- `restricted`: curator, review, or unapproved fields that must never enter public projection.
- `publication_status`: `published`, `draft`, or `restricted`.

The loader's public projection flattens only `id + public` for published records.

## Windows commands

From the repository root:

```powershell
npm run check:golden-dataset
npm run test:golden-dataset
```

## Validation report codes

The validator returns stable diagnostics with `code`, `path`, and `message`. Required hard failures include:

- `missing_source`
- `invalid_reference`
- `overlapping_residency`
- `unpublished_dependency`

Additional structural errors cover duplicate IDs, missing public/restricted envelopes, invalid publication states, invalid dates, invalid core scope, and incomplete anchor records.

## Consumer adapters

- Node validation and public-experience generation: `scripts/golden-dataset/lib.mjs`
- Web browser fixtures: `apps/web/tests/fixtures/golden-dataset.ts`
- panda-data identity reconciliation: `tools/panda-data/src/panda_data/acquisition/reconciliation.py`

Every adapter reads the same JSON file. Derived fixtures may change shape for their test layer, but must not copy or re-author the underlying business truth.
