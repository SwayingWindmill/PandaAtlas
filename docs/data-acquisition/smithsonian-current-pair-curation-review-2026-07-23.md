# Smithsonian current-pair curation review and CSV application — 2026-07-23

Issue: #131

## Status

The Bao Li and Qing Bao Smithsonian live cohort has completed source verification, curator authorization, guarded curation-patch export, and a zero-write CSV application dry-run.

The accepted facts have **not** been committed to `data/curation/pandas/*.csv`. Trusted-data import, public projection, release-gate publication, and media publication also remain unperformed.

## Review plan artifact

The live cohort produced this local review-only artifact:

- path: `.acquisition/review-plans/issue-131-smithsonian-current-pair-review-plan-2026-07-23.json`
- schema: `panda-atlas-smithsonian-curation-review/v1`
- plan ID: `smithsonian-curation-review-41c822cb856ec49fb65b066226f1a2b41a9059ff57f8a298b873d521f84a27c0`
- created at: `2026-07-23T08:28:32.662564Z`
- file bytes: `24626`
- file SHA-256: `de0449b5d00e1e660d5e2265a3890f312d73eb227ad3e0b8664ddf26fef7b0cd`

The 74 live acquisition candidates were partitioned as follows:

| Disposition | Count | Meaning |
| --- | ---: | --- |
| `propose-accept` | 16 | Evidence-backed fact assertions eligible for explicit curator acceptance, rejection, or deferral |
| `required-defer` | 6 | Four name-only parent relationships and two source omissions that cannot become trusted facts |
| `supporting-evidence-only` | 6 | Official-name candidates used for identity resolution but not standalone curation mutations |
| out of scope | 46 | Smithsonian candidates for pandas outside the Bao Li and Qing Bao cohort |

The 16 accepted assertions support 12 field conclusions:

- Bao Li: birth date, birthplace, arrival, public debut, sex, and current residence;
- Qing Bao: birth date, birthplace, arrival, public debut, sex, and current residence.

Birth-date and sex conclusions each retain two official-page assertions for corroboration, which is why there are 16 assertions but 12 conclusions.

## Curator decision log

The project owner explicitly authorized the proposed disposition in the 2026-07-23 project conversation.

- path: `.acquisition/decisions/issue-131-smithsonian-current-pair-decisions-2026-07-23.json`
- decision log ID: `decision-log-bb5d25acf0b0b0336499a2bfa57abe910c9c0ba1c784ab5b3f449cd1731f7eb9`
- reviewer identity: `project-owner-chat-authorization`
- accepted decisions: `16`
- deferred decisions: `6`
- rejected decisions: `0`

All four name-only parent statements and both absent life-status values remain explicitly deferred.

## Curation patch

The guarded exporter produced:

- path: `.acquisition/curation-patches/issue-131-smithsonian-current-pair-curation-patch-2026-07-23.json`
- patch ID: `curation-patch-2792fa5b4c95704a0ec7aac41c7f59575392fdc8997263f2371bcfaa23b1da3b`
- panda field proposals: `10`
- event proposals: `4`
- residency proposals: `2`
- relationship proposals: `0`
- source evidence snapshots: `3`

`export_smithsonian_current_pair_curation_patch` refuses export unless:

1. all 16 proposed fact candidates have explicit curator decisions;
2. all six required-defer candidates remain explicitly deferred;
3. no deferred, supporting-evidence-only, or out-of-scope candidate is accepted;
4. the decision log references the exact acquisition bundle and evidence snapshots;
5. accepted candidates retain clear HTTP 200 evidence with matching body hashes;
6. the source review remains valid;
7. at least one verified fact is accepted.

The patch itself remains review-only and exposes no curation, trusted, or publication write targets.

## Transactional CSV application boundary

`app.enrichment.apply_smithsonian_current_pair_curation_patch_to_csv` now provides the repository curation-intake application seam.

The application boundary:

- defaults to dry-run;
- requires an aware application timestamp and a non-expired source review;
- requires the exact 10 panda, 4 event, and 2 residency proposal shape;
- requires exactly Bao Li and Qing Bao and the three reviewed Smithsonian URLs;
- maps evidence URLs back to existing `sources.csv` source IDs;
- checks acquisition-time prior trusted values before changing panda fields or event collections;
- refuses concurrent panda-field or event changes;
- merges duplicate official assertions without duplicating facts;
- creates stable event IDs for arrival and public debut;
- promotes affected panda and event rows only to `reviewed`, never directly to `approved`;
- updates source access dates from the live evidence captures;
- copies the complete curation directory to a sibling staging directory;
- runs the existing repository curation validator against the staged directory;
- checks the live CSV hashes again before commit;
- uses a directory swap with rollback if the staged replacement fails;
- is idempotent when the same patch has already been applied.

The CLI rebuilds the patch from the live bundle and decision log and requires the expected patch ID before invoking the application seam:

```bash
uv run python scripts/apply_smithsonian_current_pair_curation_patch.py \
  --live-bundle issue-131-smithsonian-live-replay-2026-07-23.json \
  --decisions issue-131-smithsonian-current-pair-decisions-2026-07-23.json \
  --expected-patch-id curation-patch-2792fa5b4c95704a0ec7aac41c7f59575392fdc8997263f2371bcfaa23b1da3b
```

The command remains zero-write unless `--apply` is supplied explicitly.

## Real dry-run result

The real live patch was executed without `--apply`.

Report artifact:

- path: `.acquisition/application-reports/issue-131-smithsonian-current-pair-curation-dry-run-2026-07-23.json`
- outcome: `dry-run`
- file bytes: `1893`
- file SHA-256: `4cf04ca878577eb201afbf400d9a891668a42c11f8091cef731b310f0dc1622f`
- patch ID: `curation-patch-2792fa5b4c95704a0ec7aac41c7f59575392fdc8997263f2371bcfaa23b1da3b`

The staged result would:

- update 2 panda rows;
- insert 4 events;
- refresh 3 source rows;
- change `pandas.csv`, `events.csv`, and `sources.csv`;
- leave `media.csv`, `sightings.csv`, and `source-expansion-backlog.csv` unchanged.

Staged validator result:

- sources: `352`;
- pandas: `809`;
- events: `260`;
- media: `8`;
- validation errors: `0`.

The current committed curation directory still contains `256` events. Its live CSV hashes exactly match the dry-run report's `before_sha256`, confirming that the dry-run did not modify formal curation data.

## Publication blockers

Both target pandas still fail the public-ready requirements:

| Panda | Approved verified events | Required | Approved photos | Required |
| --- | ---: | ---: | ---: | ---: |
| Bao Li | 0 | 3 | 0 | 1 |
| Qing Bao | 0 | 3 | 0 | 1 |

The patch application intentionally creates the arrival and public-debut events as `reviewed`, not `approved`. Existing birth events also remain `draft`. No media row is invented, downloaded, licensed, or approved by this work.

## Tests and verification

Focused application tests cover:

- zero-write dry-run behavior;
- successful validated commit in an isolated curation directory;
- panda-field prior-value conflicts;
- event-collection prior-value conflicts;
- staged validator failure with no commit;
- idempotent repeat application;
- stable event IDs and reviewed-only status;
- unchanged formal curation CSVs during real dry-run.

Final verification:

- Ruff format check: `20 files already formatted`;
- Ruff check: passed;
- compileall: passed;
- current curation validator: `352 sources, 809 panda rows, 256 event rows, 8 media rows validated`;
- enrichment tests: `43 passed`;
- full API tests: `263 passed, 13 skipped`.

## Remaining publication steps

1. Explicitly run the same CLI with `--apply` to commit the validated curation-intake changes.
2. Review and approve the three verified events per panda: birth, arrival, and public debut.
3. Add at least one rights-cleared, bilingual, approved media record per panda.
4. Promote the panda rows to `approved` only after the validator's event and media gates pass.
5. Run trusted-data import, public projection, release gate, and publication as separate audited stages.
