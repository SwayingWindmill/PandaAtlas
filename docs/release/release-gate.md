# Cross-platform release gate

The default release gate is the supported pre-release verification path for Panda Atlas. It runs Web, FastAPI, public-contract, Worker, and Beta hard-gate checks serially and writes machine-readable and human-readable reports.

## Supported toolchain

CI pins:

- Node.js 22
- npm 10.9.0
- Python 3.12
- uv 0.11.7

CI installs JavaScript dependencies with `npm ci`, creates a dedicated locked FastAPI environment from `services/api/uv.lock`, and installs the Playwright Chromium runtime. The release environment is `services/api/.venv-release`; it is deliberately separate from developer or WSL virtual environments.

## Windows-first local run

From a Windows `cmd.exe` or PowerShell prompt at the repository root:

```powershell
npm install
npm run release:default
```

On Windows the gate:

1. runs the Worker D1 schema and projection smoke;
2. records Worker HTTP smoke as `skipped`, because the required full Workerd HTTP execution runs in Linux CI;
3. uses Microsoft Edge automatically when it is installed and `PLAYWRIGHT_BROWSER_CHANNEL` is not set;
4. uses the production Next.js server created by `npm run build:web` rather than a development server.

To force the bundled Playwright Chromium runtime instead of Edge:

```powershell
$env:RELEASE_GATE_USE_SYSTEM_EDGE="0"
npm run release:default
```

If the selected browser is unavailable, the browser-runtime step is reported as `environment-blocked`; it is not reported as a test failure or a pass.

## Linux and CI behavior

The Linux CI job runs both Worker stages:

```text
Worker D1 projection smoke
Worker HTTP runtime smoke
```

The HTTP stage starts Wrangler/Workerd, checks health, panda reads, map completeness metadata, and confirms that Worker admin paths return `404`. A Linux job cannot pass while this HTTP stage is skipped.

The Windows CI job installs Chromium and runs the same default gate, with the Worker HTTP stage explicitly recorded as a platform skip. Both CI jobs upload `.release-gate/` as artifacts.

## Report format

The gate writes:

```text
.release-gate/default.json
.release-gate/default.md
.release-gate/beta-hard-gates.json
.release-gate/recovery-drill.json
```

Extended verification also writes `extended.json` and `extended.md`.

Every step has exactly one status:

- `passed`: the command completed successfully;
- `failed`: code, test, build, lint, or contract behavior failed;
- `skipped`: the step is intentionally not applicable or a required predecessor did not pass;
- `environment-blocked`: a required executable, browser, secret, or external runtime is unavailable.

A report with `failed` or `environment-blocked` steps exits non-zero. Intentional `skipped` steps remain visible but do not by themselves fail the platform-specific gate.

## Beta hard-gate preflight

The default gate runs `npm run check:beta-hard-gates` after the production Web build. The preflight fails closed when it detects:

- release-version drift, byte-count changes, or SHA-256 manifest corruption;
- forbidden private fields, personal email addresses, or precise wild-location geometry in public release artifacts;
- missing or unreviewed sources for confirmed parentage and current primary residencies;
- backend admin-token names or development token values in client source or built browser assets;
- a waiver for any hard gate, or an incomplete nonblocking waiver.

The checked-in policy is `contracts/beta-hard-gates.v1.json`; the waiver register is `data/beta-launch/waivers.json`. Nonblocking waivers must name the user impact, mitigation, owner, and deadline. Hard gates listed by the policy cannot be waived.

The standalone command writes `.release-gate/beta-hard-gates.json` and exits non-zero if any check fails:

```powershell
npm run check:beta-hard-gates
```

## Release recovery drill

After the locked FastAPI environment and Beta hard-gate preflight pass, the default gate exercises atomic release switching, prior-version rollback, entity and whole-release withdrawal, cache invalidation, immutable history, and deterministic D1 reconstruction. The drill exits non-zero on any invariant failure and writes `.release-gate/recovery-drill.json`.

Run it independently with:

```powershell
npm run drill:release-recovery
```

See [Immutable release recovery drill](recovery-drill.md) for the sequence, report fields, and the explicit boundary between clean-checkout cache/D1 evidence and a real staging-provider exercise.

## Clean-checkout reproduction

The CI workflow proves the clean-checkout path by:

1. using `actions/checkout` with cleaning enabled;
2. installing pinned tools;
3. running `npm ci` from the committed lockfile;
4. creating the dedicated frozen FastAPI environment;
5. installing browser/runtime dependencies;
6. running the default gate;
7. asserting `git diff --exit-code` so the gate cannot modify tracked source files.

The report directory, Playwright output, Wrangler state, Next.js output, and release virtual environment are ignored generated artifacts.

## Extended gate

The extended gate first runs the complete default gate, then records optional real-database and admin-import checks separately:

```powershell
$env:RUN_REAL_DB_TESTS="1"
$env:DATABASE_URL="postgresql+psycopg://..."
$env:RUN_ADMIN_IMPORT_SMOKE="1"
$env:ADMIN_API_TOKEN="..."
npm run release:extended
```

Missing required variables are classified as `environment-blocked`. Disabled optional checks are classified as `skipped`.
