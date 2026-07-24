# Dual media library — 2026-07-24

## Purpose

This is the first delivery slice for Issue #132. It establishes a deterministic boundary between:

- internal discovery and review candidates;
- media allowed in the owner's private collection;
- media allowed in an open/public library.

This slice does not discover new images and does not change the active Public Release. It projects the 14 currently reviewed curation media rows into an auditable library model and produces a discovery backlog for all 813 curation pandas.

## Inputs

- Public Release `2026.07.24.2`
- `data/curation/pandas/media.csv`
- `data/curation/pandas/pandas.csv`
- `data/media-library/selection-overrides.json`

Every generated file is bound to the SHA-256 of these inputs.

## Candidate model

Each internal candidate retains:

- stable candidate ID;
- panda slug;
- asset and source URL;
- credit and rights label;
- separate rights state and rights confidence;
- separate panda identity confidence and basis;
- processed delivery URLs, dimensions, bytes, and SHA-256 values;
- exact-duplicate group derived from the selected delivery SHA-256;
- review state, withdrawal state, alt text, and curator notes;
- eligibility reasons and deterministic score for each publication scope.

Identity and rights are intentionally independent dimensions. An openly licensed image with uncertain identity cannot enter the open library.

## Scope policies

### Private collection

Eligible candidates must:

- have a processed delivery object;
- be `approved` or `collection_only`;
- have a known rights state;
- have identity confidence of at least 0.50;
- not be withdrawn.

Restricted, all-rights-reserved images may remain available in this owner-only scope when reviewed.

### Public open library

Eligible candidates must additionally:

- be `approved` rather than `collection_only`;
- have an open license, public-domain status, or explicit authorization;
- have identity confidence of at least 0.85;
- have rights confidence of at least 0.90.

Administrator selection overrides cannot bypass these eligibility rules.

## Current result

| Metric | Count |
| --- | ---: |
| Curation pandas | 813 |
| Pandas with media candidates | 14 |
| Pandas needing discovery | 799 |
| Internal candidates | 14 |
| Private-collection main images | 14 |
| Open/public main images | 9 |
| Restricted-rights candidates | 4 |
| Low-identity-confidence candidates | 3 |

The open/public library currently selects:

- Bao Li
- Lei Lei
- Lun Lun
- Ri Ri
- Shin Shin
- Xi Lun
- Xiao Xiao
- Ya Lun
- Yang Yang

The following remain private-collection-only:

- Bao Xin: all rights reserved
- Zhen Xi: all rights reserved
- Qing Qing: cohort-only identity and all rights reserved
- Xiao Xin: cohort-only identity and all rights reserved
- Qing Bao: open license but probable individual identification and `collection_only` review state

## Deterministic selection

Main-image scoring is scope-specific and combines:

- panda identity confidence;
- rights confidence;
- processed image resolution/quality;
- a fixed recency component.

Ties are resolved by stable candidate ID. Exact duplicate delivery hashes are collapsed before gallery selection. Reviewed overrides may select an eligible candidate or withdraw a candidate; an override cannot force an ineligible item into the open library.

## Generated artifacts

`data/media-library/releases/2026.07.24.2/`

- `candidates.json`: internal discovery and review records
- `selections.json`: deterministic private/open main image and gallery choices
- `coverage.json`: all 813 pandas and their media discovery state
- `manifest.json`: input and output hashes

Manifest SHA-256:

`6b60571377c3feee8686dce4fa93fec861303a75b2866628027b9f9607518fac`

## Verification

- Ruff: passed
- dual-library contract tests: 7 passed
- deterministic `--check`: passed

## Deferred to later #132 slices

- broad Wikimedia and institutional image discovery;
- near-duplicate perceptual hashing;
- photographer and user submission intake;
- capture-date extraction;
- multiple-image galleries for pandas with more than one candidate;
- public withdrawal propagation into a new immutable Public Release.
