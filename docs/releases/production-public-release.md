# Production Public Release

`npm run release:production` is the guarded route from an immutable Public Release artifact to the production Panda Atlas site.

## Dry run

```bash
npm run release:production -- --release 2026.07.24.2
```

The dry run performs no production writes. It validates:

- the tracked Public Release manifest and file hashes;
- the API panda count and Web fallback release binding;
- every public media filename against the Worker route contract;
- release-specific local derivative byte sizes and SHA-256 values;
- every inherited and release-specific R2 object through authenticated reads;
- every public media URL through `api.zhipanda.com`;
- D1 activation preflight when the requested release is not already current.

`--skip-gate` is available only for local dry-run iteration. Production execution rejects it.

## Execute

```bash
npm run release:production -- --release 2026.07.24.2 --execute
```

Execution requires:

- branch `master`;
- `HEAD` equal to `origin/master`;
- no tracked working-tree changes;
- a complete private collection Release Gate pass.

The write sequence is deliberately ordered:

1. Validate immutable artifacts and the Web fallback version.
2. Run the complete Release Gate.
3. Run D1 read-only preflight.
4. Upload only the reviewed derivatives owned by the requested release.
5. Download and hash every media object from remote R2.
6. Deploy the API Worker.
7. Fetch every media URL through the production Worker and verify HTTP status, MIME type, bytes, and SHA-256.
8. Activate D1 only after media delivery is proven.
9. Compare every production API panda payload with the immutable `api.json` record.
10. Deploy the Web Worker.
11. Fetch every Chinese profile with a cache-isolated query and verify the active release and identity.
12. Repeat public media integrity checks after Web deployment.

If a failure occurs after D1 activation, the command attempts an automatic pointer rollback to the release captured by preflight. API deployment happens before pointer activation and is required to remain backward compatible with the current release.

Reports are written under `.release-gate/production-release-<version>.json`.

## Rollback drill

```bash
npm run release:production -- \
  --release 2026.07.24.2 \
  --rollback-target 2026.07.24.1 \
  --drill \
  --execute
```

The drill:

1. Compares every source-release API profile with its immutable artifact.
2. Verifies every source-release public media object.
3. Runs rollback preflight.
4. Switches the D1 pointer to the retained target release.
5. Compares every target API profile with the target artifact.
6. Verifies target media and all target profile pages.
7. Runs restore preflight.
8. Switches the pointer back to the source release.
9. Repeats API, media, and Web verification for the restored release.

If verification fails while the target release is active, the drill attempts an emergency pointer restore to the source release.

Reports are written under `.release-gate/production-release-drill-<source>-to-<target>.json`.
