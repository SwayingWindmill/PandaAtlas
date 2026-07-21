# Frontend Staging withdrawal and rollback

This runbook produces real workers.dev-only evidence for a build-time Public Release withdrawal. It does not convert the frontend into a client-side D1 application and does not use mock API responses.

## Open-source decision

The implementation reuses the existing Cloudflare Workers SDK/Wrangler and Playwright dependencies.

- A Worker Version captures code, static assets, bindings, and compatibility settings. A deployment activates a version.
- `wrangler rollback <version-id>` creates a deployment that restores the selected version at 100% traffic.
- Playwright trace captures DOM snapshots, screenshots, console output, and network requests.
- Preview URLs do not prove the active Staging deployment.
- Gradual deployments are not used because HTML and content-hashed assets may be served by different versions during a split.
- Generic retry packages are not added. Browser verification may retry before any state-changing withdrawal action because it is read-only and deployment propagation is eventual.

## Isolated configuration

Both tracked configs target the same Staging Worker and declare no custom routes:

- `apps/web/wrangler.staging.jsonc` — baseline, no withdrawal activation;
- `apps/web/wrangler.staging.withdrawn.jsonc` — activates the reviewed withdrawal ID.

Both must retain:

- Worker name `panda-atlas-web-staging`;
- `workers_dev: true`;
- `routes: []`;
- the same OpenNext entry point and static asset binding.

Production Worker names and routes are rejected before build or deployment.

## Reviewed withdrawal artifact

`data/frontend-withdrawals/2026.07.20.2-ri-ri.json` is bound to:

- Public Release `2026.07.20.2`;
- Public Schema `1.2.0`;
- database migration `0007`;
- the exact SHA-256 of the tracked Public Release manifest;
- Ri Ri's stable panda ID;
- the complete set of Ri Ri media record IDs.

The artifact rejects slugs, unknown IDs, duplicate IDs, unapproved state, release drift, manifest hash drift, and incomplete media ownership.

The original immutable Public Release remains untouched and continues to retain media rights, credit, source URL, alt text, dimensions, bytes, and SHA-256 for audit purposes.

## Commands

Dry-run plan:

```bash
npm run staging:web:plan
```

Real Staging drill:

```bash
npm run staging:web:full
```

The full command launches three independent, recoverable stage processes. The same stages may be run explicitly when a local build, browser runtime, or Cloudflare transport interruption requires a safe resume:

```bash
npm run staging:web:baseline
npm run staging:web:withdrawn
npm run staging:web:rollback
```

Each stage requires the tracked workspace to be clean and explicit write authorization. Baseline creates a SHA-bound state file; withdrawn and rollback refuse state from another commit, artifact, or configuration. Deployment identity is persisted immediately after activation, before browser evidence, so the exact baseline Version remains available for recovery even when a later assertion fails.

The full command performs:

1. Production Ri Ri read-only canary.
2. Baseline OpenNext build and workers.dev deployment.
3. Baseline zh/en, JavaScript, no-JavaScript, keyboard, 320 px, screenshot, trace, and network evidence.
4. Withdrawn OpenNext build and workers.dev deployment.
5. Ri Ri 404, discovery removal, no Ri Ri media request, and unrelated Shin Shin 200 evidence.
6. `wrangler rollback` to the exact baseline Worker Version ID.
7. Restored baseline browser evidence.
8. Production read-only canary comparison.

The final active Staging state is the restored baseline.

## Evidence

Reports are written under `.release-gate/frontend-staging-withdrawal/` and include:

- commit SHA;
- withdrawal and Public Release manifest hashes;
- baseline and withdrawn Wrangler config hashes;
- OpenNext build tree hashes and file counts;
- baseline and withdrawn Worker Version IDs;
- browser status, trace, screenshots, network URLs, no-JavaScript, keyboard, and 320 px results;
- rollback target Version ID;
- Production before/after canaries.

## Failure policy

Stop and retain the failed report when:

- either Staging config gains a Production name or route;
- withdrawal identity, release, schema, migration, manifest hash, panda ID, or media ownership drifts;
- baseline does not expose Ri Ri and reviewed media;
- withdrawn pages expose Ri Ri, a Ri Ri discovery link, or any Ri Ri media request;
- Shin Shin or another unrelated profile becomes unavailable;
- no-JavaScript, keyboard, or 320 px checks fail;
- Worker URL or Version ID cannot be parsed;
- rollback does not restore the exact baseline behavior;
- Production Ri Ri content disappears during the drill.

Do not switch the drill to Production, weaken status assertions, edit immutable release files, or replace the workers.dev browser evidence with a local mock.
