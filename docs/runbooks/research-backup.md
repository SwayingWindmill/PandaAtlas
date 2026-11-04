# Research vault backup

`data/local-panda-research/` is gitignored and lives on one machine. It is backed up to the private R2 bucket `pandaatlas-research-backup` with [rclone](https://rclone.org/s3/#cloudflare-r2):

- `current/` mirrors the vault.
- `history/<UTC timestamp>/` keeps every file a later backup replaced or deleted, so nothing is lost by syncing a mistake.
- `production-releases/<version>/` holds the exported public data of each published release ([how](production-release.md#back-up-the-published-data)).
- `SHA256SUMS` at the vault root lists the SHA-256 of every file. It travels with the backup, and a restore is checked against it.

The bucket has no public access and is separate from the media bucket the Worker serves. Its token can read and write that bucket only.

## Set up a machine

Run `bash scripts/development/research-backup-wizard.sh` from the repository root in Git Bash. It installs nothing itself: it asks for rclone, walks through creating the bucket and a token scoped to it, saves the `r2` remote in rclone's own config (outside the repository), and runs the first backup.

When the Cloudflare CLI (`cf`) is logged in and the bucket exists, `node scripts/development/r2-backup-remote.mjs` replaces the dashboard token steps: it creates the bucket-scoped token, saves the `r2` remote and prints no key. Run it yourself (`--dry-run` first), then back up as below.

## Back up

From the repository root:

```bash
rclone hashsum sha256 data/local-panda-research --exclude SHA256SUMS --output-file data/local-panda-research/SHA256SUMS
rclone sync data/local-panda-research r2:pandaatlas-research-backup/current --checksum --transfers 16 --backup-dir "r2:pandaatlas-research-backup/history/$(date -u +%Y%m%dT%H%M%SZ)"
rclone check data/local-panda-research r2:pandaatlas-research-backup/current --one-way
```

Back up after each research pass. `rclone check` reporting `0 differences found` is the done condition.

## Restore

```bash
rclone copy r2:pandaatlas-research-backup/current data/local-panda-research --transfers 16
rclone checksum sha256 data/local-panda-research/SHA256SUMS data/local-panda-research
```

The second command must report no differences. To recover an older copy of a file, list `r2:pandaatlas-research-backup/history/` and copy it from the newest timestamp before the change.
