# Repository Guidelines

## Project Structure & Module Organization
This repository is a monorepo for Panda Atlas (大熊猫图鉴与分布地图).

- `apps/web`: Next.js App Router frontend (Tailwind v4 + shadcn/ui style components).
- `services/api`: FastAPI backend service (v1 REST endpoints, schema/service split).
- `services/api/openapi/panda-atlas-v1.yaml`: API contract source of truth for frontend/backend alignment.
- `infra/supabase/migrations`: forward-only SQL migrations for Supabase Postgres/PostGIS.
- `docs/monorepo-structure.md`: architecture and delivery sequencing.

When adding new features, keep changes grouped by boundary: UI in `apps/web`, API behavior in `services/api`, and schema changes in `infra/supabase/migrations`.

## Tech Stack
- Monorepo/tooling: npm workspaces (`npm@10.9.0`) at the repository root.
- Frontend: Next.js 15 App Router, React 19, TypeScript 5, Tailwind CSS v4.
- Frontend UI utilities: shadcn/ui-style primitives, Radix Slot, class-variance-authority, clsx, tailwind-merge, lucide-react.
- Frontend mapping: MapLibre GL for map rendering.
- Backend: Python 3.11, FastAPI, Uvicorn, Pydantic Settings, SQLAlchemy 2, psycopg 3.
- Backend tooling: `uv` for environment/dependency management, `pytest` for tests, `ruff` for linting.
- Data layer: Supabase Postgres with PostGIS; SQL migrations live in `infra/supabase/migrations`.
- API contract: OpenAPI YAML in `services/api/openapi/panda-atlas-v1.yaml` is the frontend/backend source of truth.
- Local integration: Docker Compose runs the API plus `postgis/postgis:16-3.4`.

## Build, Test, and Development Commands
From repository root:

- Frontend dev: `npm run dev:web`
- Frontend lint: `npm run lint:web`
- Frontend typecheck: `npm run typecheck:web`

Backend (`services/api`):

- Install deps: `uv sync --extra dev`
- Run API: `uv run uvicorn app.main:app --reload`
- Run tests: `uv run pytest -q`
- Quick syntax check: `uv run python -m compileall app`

Container:

- Start API + Postgres for local integration: `docker compose up --build`

Database/Supabase:

- Apply local migrations after Supabase CLI setup: `supabase db reset`

## Coding Style & Naming Conventions
- Python: type hints required for public functions; keep endpoint handlers thin and place business logic in `app/services`.
- API style: versioned routes under `/api/v1`, plural resources, snake_case query params (`page_size`, `snapshot_date`).
- SQL: lowercase keywords, explicit section comments, `if exists`/`if not exists` for idempotency where possible.
- Frontend: route files in `apps/web/app/**/page.tsx`; shared utilities in `apps/web/lib`; keep UI primitives in `apps/web/components/ui`.
- Naming: use kebab-case for docs/config files and numeric migration prefixes (`0002_*.sql`).

## UI & Product Conventions
- Visual direction: natural-history + field-journal aesthetic (no generic dashboard look).
- Do not default to Inter/Roboto/Arial.
- Keep map and atlas pages mobile-safe and desktop-ready.
- New UI work should preserve the existing palette/tone in `apps/web/app/globals.css` unless a deliberate redesign is requested.

## API, Contract, and Data Rules
- Any API behavior change must update both:
  - implementation in `services/api/app/**`
  - contract in `services/api/openapi/panda-atlas-v1.yaml`
- Any persistent model change must include a new SQL migration in `infra/supabase/migrations`.
- Geo endpoints must return valid GeoJSON FeatureCollection payloads.
- DB read paths must preserve `DB_USE_MOCK_FALLBACK=true` behavior for local resilience.

## Map-Scoped Delivery and Verification
- Work performed as child tickets of a `wayfinder:map` uses deferred verification by default.
- Ordinary child tickets implement only their bounded backend, data, crawler, component, or documentation slice.
- Ordinary child tickets do not add or run the broad test matrix, Release Gate, Linux/Windows CI, browser suites, automated accessibility suites, Staging deployments, publication evidence, immutable-hash evidence, withdrawal/rollback drills, or cross-page frontend integration.
- Ordinary child tickets may run only the smallest syntax, import, formatting, or type sanity check needed to avoid knowingly handing off an unparseable artifact. These checks are not acceptance evidence.
- Every implementation map must end with one dedicated map-closing ticket and PR. That closing slice owns cross-ticket and cross-page integration, test creation and repair, full Release Gate execution, cross-platform CI, browser and accessibility verification, Staging and release evidence, immutable hashes, and rollback or withdrawal verification.
- The map-closing ticket is blocked by every implementation child ticket. The map cannot close until the closing ticket passes its complete acceptance matrix.
- A maintainer must explicitly override this policy when earlier verification is required; agents must not reintroduce per-ticket gates by assumption.

## Commit & Pull Request Guidelines
Use Conventional Commits, for example:

- `feat(web): add panda detail route`
- `feat(api): add distribution endpoint filters`
- `fix(db): correct rls role policy`

PRs should include:

- concise problem/solution summary,
- changed paths,
- API and DB impact notes,
- screenshots for UI-visible changes.

## Security & Configuration Tips
- Never commit secrets; use local `.env` files and deployment secret managers.
- `SUPABASE_SERVICE_ROLE_KEY` is backend-only and must never be exposed to `apps/web`.
- Admin endpoints require bearer auth; keep `ADMIN_API_TOKEN` in backend runtime env only.
- Re-check RLS policies whenever adding write paths or new tables.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Panda Atlas**

Panda Atlas is a brownfield full-stack monorepo for a giant panda encyclopedia and distribution atlas. It combines a public-facing Next.js experience for map exploration, panda profiles, and lineage browsing with a FastAPI backend, a Supabase/PostGIS data layer, and a lightweight admin import surface for curators and operators.

**Core Value:** People can reliably explore giant panda individuals, lineage, and distribution through one coherent atlas experience backed by trustworthy data.

### Constraints

- **Tech stack**: Frontend work stays in Next.js 15, React 19, TypeScript, and Tailwind; backend work stays in FastAPI, SQLAlchemy/psycopg, and Supabase/PostGIS so the repo does not split into parallel stacks.
- **Architecture boundary**: UI changes belong in `apps/web`, API behavior in `services/api`, and persistent schema changes in `infra/supabase/migrations` to preserve the repo's current boundary-oriented structure.
- **Contract discipline**: Any API behavior change must update both implementation and `services/api/openapi/panda-atlas-v1.yaml`.
- **Fallback resilience**: Public read paths must preserve `DB_USE_MOCK_FALLBACK=true` behavior so the atlas remains usable during local setup or DB degradation.
- **Geo payload shape**: Map-related endpoints must continue returning valid GeoJSON FeatureCollection payloads where expected.
- **Security**: Backend-only secrets such as `SUPABASE_SERVICE_ROLE_KEY` and admin tokens must not leak into browser-delivered surfaces.
- **Planning workflow**: This repo currently has no clean committed baseline, so `.planning/` remains local-only for now and documentation commits are disabled.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript is the main frontend language in `apps/web/app/**`, `apps/web/components/**`, and `apps/web/lib/**`.
- Python 3.11+ is the backend language in `services/api/app/**`, `services/api/scripts/**`, and `services/api/tests/**`.
- SQL is used for the data model and bootstrapping in `infra/supabase/migrations/0001_panda_atlas_init.sql` and `infra/supabase/seed/*.sql`.
- YAML is used for the API contract in `services/api/openapi/panda-atlas-v1.yaml`.
- CSS lives in `apps/web/app/globals.css`, with Tailwind v4 imported directly from the stylesheet.
## Runtime
- The repo root is an `npm` workspace monorepo declared in `package.json`.
- The web runtime is Next.js App Router in `apps/web`, with both server-rendered route files and client-side interactive shells.
- The API runtime is FastAPI in `services/api/app/main.py`, started with Uvicorn through `uv run uvicorn app.main:app --reload`.
- Local integration uses `docker-compose.yml` to run the API container and a `postgis/postgis:16-3.4` database.
- The backend has a first-class degraded runtime mode: `services/api/app/db/session.py` disables DB access when SQLAlchemy or `DATABASE_URL` is missing, and the service layer can fall back to mock data.
## Frameworks
- Frontend framework: Next.js 15 with React 19 in `apps/web/package.json`.
- Frontend styling: Tailwind CSS v4, plus shadcn-style primitives configured by `apps/web/components.json`.
- Frontend mapping: MapLibre GL in `apps/web/components/map/map-shell.tsx`.
- Backend framework: FastAPI, Pydantic Settings, SQLAlchemy 2, and psycopg 3 in `services/api/pyproject.toml`.
- Backend tooling: `uv`, `pytest`, and `ruff` in `services/api/pyproject.toml` and `services/api/uv.lock`.
- Data platform: Supabase-flavored Postgres/PostGIS schema with RLS, auth-linked tables, and seed SQL in `infra/supabase/**`.
## Key Dependencies
- Frontend runtime dependencies in `apps/web/package.json`: `next`, `react`, `react-dom`, `maplibre-gl`, `lucide-react`, `clsx`, `class-variance-authority`, `tailwind-merge`, and `@radix-ui/react-slot`.
- Frontend dev dependencies in `apps/web/package.json`: `typescript`, `eslint`, `eslint-config-next`, `tailwindcss`, and `@tailwindcss/postcss`.
- Backend runtime dependencies in `services/api/pyproject.toml`: `fastapi`, `uvicorn[standard]`, `pydantic-settings`, `sqlalchemy`, and `psycopg[binary]`.
- Backend dev dependencies in `services/api/pyproject.toml`: `pytest`, `httpx`, and `ruff`.
- The backend currently favors raw SQL through `sqlalchemy.text(...)` in `services/api/app/services/*.py` instead of ORM models.
## Configuration
- Workspace and scripts are defined in root `package.json`.
- Frontend aliases and shadcn-style config are defined in `apps/web/components.json` and `apps/web/tsconfig.json`.
- Frontend global visual tokens are defined in `apps/web/app/globals.css`.
- Backend env parsing is centralized in `services/api/app/core/config.py`.
- Local integration defaults are in `docker-compose.yml`.
- Example environment variables live in `.env.example`.
- Ignore rules for generated artifacts are in `.gitignore`, notably `apps/web/.next/` and `.venv/`.
## Platform Requirements
- `npm@10.9.0` is pinned at the repo root in `package.json`.
- Python `>=3.11` is required by `services/api/pyproject.toml`.
- Docker Compose is needed for the documented local API + PostGIS flow in `docker-compose.yml`.
- A Postgres/PostGIS-compatible database is required for non-fallback backend behavior.
- Supabase-specific SQL features are used in `infra/supabase/migrations/0001_panda_atlas_init.sql`, including `auth.users`, `auth.uid()`, `pgcrypto`, and `postgis`.
- The checked-out workspace also contains local build/runtime artifacts such as `apps/web/.next/` and `services/api/.venv/`, but those are intended to stay uncommitted.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Public API resources are plural and versioned under `/api/v1`, implemented in `services/api/app/api/v1/*.py`.
- Query parameters are snake_case, for example `page_size`, `snapshot_date`, `ancestor_depth`, and `descendant_depth`.
- Backend service functions are verb-based and domain-specific, such as `list_pandas`, `get_distribution`, and `run_import_job`.
- Frontend component files use kebab-case, while exported React components use PascalCase.
- Frontend domain constants and type unions are centralized in `apps/web/lib/panda-atlas.ts` and `apps/web/lib/types.ts`.
## Code Style
- Python public functions are typed, and response models are explicit Pydantic classes in `services/api/app/schemas/*.py`.
- Backend SQL is written inline with triple-quoted strings and executed through `sqlalchemy.text(...)`.
- Backend modules are intentionally simple and direct; there is little indirection beyond the router/service/schema split.
- TypeScript is strict and favors explicit interfaces and union types in `apps/web/lib/types.ts`.
- The atlas frontend uses React 19 concurrency-oriented APIs such as `startTransition` and `useDeferredValue` in `apps/web/components/atlas/global-distribution-shell.tsx`.
- Styling follows a hybrid of Tailwind utility classes and CSS custom properties from `apps/web/app/globals.css`.
## Import Organization
- Python files generally follow stdlib -> third-party -> local imports.
- TypeScript files generally import React/runtime symbols first, then local components and aliased `@/lib` modules.
- Frontend path aliases are configured in `apps/web/components.json` and `apps/web/tsconfig.json`.
- Cross-boundary imports stay disciplined: frontend does not import backend code directly, and backend does not depend on frontend assets.
## Error Handling
- Validation at the API edge uses FastAPI `Query(...)` constraints and typed route parameters.
- Services raise `HTTPException` for not-found and unavailable cases.
- DB errors are caught inside service modules and converted either to fallback behavior or HTTP 503 when fallback is disabled.
- Admin auth checks are done manually in `services/api/app/core/security.py` using `HTTPBearer(auto_error=False)`.
- Frontend public clients in `apps/web/lib/api-client.ts` catch fetch failures and return local fallback data instead of surfacing errors to users.
## Logging
- There is no project-wide structured logging convention yet.
- The codebase relies mostly on exceptions, HTTP status codes, and one-off script output.
- Operational scripts such as `services/api/scripts/smoke_test_api.py` and `import_demo_seed.py` print direct status output instead of using a shared logger.
## Comments
- Comments are sparse and usually explain fallback intent or scaffold-stage behavior.
- Examples:
- The code does not depend heavily on explanatory comments; most naming is intended to carry the meaning.
## Function Design
- Route handlers are thin pass-through functions that call service-layer functions and return typed models.
- Backend services commonly expose one public function per behavior and keep DB/mock variants private, for example `_list_pandas_from_db()` plus `_list_pandas_from_mock()`.
- Frontend helper modules expose focused pure functions, especially in `apps/web/components/atlas/helpers.ts`.
- Data client helpers in `apps/web/lib/api-client.ts` combine transport, fallback selection, and some merge behavior in a single module.
## Module Design
- Backend modules are organized by responsibility: `api`, `services`, `schemas`, `db`, `core`, and `data`.
- Frontend modules are organized by feature surface: `atlas`, `map`, `lineage`, `admin`, `site`, and `ui`.
- The repo keeps contract and persistence outside the runtime code, in `services/api/openapi/**` and `infra/supabase/**`.
- Root planning files (`task_plan.md`, `findings.md`, `progress.md`) are part of the working conventions for this repo even though they are not in `docs/`.
- There is a visible transition from older map components in `apps/web/components/map/**` toward the newer atlas workspace in `apps/web/components/atlas/**`.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- This is a boundary-oriented monorepo: `apps/web` owns UI and route composition, `services/api` owns HTTP behavior and service logic, and `infra/supabase` owns schema and seed state.
- The frontend mixes server route entrypoints with large client-side shells. For example, `apps/web/app/(site)/global-distribution/page.tsx` fetches initial data server-side, then hands control to `apps/web/components/atlas/global-distribution-shell.tsx`.
- The backend uses thin FastAPI route modules in `services/api/app/api/v1/*.py` and pushes behavior into service modules in `services/api/app/services/*.py`.
- The current backend data access style is raw SQL plus explicit mapping, not ORM-model driven. `docs/monorepo-structure.md` describes models that do not exist in the current implementation.
- Fallback mode is part of the architecture, not just a local dev hack. Public read paths intentionally continue working from mock data when DB access fails and `DB_USE_MOCK_FALLBACK=true`.
## Layers
- Presentation layer:
- Client orchestration layer:
- API transport layer:
- Domain/service layer:
- Data and contract layer:
## Data Flow
- Public page request:
- Map refresh flow:
- Admin import flow:
## Key Abstractions
- `Settings` in `services/api/app/core/config.py` centralizes backend environment parsing and defaulting.
- `configure_database()`, `has_database()`, `database_health()`, and `session_scope()` in `services/api/app/db/session.py` define DB lifecycle and fallback readiness.
- Pydantic response models in `services/api/app/schemas/panda.py`, `map.py`, and `stats.py` define runtime payload shape.
- `GeoJsonFeatureCollection` in both Python and TypeScript is the shared conceptual map payload shape.
- `ATLAS_MODES`, `ATLAS_INSTITUTIONS`, and related types in `apps/web/lib/panda-atlas.ts` are effectively a frontend domain model layered on top of backend data.
- The atlas helper module in `apps/web/components/atlas/helpers.ts` concentrates filtering, geographic centering, summary assembly, and feature generation.
## Entry Points
- Frontend root shell: `apps/web/app/layout.tsx`.
- Home page: `apps/web/app/page.tsx`.
- Atlas workspace: `apps/web/app/(site)/global-distribution/page.tsx`.
- Legacy map route redirect: `apps/web/app/map/page.tsx`.
- Atlas index: `apps/web/app/atlas/page.tsx`.
- Atlas detail page: `apps/web/app/atlas/[slug]/page.tsx`.
- Lineage view: `apps/web/app/lineage/page.tsx`.
- Admin import UI: `apps/web/app/admin/imports/page.tsx`.
- API bootstrap: `services/api/app/main.py`.
- Local container entry: `docker-compose.yml`.
## Error Handling
- FastAPI query validation handles many input errors at the router boundary, for example `bbox` and pagination constraints in `services/api/app/api/v1/*.py`.
- Service modules raise `HTTPException` for expected application failures such as not-found and 503-on-no-fallback cases.
- Database failures are intentionally absorbed when fallback is enabled, which keeps the public app alive but can hide data-path regressions.
- Frontend public data clients in `apps/web/lib/api-client.ts` catch failures and substitute fallback content, while admin clients rethrow errors to the UI.
## Cross-Cutting Concerns
- Contract drift risk exists because implementation and `services/api/openapi/panda-atlas-v1.yaml` are updated manually.
- Mock fallback behavior shapes both frontend and backend design, especially around resilient public pages.
- The codebase currently carries two map experiences: the newer atlas workspace in `apps/web/components/atlas/**` and the older MapLibre workbench in `apps/web/components/map/map-shell.tsx`.
- Text encoding quality is a repo-wide concern: multiple frontend metadata strings and mock-data values show mojibake instead of clean Chinese content.
- Security posture is split between simple backend bearer-token checks and richer database RLS policies, which do not currently line up as a single end-to-end auth system.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

Project skills are installed under `.agents/skills/`. Discover the available skills from the workspace inventory and load the relevant `SKILL.md` before using one.
<!-- GSD:skills-end -->

## Agent skills

### Issue tracker

Issues and engineering work are tracked in GitHub Issues for `SwayingWindmill/PandaAtlas`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default mattpocock/skills triage label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Use a multi-context domain documentation layout with a root `CONTEXT-MAP.md` and context-specific `CONTEXT.md` files. See `docs/agents/domain.md`.
