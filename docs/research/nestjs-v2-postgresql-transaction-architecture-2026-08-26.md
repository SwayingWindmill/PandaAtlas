# NestJS V2 PostgreSQL access and transaction architecture

- Date: 2026-08-26
- Wayfinder map: #309 `Map: Define the NestJS V2 backend architecture and migration path`
- Decision ticket: #312 `Validate the PostgreSQL access and transaction architecture`
- Status: decision asset for Wayfinder; not yet the governing V2 architecture baseline

## Question

Should PandaAtlas V2 standardize on Kysely plus node-postgres for application database access, and what exact transaction, connection-pooling, repository, PostGIS, PGMQ, SQL escape-hatch, and Supabase migration ownership model gives the best long-term fit?

## Decision summary

Yes. PandaAtlas V2 should standardize on **Kysely + node-postgres (`pg`)** as the NestJS application's PostgreSQL access layer.

Kysely is used as a **type-safe SQL query builder**, not as an ORM and not as the owner of schema migrations. PostgreSQL remains visible as PostgreSQL: PostGIS functions, PGMQ functions, CTEs, locking clauses, JSONB, database functions and raw SQL remain first-class.

The database architecture is:

```text
NestJS application modules
        |
        v
module-owned query/repository adapters
        |
        v
Kysely
        |
        v
node-postgres Pool
        |
        v
Supavisor / PostgreSQL
        |
        v
Supabase PostgreSQL + PostGIS + PGMQ
```

Supabase SQL migrations remain the sole schema authority.

## Prototype evidence

The decision was validated with a throwaway prototype using:

- WSL Node.js `v24.18.0`;
- Kysely `0.29.5`;
- node-postgres `8.16.3`;
- the current repository SQL conventions and existing Supabase/PostGIS/PGMQ usage.

The WSL Node installation is at:

```text
/home/haozhang/.nvm/versions/node/v24.18.0/bin/node
```

The repository root currently contains Windows-installed Node dependencies, so the prototype intentionally used an isolated WSL npm execution prefix rather than reusing root `node_modules`.

### SQL capability check

Kysely successfully compiled representative PandaAtlas SQL for:

1. an Engagement write;
2. a transactional Outbox write;
3. a PostGIS distance query using `ST_DWithin`, `ST_DistanceSphere`, `ST_SetSRID` and `ST_MakePoint`;
4. a PGMQ `pgmq.send` call.

Representative compiled statements were ordinary parameterized PostgreSQL:

```sql
insert into "engagement"."favorites"
  ("account_id", "panda_id", "created_at")
values ($1, $2, $3)
```

```sql
select
  "id",
  "name",
  ST_DistanceSphere(
    center,
    ST_SetSRID(ST_MakePoint($1, $2), 4326)
  ) as "distance_meters"
from "public"."places"
where ST_DWithin(
  center::geography,
  ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
  $5
)
order by "distance_meters"
```

```sql
select pgmq.send($1, $2::jsonb)::text as msg_id
```

This proves Kysely does not require PandaAtlas to abandon SQL-first PostgreSQL features.

### Transaction binding check

A fake `pg.PoolClient` was used to execute real Kysely transaction control without requiring a database server. The successful transaction sequence was:

```text
acquire fake-pg-client-1
BEGIN
engagement.favorites INSERT
integration.outbox_events INSERT
COMMIT
release fake-pg-client-1
```

The failure sequence was:

```text
acquire fake-pg-client-1
BEGIN
query
ROLLBACK
release fake-pg-client-1
```

Every statement inside one transaction used the same acquired `PoolClient`. This validates that a single Kysely transaction executor can safely be passed through multiple module persistence adapters when an atomic cross-module workflow is genuinely required.

### Prepared-statement compatibility check

The fake client also exposed the actual call shape used by Kysely's PostgreSQL dialect. Kysely called node-postgres with query text and parameter values, not a named query configuration.

Current node-postgres creates a named prepared statement only when a query configuration contains `name`. Supabase's transaction pooler does not support prepared statements and explicitly documents that node-postgres clients should omit `name`.

Therefore the tested Kysely + `pg` path is compatible with Supavisor transaction mode as long as PandaAtlas does not introduce named prepared-query wrappers.

## Supabase connection model

PandaAtlas must distinguish **application traffic** from **schema/operations traffic**.

### Request-bound NestJS application traffic

The Vercel/serverless NestJS runtime should use Supavisor **transaction mode**, normally port `6543`.

Reasons:

- Supabase recommends transaction mode for temporary/serverless clients;
- server-side pooling prevents autoscaling application instances from directly exhausting PostgreSQL connections;
- Kysely + node-postgres works without named prepared statements;
- PandaAtlas request transactions do not need durable session affinity.

The application keeps one singleton Kysely instance per warm runtime instance, backed by one bounded `pg.Pool`.

The pool size must be deliberately small and configurable. The exact production default is deferred to deployment validation in #318 because it depends on Vercel Fluid Compute concurrency and the selected Supabase pooler limits. It must not default to node-postgres's ordinary large process-pool assumptions without review.

### Migrations and session-sensitive operations

Schema migrations, backup/restore tooling and operations that genuinely require session-level PostgreSQL features use a separate direct or session-mode connection.

The architecture must therefore support separate connection purposes rather than overloading one `DATABASE_URL` with incompatible responsibilities:

```text
application / request URL -> transaction pooler
migration / privileged URL -> direct or session-mode connection
```

Exact environment-variable names are finalized by #318/#320.

### Unsupported assumptions in request traffic

Request-path code must not rely on connection-session state such as:

- named prepared statements;
- `LISTEN/NOTIFY` listeners tied to one session;
- temporary tables that must survive across transactions;
- session-wide `SET` state;
- session-scoped advisory locks.

Existing PandaAtlas code uses `pg_advisory_xact_lock` in several places. Transaction-scoped advisory locking is not promoted to a V2 request-runtime foundation. Where a V2 command needs concurrency control, prefer row locks, unique/exclusion constraints, optimistic versions and idempotency. Any retained transaction-level advisory-lock use must be justified and integration-tested against the chosen pooler/runtime; worker-specific locking is decided by #315/#318.

## Application-side pool ownership

There is exactly one root application database object per Nest runtime instance:

```ts
Kysely<DatabaseSchema>
  -> PostgresDialect
  -> pg.Pool
```

Rules:

1. Business modules do not create their own `pg.Pool`.
2. Business modules do not create their own root Kysely instances.
3. The database platform provider owns pool creation, shutdown and connection configuration.
4. A module receives only the database surface it needs.
5. Pool configuration is validated at startup.
6. Connection creation is lazy; the HTTP application must not require a successful database connection merely to load module constructors.
7. Pool resources may be reused across warm Vercel invocations, but correctness never depends on warm reuse.
8. `pg.Pool` is an application optimization, not an authoritative state store.

## Schema authority

### Supabase SQL remains authoritative

Keep:

```text
infra/supabase/migrations/*.sql
```

as the sole database-schema migration authority.

Do not adopt:

- Kysely migrations as a second schema history;
- Prisma migrations;
- TypeORM migrations;
- automatic schema synchronization at application startup.

Reasons:

- PandaAtlas intentionally uses PostgreSQL-native capabilities that are best expressed in SQL;
- PostGIS, PGMQ, RLS, triggers, functions, grants, exclusion constraints and append-only protections already live naturally in SQL;
- one migration history prevents drift and split ownership;
- migrations are deployment work, never request-startup work.

Kysely database TypeScript types are **generated/derived artifacts**, not schema authority. Exact type-generation tooling is deferred to #320.

## Physical schema ownership upgrade

V2 should no longer treat the PostgreSQL `public` schema as the default home for authoritative business state.

The current database contains a historical split:

- early Panda, source, lineage, place, event, media and publication tables live in `public`;
- newer domains such as Identity, Engagement, Activity, Feed, Notification, Privacy and Audit already use private schemas.

That historical split must not define the V2 design.

### V2 rule

Authoritative server-owned data should live in module-owned private PostgreSQL schemas, conceptually:

```text
evidence.*
panda.*
lineage.*
place.*
life_history.*
media.*
contribution.*
review.*
moderation.*
curation.*
publication.*
identity.*
engagement.*
game.*
updates.*
notification.*
privacy.*
audit.*
integration.*
```

The exact table migration is planned later; this ticket locks the ownership direction.

### `public` schema purpose

The `public` schema should be reserved for deliberately exposed/public read objects where #317 determines they are useful, for example views or versioned read projections.

It must not remain a generic authoritative-write schema simply because the V1 tables started there.

This gives three benefits:

- database layout matches the module ownership map from #310;
- Supabase Data API/PostgREST exposure becomes explicit instead of incidental;
- cross-module table access is easier to detect and govern.

Browser clients continue to have no direct business-write authority.

## Database role model

NestJS should connect with a dedicated server-side application database role with only the privileges needed by the application runtime.

It should not depend on:

- a PostgreSQL superuser for ordinary requests;
- browser Supabase `anon`/`authenticated` roles for server writes;
- a Supabase service-role API token as a substitute for a PostgreSQL application role.

Migration/operations credentials remain separate and more privileged.

Because one Nest process must support atomic cross-module transactions, V2 does **not** create one physical PostgreSQL login/pool per business module. Storage ownership is enforced by module interfaces, generated/narrow types, CI dependency/storage checks, database constraints and review—not by multiplying runtime connection pools.

## Kysely type surface

The full generated database type may exist inside the database platform implementation, but module persistence code should operate on a **narrow module-owned table surface**.

Conceptually:

```ts
type EngagementDatabase = Pick<
  DatabaseSchema,
  | 'engagement.favorites'
  | 'engagement.collections'
  | 'engagement.collection_items'
  | 'engagement.location_checkins'
  | 'engagement.seen_pandas'
>;
```

The exact generated type syntax may differ.

The goal is architectural: Engagement persistence should not get autocomplete/type access to Privacy, Publication or Identity private tables merely because all tables share one PostgreSQL database.

The CI enforcement mechanics are finalized by #319/#320.

## Query and repository conventions

Do not build a generic repository framework over Kysely.

Rejected abstraction:

```text
BaseRepository<T>
GenericCrudRepository<T>
findAll/findOne/create/update/delete everywhere
```

That would hide useful SQL semantics while recreating an ORM-shaped architecture.

Instead:

### Domain-oriented writes

Use a repository/adapter when it hides real persistence complexity behind a small domain interface.

Examples:

- save a reviewed ChangeSet transition;
- enforce Publication release invariants;
- persist a moderation sanction and associated evidence;
- append an Outbox event atomically with state.

### Read/query models

Simple or complex read models may use module-local Kysely query objects directly inside the implementation when no useful second adapter exists.

A query object can express joins, CTEs, PostGIS and read projections without pretending it is a domain aggregate repository.

### External interface

No Kysely type, table name or SQL expression crosses a business module's external interface.

## SQL escape hatch

Kysely's tagged `sql` expressions are an accepted first-class tool, not a failure of the architecture.

Use them for:

- PostGIS operations;
- PGMQ functions;
- PostgreSQL-specific operators;
- CTEs or functions not conveniently expressed by the builder;
- carefully reviewed locking/maintenance statements;
- existing SQL that is clearer than a query-builder translation.

Rules:

1. Values remain parameterized.
2. Never concatenate user input into SQL.
3. Dynamic identifiers use a strict internal allowlist, never arbitrary request data.
4. Raw SQL remains inside the owning module's persistence implementation.
5. Complex raw SQL should have focused integration tests against PostgreSQL.

## Transaction architecture

### Transaction owner

The **application command boundary** owns transaction start/commit/rollback.

Repositories do not call `commit()` or independently create transactions behind the caller's back.

Conceptually:

```ts
return unitOfWork.transaction(async (tx) => {
  await engagementWrites.addFavorite(tx, command);
  await outbox.append(tx, event);
});
```

### Explicit transaction propagation

V2 should prefer **explicit transaction propagation**, not an ambient database transaction stored in AsyncLocalStorage.

The transaction handle exposed to application/module-internal code is an opaque platform-level transaction scope. Kysely's concrete `Transaction<Database>` remains inside database/infrastructure implementation code.

Reasons:

- atomicity is visible in function interfaces and tests;
- an async call cannot accidentally join a hidden transaction;
- no ambiguity exists about nested transaction ownership;
- request context and transaction context remain separate concerns;
- cross-module atomic workflows are obvious and exceptional rather than implicit.

AsyncLocalStorage remains the request/correlation context mechanism selected by #311; it is not the default database transaction carrier.

### Cross-module atomic transactions

A shared transaction is allowed only when the business invariant genuinely requires all participating writes to commit or roll back together.

Examples include:

- a sensitive Moderation action plus immediate Identity access-state consequence where partial success would be invalid;
- Privacy final deletion coordinating module-owned deletion/anonymization participants;
- authoritative state plus its transactional Outbox record.

In those cases, the orchestrating module calls a **narrow transaction-participant interface** from the target module. It still does not call the target repository or table directly.

### Ordinary cross-module work

If atomicity is not required, do not stretch one transaction across modules. Commit the owning module's state plus Outbox and continue through durable integration events.

### Nested transactions

Do not build implicit nested-transaction behavior.

- one application command owns the top-level transaction;
- called persistence/module participants join the provided scope;
- a participant must not start another transaction;
- savepoints are explicit and rare when a concrete workflow needs partial rollback.

Kysely supports controlled transactions and savepoints, so there is no need for a home-grown nested transaction abstraction.

## Isolation and concurrency

PostgreSQL's default `READ COMMITTED` is the default application isolation level.

Prefer database invariants over globally stronger isolation:

- unique constraints;
- exclusion constraints;
- foreign keys;
- append-only triggers where required;
- optimistic version columns;
- idempotency keys;
- `SELECT ... FOR UPDATE` for the small number of truly contended rows.

Use stronger isolation or advisory locking only when a specific invariant demonstrates the need.

Automatic infinite transaction retry is forbidden. Serialization/deadlock retries, where used, are bounded and only wrap work whose side effects remain inside PostgreSQL/Outbox and are idempotent/replay-safe.

## External side effects and transactions

Do not hold a database transaction open while performing arbitrary remote work such as:

- email delivery;
- HTTP calls;
- crawling;
- R2 uploads/downloads;
- AI/model calls;
- release artifact construction.

Instead:

```text
business transaction
  -> authoritative write
  -> Outbox/intent write
  -> COMMIT
  -> worker performs external side effect
```

If a workflow requires a remote object before finalization, use explicit staged/finalized states rather than one long database transaction around the network call.

## PGMQ relationship

The prototype verified that PGMQ functions work naturally through Kysely's parameterized SQL and can execute on the same transaction executor.

This ticket intentionally does not decide whether every integration event should:

- insert Outbox first and later relay into PGMQ; or
- use selected same-transaction PGMQ sends.

That event-routing decision belongs to #315.

The database layer merely guarantees that both mechanisms are available without a separate message-broker client or infrastructure stack.

## PostGIS relationship

PostGIS remains native PostgreSQL, not a separate geospatial service.

Places/LifeHistory and public map queries may use focused SQL helpers for recurring geometry expressions, but PandaAtlas should not introduce a generic GIS abstraction that hides PostGIS.

Prefer returning application-shaped values—coordinates, distances, GeoJSON fragments or typed read DTO input—rather than exposing raw driver geometry objects across module interfaces.

## Why not Prisma

Prisma is not selected for the V2 authoritative database layer.

The reason is not that Prisma cannot access PostgreSQL. The reason is architectural fit: PandaAtlas already depends heavily on PostgreSQL-specific SQL, PostGIS, PGMQ, schemas, RLS, functions, append-only triggers, unusual constraints and migration-owned database behavior.

Using Prisma as the primary persistence abstraction would add an ORM/schema layer without removing the need for substantial raw SQL.

Kysely provides type feedback while keeping SQL and PostgreSQL semantics visible.

## Why not TypeORM

TypeORM is not selected because PandaAtlas does not benefit from an entity/active-record/data-mapper model as its central persistence abstraction. The current Python system is already SQL-first despite using SQLAlchemy.

Migrating the web framework and simultaneously rebuilding the persistence model around ORM entities would combine two unrelated migrations and increase risk.

## Why not plain `pg` everywhere

Plain node-postgres remains underneath Kysely, but using it directly for every query is not the default because Kysely provides useful compile-time column/result/parameter feedback without forcing an ORM model.

Direct `pg` use is reserved for a capability that genuinely cannot be expressed cleanly through Kysely's dialect/raw-SQL surface. No such requirement was found in this prototype.

## Local environment observation

After locating the WSL Node installation, the WSL Supabase CLI `2.110.0` was successfully executed from an isolated npm prefix.

A live local Supabase database smoke test was not possible in this session because Docker Desktop's WSL integration is not enabled and the Windows Docker daemon was also unavailable:

```text
WSL: docker command unavailable; Docker Desktop recommends enabling WSL integration
Windows: dockerDesktopLinuxEngine pipe unavailable
```

This does not weaken the Kysely/transaction decision because the prototype validated Kysely's SQL generation and transaction-driver behavior directly. It does mean **real Supavisor/PostGIS/PGMQ execution remains mandatory deployment evidence** in #318 rather than being claimed here.

## External references checked

- Kysely simple transactions: https://kysely.dev/docs/examples/transactions/simple-transaction
- Kysely controlled transactions/savepoints: https://kysely.dev/docs/category/transactions
- Kysely PostgreSQL dialect: https://kysely-org.github.io/kysely-apidoc/classes/PostgresDialect.html
- Kysely PostgreSQL driver: https://kysely-org.github.io/kysely-apidoc/classes/PostgresDriver.html
- node-postgres client/prepared-query behavior: https://node-postgres.com/apis/client
- Supabase PostgreSQL connection modes: https://supabase.com/docs/guides/database/connecting-to-postgres
- Supabase prepared-statement guidance: https://supabase.com/docs/guides/troubleshooting/disabling-prepared-statements-qL8lEL

## Acceptance for #312

The PostgreSQL/transaction architecture is resolved when later planning can assume all of the following without reopening the decision:

- Kysely + node-postgres is the V2 NestJS database-access baseline.
- Kysely is a SQL query builder, not an ORM or migration authority.
- Supabase SQL migrations remain the only schema migration history.
- PostGIS and PGMQ remain native PostgreSQL capabilities reached through Kysely/raw SQL.
- request-bound Vercel traffic targets Supavisor transaction mode; migration/session-sensitive work uses a separate connection purpose.
- named prepared statements and request-path session assumptions are forbidden.
- one singleton Kysely/pg Pool exists per runtime instance; module code does not create independent pools.
- V2 authoritative business tables move toward private module-owned schemas; `public` is reserved for deliberate public read objects.
- application commands own transactions; repositories do not commit independently.
- transaction propagation is explicit, not ambient ALS by default.
- cross-module atomic transactions use narrow transaction-participant interfaces, never cross-module repository/table access.
- default isolation remains PostgreSQL `READ COMMITTED` with constraints, idempotency, versions and focused row locking used for invariants.
- remote side effects never execute as arbitrary network work inside a database transaction.
- the real managed Supabase/Supavisor connection and pool sizing still require #318 validation.
