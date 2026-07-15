# Immutable release recovery drill

The recovery drill proves that PandaAtlas can switch, roll back, withdraw, and rebuild an immutable D1 public release without rewriting historical release records.

Run it from a clean checkout:

```powershell
npm run drill:release-recovery
```

The default Release Gate runs the same drill after the locked FastAPI environment and Beta hard-gate preflight pass.

## Drill sequence

The drill creates a temporary SQLite database from the production D1 versioned-release migration. It verifies and loads the checked-in `2026.07.14.3` D1 artifact against its manifest, then builds a deterministic `2026.07.14.4` candidate from the reviewed golden dataset and performs these checks:

1. Apply the first release and confirm its pointer is active.
2. Insert the complete second release and switch its pointer inside a transaction, inject a late failure, then confirm neither the pointer nor partial candidate history changes.
3. Apply the second release successfully and retain both immutable versions.
4. Roll the singleton pointer back to the first version.
5. Append one entity withdrawal and confirm only that current record disappears.
6. Append a whole-release withdrawal and confirm public reads fail closed while both releases remain stored.
7. Purge a temporary release-keyed filesystem cache and prove no stale entries remain.
8. Attempt to mutate release records and withdrawal events and confirm the database rejects both changes.
9. Rebuild a clean D1 database by replaying every immutable-release, pointer-switch, and withdrawal operation from the ordered drill journal, then compare the complete logical state checksum.

All databases and cache entries used by the clean-checkout drill are temporary and deleted after the report is written.

## Evidence report

The drill writes:

```text
.release-gate/recovery-drill.json
```

The report records the two release versions, the checked manifest checksum, the late-failure stage, every check status, immutable and append-only history checksums, the ordered operation journal and its checksum, operational and rebuilt state checksums, the withdrawn entity, cache entry counts, measured cache-purge and D1-rebuild durations, and recovery-point loss. A passing deterministic rebuild reports equal journal/replay counts and zero lost operations.

Any failed invariant exits non-zero and fails the default Release Gate. CI uploads the report with the other `.release-gate/` evidence.

## Cache and staging boundary

The clean-checkout cache step is deliberately identified as `local-filesystem-surrogate`. It proves that the release procedure invokes a purge and verifies stale versioned entries are gone without requiring production credentials.

It does **not** claim that a deployed Cloudflare or other provider cache was purged. The final staging exercise must name the selected cache provider, run its authenticated purge against the approved non-production zone, verify old release responses are no longer served, and attach that provider evidence to the launch decision.

Likewise, this drill proves deterministic D1 reconstruction in a temporary database. A dated remote D1 rebuild against approved staging infrastructure remains part of the final environment exercise.
