# NestJS V2 domain events, transactional outbox, queues, and background execution

- Date: 2026-08-26
- Wayfinder map: #309 `Map: Define the NestJS V2 backend architecture and migration path`
- Decision ticket: #315 `Define domain events, transactional outbox, queues, and background execution`
- Status: decision asset for Wayfinder; not yet the governing V2 architecture baseline

## Question

What should the NestJS V2 event and background-work architecture be across in-process domain events, transactional integration outbox, PGMQ queues, projectors, notification delivery, retries and dead-letter handling, and GitHub Actions batch workflows, while keeping long-running work out of user request execution and avoiding unnecessary infrastructure?

## Decision summary

PandaAtlas V2 uses a **three-layer asynchronous architecture**:

```text
Business command
    |
    +-- authoritative module write
    +-- module-local synchronous domain events/policies
    +-- Integration Outbox append
    |
    `---- one PostgreSQL transaction
                 |
                 v
        Outbox Dispatcher
                 |
                 | fan-out in PostgreSQL
                 v
      consumer-specific PGMQ queues
          |        |        |
          v        v        v
       Updates  Notification  Audit ...
          |
          +-- DB-only projection/intent work
          `-- dedicated job queues for remote side effects
```

The baseline deliberately does **not** add Kafka, RabbitMQ, Redis, BullMQ, SQS, Temporal, or a microservice event bus.

PostgreSQL remains the durability boundary. PGMQ is the execution queue. The Outbox is the authoritative replayable integration-event history.

## Core rules

1. **Domain events are module-local and synchronous.**
2. **Cross-module asynchronous facts are integration events written to the transactional Outbox.**
3. **No producer writes directly to another module's queue.**
4. **One generic shared PGMQ queue is not used as a fan-out event bus.**
5. **The Outbox Dispatcher fans each event into one queue per subscribed consumer/work type.**
6. **Every consumer is idempotent. Exactly-once business side effects are never assumed.**
7. **DB-only consumer effects and queue acknowledgement are committed atomically where possible.**
8. **Remote side effects are separated into durable jobs and never run inside the producer's database transaction.**
9. **User HTTP requests only persist intent/state/outbox and return. They do not poll queues or run long workers.**
10. **Short bounded queue pumps may run through Vercel Cron; long/heavy batch work runs in GitHub Actions.**
11. **`waitUntil()` is never the durability mechanism for business work.**
12. **PGMQ remains private PostgreSQL infrastructure and is not exposed through `pgmq_public` to browser clients.**

## Why the current V1 event foundation is not the final V2 architecture

The current repository already contains useful ingredients:

- `integration.outbox_events` with event ID, event type/version, source context, aggregate reference, correlation/causation, payload and publication fields;
- a private `integration` schema;
- PGMQ queue creation and smoke tests;
- Notification queues, retry visibility timeouts and DLQs;
- append-only attempt/worker evidence;
- `FOR UPDATE SKIP LOCKED` in some relay/projector paths;
- bounded notification worker CLI modes.

However, the implementation has accumulated V1-specific coupling:

- direct `insert into integration.outbox_events` SQL is duplicated across many repositories;
- modules query the Outbox directly with different receipt strategies;
- queue send/archive/backoff logic is embedded in domain-specific repositories;
- the generic `integration_events` queue suggests a single-consumer queue is being used like an event bus;
- Activity and Feed consumers belong to the new V2 Updates capability;
- some workers perform queue claim, local state transitions and transport work in one large repository surface;
- worker execution is not yet expressed as one coherent managed-runtime model.

V2 keeps the proven PostgreSQL/PGMQ mechanics but replaces the scattered control architecture.

## 1. Domain events

### Definition

A domain event is an in-memory fact raised inside one owning business module while executing a command.

Examples:

```text
FavoriteAdded
SubmissionSubmitted
ReviewDecisionRecorded
ReleaseActivated
AccountSuspended
```

These names are conceptual. The exact internal TypeScript naming follows each module.

### Domain events are not transport contracts

Domain events may contain domain types and are allowed to evolve with the owning module.

They are not:

- OpenAPI objects;
- PGMQ messages;
- cross-module JSON contracts;
- Python contracts;
- Audit storage rows.

### Handling model

Do not introduce a global Nest event bus as the architectural default.

Rejected baseline:

```text
@nestjs/event-emitter
  -> hidden cross-module listeners
  -> business correctness depends on process-local callbacks
```

Instead, module-local domain events are handled explicitly by the owning application's command orchestration before commit.

Conceptually:

```ts
const result = aggregate.addFavorite(command);

await unitOfWork.transaction(async (tx) => {
  await favoriteRepository.save(tx, result.aggregate);
  await localPolicies.handle(tx, result.domainEvents);
  await outbox.appendAll(tx, integrationEvents(result.domainEvents));
});
```

Simple modules do not need formal aggregate event collectors if an explicit application command is clearer. The architecture does not require ceremony-heavy DDD.

### In-process Nest events

Nest/EventEmitter events may be used only for **non-authoritative, process-local implementation concerns** where loss has no business consequence, for example a local cache hint.

They are forbidden for:

- cross-module state changes;
- Audit evidence;
- Notifications;
- publication/update propagation;
- privacy workflows;
- anything that must survive process termination.

## 2. Integration events

### Definition

An integration event is a durable, versioned, language-neutral statement that a committed business fact occurred and another module may react later.

Examples aligned with #310:

```text
publication.release-activated
publication.release-withdrawn
life-history.event-published
review.incorporation-recommended
review.abuse-outcome-recorded
moderation.sanction-applied
engagement.favorite-added
identity.account-suspended
```

Event names describe **facts**, not commands.

Avoid names such as:

```text
send-notification
update-feed
rebuild-audit
```

Those encode a consumer action and couple producers to downstream implementation.

### Envelope

V2 keeps the useful V1 envelope concepts but standardizes names around the V2 module map.

Conceptual contract:

```ts
interface IntegrationEventEnvelope<TPayload> {
  eventId: string;
  envelopeVersion: 1;
  eventType: string;
  eventVersion: number;
  sourceModule: string;
  aggregate: {
    type: string;
    id: string;
    version?: number;
  };
  correlationId: string;
  causationId?: string;
  occurredAt: string;
  payload: TPayload;
}
```

### Required semantics

- `eventId` is globally unique and immutable.
- `eventType` is stable semantic identity.
- `eventVersion` versions the payload contract independently of the envelope.
- `sourceModule` uses V2 capability vocabulary, not Python package names.
- `aggregate` identifies the business subject that emitted the fact when applicable.
- `correlationId` follows the logical action across HTTP, events and workers.
- `causationId` identifies the event/command that directly caused this event where available.
- `occurredAt` is the business event time, not queue enqueue time.
- payloads contain the minimum facts a consumer needs.

### No secrets or unnecessary PII

Integration events must not contain:

- bearer/refresh tokens;
- cookies;
- database credentials;
- private object-storage URLs;
- raw email content when an account ID is sufficient;
- full JWT claims;
- arbitrary submitted attachment bodies.

A consumer loads sensitive source data through the owning module's authorized interface or dedicated private read model when required.

### Event contract registry

V2 keeps one explicit event-contract registry in code/contracts, not dynamic subscriptions configured by administrators.

The registry records at least:

```text
eventType
current eventVersion
payload schema
source module
subscriber keys
```

The exact language-neutral schema layout is coordinated with #316 so Python producers/consumers can participate without importing Nest TypeScript classes.

## 3. Transactional Outbox

### Outbox is the only cross-module publication seam

When a business transaction must publish an integration event, it writes the authoritative state and Outbox row in the same PostgreSQL transaction.

Conceptually:

```ts
await unitOfWork.transaction(async (tx) => {
  await publication.activate(tx, releaseId);
  await outbox.append(tx, releaseActivatedEvent);
});
```

If the transaction rolls back, neither business state nor event exists.

### Central Outbox writer

Business repositories no longer contain copies of:

```sql
insert into integration.outbox_events (...)
```

Use one platform-level `OutboxWriter`/`IntegrationEventPublisher` persistence adapter.

It receives an explicit transaction scope selected in #312.

It does not commit independently.

### Outbox storage

The V2 Outbox remains in a private integration schema and is append-only for event content.

Conceptually:

```text
integration.outbox_events
  event_id
  envelope_version
  event_type
  event_version
  source_module
  aggregate_type
  aggregate_id
  aggregate_version
  correlation_id
  causation_id
  occurred_at
  available_at
  payload
  dispatched_at
  dispatch_attempts
  last_error_code
  last_error_at
  created_at
```

The current V1 `published_at` concept should be renamed/interpreted as **`dispatched_at`** in V2 because it means fan-out into consumer queues completed; it does not mean consumers successfully processed the event.

### Idempotency

`eventId` is the primary event identity.

A producer may additionally provide a deterministic source idempotency key when one business command can be replayed.

Keep an appropriate unique constraint to prevent duplicate event creation for one idempotent command.

### Retention

The Outbox is authoritative replay history and is not deleted immediately after dispatch.

V2 initially prefers generous/indefinite retention over an early compaction subsystem because PandaAtlas event volume is expected to be modest.

Any future retention policy must guarantee it cannot remove an event still needed by a queued consumer or compliance/audit workflow.

## 4. Why PGMQ is not the Outbox

PGMQ and Outbox solve different problems.

### Outbox

Owns:

- event identity;
- event contract version;
- source/aggregate/correlation history;
- replayable cross-module fact history;
- producer transaction atomicity.

### PGMQ

Owns:

- runnable work;
- visibility timeout;
- redelivery;
- queue depth;
- per-worker backpressure;
- archive/delete of execution messages.

Do not replace the Outbox with direct queue sends from producers even though `pgmq.send()` is transactional PostgreSQL SQL. Direct sends would make producers know consumer/work queues and would weaken replay/fan-out semantics.

## 5. Outbox Dispatcher and fan-out

### One dispatcher, consumer-specific queues

The Outbox Dispatcher reads undispatched events and fans them to the statically registered consumers.

Example:

```text
publication.release-activated
    |
    +--> integration_updates
    +--> integration_notification
    `--> integration_audit
```

Do **not** put one copy into a generic shared `integration_events` queue and expect Updates, Notification and Audit all to consume it independently.

PGMQ is pull-based work queue storage. One queue message is claimed by a consumer, not broadcast to every subscriber.

### Atomic fan-out

PGMQ lives in the same PostgreSQL database, so dispatcher fan-out can be atomic.

For one Outbox event, one dispatcher transaction should:

1. lock/claim the pending Outbox row;
2. resolve the static subscriber list;
3. call `pgmq.send()` for each subscriber queue;
4. mark the Outbox row `dispatched_at`;
5. commit.

If the process dies before commit, all queue sends and the dispatch marker roll back together.

This removes the classic cross-system Outbox relay ambiguity without coupling producers to queues.

### Concurrency

Dispatchers use bounded batches and PostgreSQL locking such as:

```text
FOR UPDATE SKIP LOCKED
```

Multiple dispatcher invocations may safely overlap.

The dispatcher must never depend on one permanent singleton worker process.

### Queue message shape

Consumer queue messages are deliberately small.

Conceptually:

```json
{
  "schemaVersion": 1,
  "eventId": "...",
  "eventType": "publication.release-activated",
  "eventVersion": 1,
  "correlationId": "..."
}
```

The authoritative payload remains in the Outbox and is loaded through the integration-event store by `eventId`.

This avoids maintaining two independently authoritative copies of the payload.

If #316 finds a concrete Python execution boundary where self-contained queue payloads materially simplify operation, that consumer may carry the full validated envelope, but the Outbox remains authoritative.

### Unknown routes

An Outbox event with no valid registered route is treated as a configuration/deployment error unless the event contract explicitly declares zero consumers.

Do not silently mark unexpected events dispatched.

Persist a stable dispatch error code and surface it through monitoring.

## 6. Consumer idempotency / Inbox receipts

Queue delivery is not equivalent to exactly-once business processing.

Supabase describes PGMQ as exactly-once delivery **within a visibility timeout**, but a message remains available until archived/deleted and can be read again after the visibility timeout.

Therefore PandaAtlas guarantees **at-least-once execution with idempotent consumers**.

### Generic consumer receipt

Use one integration-level receipt mechanism conceptually:

```text
integration.consumer_receipts
  consumer_key
  event_id
  processed_at
  outcome
  correlation_id

UNIQUE (consumer_key, event_id)
```

This receipt is infrastructure evidence that a consumer has applied or intentionally ignored one event.

It does not replace domain-specific processing records.

### DB-only consumer transaction

For a fast consumer that only changes PostgreSQL state:

```text
claim PGMQ message / commit visibility claim
        |
        v
new transaction
  -> load event
  -> check receipt
  -> apply module-local projection/state
  -> insert receipt
  -> pgmq.archive(message)
  -> COMMIT
```

Because `pgmq.archive()` is also PostgreSQL SQL, the local effect, receipt and queue acknowledgement can commit atomically.

If the receipt already exists, archive the duplicate queue message and return success.

### Queue claim transaction

`pgmq.read()` changes visibility/read count. A worker should commit the claim before performing potentially failing or slow work so an application rollback does not accidentally make the message immediately hot again.

Read only bounded quantities whose work can complete inside the selected visibility window.

For long work, use a dedicated durable job record instead of holding one queue claim for an arbitrarily long process.

## 7. Projection consumers

Cross-module projections such as Updates and Audit are ordinary idempotent consumers.

### Updates

Publication/LifeHistory/editorial integration events feed the Updates module.

Updates owns its public-safe return-loop items and personalized eligibility state; it does not read producers' private repositories directly.

### Audit

Audit consumes durable security/business facts into its unified evidence projection.

Audit failure never rolls back the already committed source business transaction; its queue remains pending/retriable.

This preserves #310's rule that Audit is downstream evidence, not a business-state dependency.

### Notification

Notification consumes relevant integration events into **Notification-owned durable intent/job state**.

Upstream modules never call an email transport and never enqueue directly into `notification_deliveries`.

## 8. External side effects

### Two-stage model

Remote side effects use two durable stages:

```text
Integration Event
      |
      v
Notification consumer transaction
  -> create Notification intent / delivery job
  -> enqueue notification_delivery work
  -> consumer receipt
  -> archive integration message
      |
      v
Notification delivery worker
  -> call provider
  -> record attempt/result
```

This prevents an email/API call from being part of another module's transaction.

### Provider idempotency

For remote APIs, use a stable provider idempotency key derived from the PandaAtlas delivery/job ID where the provider supports it.

When a provider does not support strong idempotency, the adapter must record provider message IDs/results and provide reconciliation rather than claiming exactly-once delivery.

### Never hold a database transaction open around slow remote work

The queue claim may be durable, but the external call itself is not wrapped in one long producer/consumer database transaction.

Persist state transitions and attempts in short transactions before/after the remote call.

## 9. PGMQ queue model

Use **Basic/durable logged queues** for all PandaAtlas business work.

Do not use unlogged queues for:

- Notifications;
- Audit;
- Updates;
- publication/release work;
- privacy work;
- integration dispatch.

The current Supabase Queues documentation distinguishes Basic durable queues from Unlogged queues that trade durability for throughput. PandaAtlas prefers durability.

### Private queues only

Keep `pgmq` private to server-side PostgreSQL roles.

Do not expose `pgmq_public` to browser clients.

Browser actions go through Nest application commands, which write authoritative state/Outbox.

### Queue categories

Prefer queues by **consumer/work responsibility**, not one queue per event type.

Conceptual baseline:

```text
integration_updates
integration_notification
integration_audit

notification_delivery
notification_webhook

media_processing           # only if #316/#318 needs it
privacy_jobs               # if heavy privacy work needs a worker
publication_jobs           # if #317 needs bounded async release work
```

The final queue list should stay small and be justified by distinct retry/concurrency/latency behavior.

## 10. Retry policy

### General rules

Every worker class declares:

```text
visibility timeout
max attempts
base backoff
max backoff
retryable error taxonomy
DLQ policy
batch size
maximum run budget
```

These are code/config policy, not arbitrary runtime values supplied by users.

### Backoff

Use bounded exponential backoff with jitter where appropriate.

Conceptually:

```text
base * 2^(attempt-1), capped
```

The current Notification worker's bounded exponential backoff is a useful behavior to preserve.

Use `pgmq.set_vt()` to defer retry of a claimed message.

### Retry classification

Retry only errors likely to succeed later, for example:

- temporary provider/network failure;
- 429/rate limit;
- selected 5xx dependency errors;
- temporary database/runtime unavailability.

Do not retry indefinitely:

- invalid event/job schema;
- missing permanently required business state;
- unsupported event version;
- authorization/configuration errors requiring operator action;
- non-retryable provider rejection.

### Worker crash

If a worker dies after a message has been claimed but before it is archived, visibility eventually expires and another worker may receive it.

That is expected behavior and is why receipt/job idempotency is mandatory.

## 11. Dead-letter handling

Use a dedicated durable DLQ for work that cannot be processed automatically after bounded attempts or fails validation permanently.

Naming convention:

```text
<queue>_dlq
```

A DLQ message contains a safe diagnostic envelope such as:

```text
sourceQueue
sourceMessageId
eventId/jobId
attempts
failureCode
failedAt
correlationId
```

Do not copy secrets/private bodies into the DLQ for debugging convenience.

### Atomic DLQ transfer

When possible, in one PostgreSQL transaction:

1. insert/send the DLQ message;
2. persist the terminal job/dead-letter state;
3. archive the source queue message;
4. commit.

### Replay

DLQ replay is an explicit operator command/tool:

- fix the underlying cause first;
- create a new queue message referencing the same event/job identity;
- reset or increment the job attempt cycle explicitly;
- preserve old attempt/dead-letter evidence.

Never delete history to make a failed job look fresh.

## 12. Worker execution model

V2 separates **short bounded pumps** from **long/heavy batch jobs**.

### A. User request execution

The Nest request path may:

- validate command;
- perform authoritative PostgreSQL transaction;
- append Outbox events;
- return `200/201/202/204` as appropriate.

It must not:

- poll PGMQ;
- dispatch a backlog;
- send arbitrary batches of email;
- run crawling/enrichment;
- build a release artifact synchronously when it can exceed the request budget;
- depend on post-response background execution for correctness.

### B. Vercel Cron: short bounded pumps

Use Vercel Cron only for worker operations that are:

- short;
- bounded by message count and wall-clock budget;
- idempotent;
- resumable from PostgreSQL/PGMQ;
- safe if a cron invocation is duplicated or omitted once.

Candidate pumps:

```text
outbox dispatch
Updates projector
Audit projector
Notification event->intent projector
small notification delivery batches
webhook processing
```

Current Vercel documentation states Cron invokes a Vercel Function, does not retry failed cron invocations, can overlap invocations, and can occasionally deliver the same cron event more than once. Therefore correctness lives in PostgreSQL locks/PGMQ/idempotency, not the scheduler.

### Vercel Cron frequency

As of this research, Vercel Pro/Enterprise can schedule per-minute Cron jobs; Hobby is limited to once per day.

Minute-level queue processing is therefore a **deployment-plan prerequisite** to validate in #318 if PandaAtlas needs near-real-time notifications/updates.

Do not quietly degrade to once-daily execution on Hobby.

### Internal worker endpoint

A Vercel Cron invocation may call a version-neutral internal endpoint such as:

```text
/internal/workers/pump
```

It is not part of the public V2 API contract and is protected by a dedicated scheduler secret (`CRON_SECRET` or equivalent platform-bound secret), not a fake user JWT.

The endpoint runs a bounded set of known worker pumps and returns a result summary.

It cannot accept arbitrary queue names/SQL/scripts from the request.

### C. GitHub Actions: long/heavy batch work

GitHub Actions remains the default managed execution plane for work that is inappropriate for a short Vercel function, including:

- crawling/acquisition batches;
- enrichment/research pipelines;
- heavy media processing;
- large release-building/rebuild workflows if #317 requires them;
- long reconciliation/maintenance jobs;
- bulk privacy export/deletion phases when bounded Vercel execution is unsuitable.

Workers run as **bounded CLI commands** against durable job/queue state.

Conceptually:

```text
pnpm worker outbox-dispatch --limit 500
pnpm worker notification-delivery --limit 200
python -m panda_data ...
```

Exact commands/package ownership are #316/#320.

### GitHub schedule semantics

GitHub Actions scheduled workflows are useful for eventually draining durable batch work, but they are not a precise timer:

- the minimum schedule interval is five minutes;
- scheduled workflows can be delayed during high load;
- in sufficiently high load, queued scheduled jobs may be dropped.

Therefore a scheduled workflow never represents the business fact "this job happened".

The business job already exists durably in PostgreSQL/PGMQ. A later workflow invocation simply drains pending work.

Missing one schedule tick leaves work pending for the next run.

### GitHub concurrency

Use workflow/job `concurrency` groups for batch classes that must not overlap.

Even with scheduler concurrency controls, worker code remains idempotent because re-runs/manual runs/crashes can still duplicate execution attempts.

## 13. `waitUntil()` policy

Vercel Fluid Compute supports `waitUntil()` background execution after a response.

PandaAtlas does **not** use it for durable business work.

Allowed examples:

- best-effort telemetry flush;
- non-authoritative log enrichment;
- opportunistic cache invalidation where loss is harmless.

Forbidden examples:

- sending a required notification;
- emitting Audit evidence;
- persisting an Outbox event;
- publishing a release;
- deleting private data;
- queue dispatch that must eventually happen.

Reason: even though the runtime can continue after the response, work still has execution/runtime limits. Durability belongs in PostgreSQL/PGMQ before the response completes.

## 14. Worker code ownership

Worker **business logic remains in the owning module**.

The worker runtime only provides infrastructure:

```text
queue read/claim
transaction scope
message validation
receipt/idempotency helper
retry/backoff helper
DLQ helper
logging/metrics context
run-budget helper
```

Examples:

- Updates owns how a publication event becomes an update item.
- Notification owns how an event becomes a Notification intent/delivery.
- Audit owns how a fact becomes audit evidence.

Do not create a generic `workers` business module that contains all domain behavior.

## 15. Suggested worker platform interfaces

Conceptually:

```ts
interface OutboxWriter {
  append(tx: TransactionScope, event: IntegrationEvent): Promise<void>;
}

interface IntegrationEventStore {
  get(eventId: string): Promise<IntegrationEvent>;
}

interface QueueClient {
  send(queue: QueueKey, message: QueueMessage): Promise<QueueMessageId>;
  read(queue: QueueKey, options: ReadOptions): Promise<ClaimedMessage[]>;
  changeVisibility(...): Promise<void>;
  archive(...): Promise<void>;
}

interface ConsumerReceiptStore {
  hasProcessed(consumer: ConsumerKey, eventId: string): Promise<boolean>;
  recordProcessed(tx: TransactionScope, ...): Promise<void>;
}
```

Concrete types stay inside the infrastructure layer. Business modules do not import raw `pgmq` table names or Kysely platform internals.

## 16. Event ordering

Do not promise global event ordering.

Where one aggregate requires causal ordering:

- include aggregate version;
- consumers compare versions/current state;
- make updates idempotent;
- reject/defer an impossible version gap only when the consumer truly requires contiguous ordering.

PGMQ FIFO behavior is helpful but is not a substitute for domain version checks under retries/concurrent consumers.

## 17. Concurrency and duplicate processing

Worker correctness assumes:

```text
multiple dispatchers can run
multiple consumers can run
cron can overlap
workflow can be retried
process can crash between network and DB
message can reappear
```

Therefore:

- claim with PGMQ visibility semantics;
- use DB uniqueness/receipt constraints;
- prefer deterministic job IDs/idempotency keys;
- lock only the minimum rows;
- never rely on process memory locks;
- avoid a Redis lock merely to make one scheduler appear singleton.

For the Vercel Cron pump, overlapping invocations are safe because queue/database claims are the concurrency control.

## 18. Queue monitoring

At minimum monitor per queue:

```text
visible queue length
oldest visible message age
in-flight/visibility-delayed messages when available
read count / retry distribution
DLQ depth
processed/succeeded/failed rates
worker run duration
outbox undispatched count
oldest undispatched event age
```

Supabase PGMQ exposes queue metrics and keeps archived messages for inspection/replay support.

Exact dashboards/alerts belong to #319.

## 19. Backpressure

Each consumer owns its own queue so one slow subsystem does not stop all other consumers.

Example:

```text
Audit slow          -> integration_audit grows
Notification slow   -> integration_notification grows
Updates healthy     -> integration_updates continues
```

This is another reason not to use one generic `integration_events` queue.

Worker batch size/concurrency can be tuned independently per queue.

## 20. Event failure isolation

A source command succeeds once its authoritative transaction and Outbox append commit.

A downstream failure does not retroactively fail the source command.

Example:

```text
Release activated + Outbox committed
        |
        +-- Updates consumer succeeds
        +-- Audit consumer succeeds
        `-- Notification consumer temporarily fails
```

The release remains activated. Notification work stays queued/retries.

If the business rule requires downstream work before the command can be considered successful, that work is not an eventual integration event; it belongs in the source command's immediate consistency boundary or an explicit workflow state.

## 21. Commands versus events versus jobs

Keep the vocabulary strict.

### Command

A request to perform behavior:

```text
PublishRelease
SubmitContribution
ApplySanction
```

May fail because current state does not allow it.

### Event

A fact that already happened:

```text
ReleaseActivated
ContributionSubmitted
SanctionApplied
```

Immutable historical statement.

### Job

A durable unit of execution needed to realize a technical or downstream effect:

```text
DeliverEmail
BuildReleaseArtifact
GeneratePrivacyExport
```

Retryable and operational.

Do not publish commands as integration events merely to ask another module to do work. If one module legitimately requests another business capability, use its application interface synchronously or define a durable workflow/job with explicit ownership.

## 22. Notification-specific V2 direction

Keep the strong parts of the current worker design:

- delivery job state;
- attempt history;
- retryability classification;
- bounded backoff;
- PGMQ visibility timeout;
- DLQ;
- provider webhook ingestion;
- suppression checks;
- immutable attempt evidence.

Change the architecture around it:

- Notification receives integration events through `integration_notification`, not by directly scanning arbitrary Outbox rows;
- upstream modules never create delivery jobs;
- queue helpers move into shared worker infrastructure;
- Notification repository is split between application persistence and transport worker persistence instead of one very large repository;
- event->intent processing is separated from provider delivery;
- V1 Activity/Feed event names are replaced with V2 Updates/domain vocabulary.

## 23. Audit-specific V2 direction

Audit is an integration-event consumer plus explicit security/sensitive-read evidence source.

For business integration events:

```text
source module
 -> Outbox
 -> integration_audit
 -> Audit projection
```

For security-sensitive reads/actions that are not naturally business integration events, the owning module/security layer emits a dedicated durable audit fact through the same Outbox mechanism or a narrow Audit evidence port as finalized in #319.

Audit must not become a synchronous dependency required by every normal command.

## 24. Python relationship

This ticket fixes the runtime semantics but intentionally does not decide the full Python contract shape.

Rules already fixed for #316:

- Python cannot import Nest domain classes;
- cross-runtime durable facts/jobs use language-neutral schemas;
- Python can produce/consume through PostgreSQL/PGMQ using the same envelope/job semantics;
- Python long-running workflows run outside the Nest request process;
- Python does not need its own message broker.

Exact `contracts/events`, job schemas, CLI/package boundary and database credentials are #316.

## 25. Security

- Integration and PGMQ schemas remain private from `anon`/`authenticated` browser roles.
- Worker endpoints are not user-authenticated admin APIs.
- Vercel Cron scheduler authentication uses one narrowly scoped secret and fixed worker route.
- GitHub Actions uses deployment secrets/OIDC-backed environment configuration as finalized by #318.
- Queue payloads never carry user bearer credentials.
- A worker reconstructs required current authorization/business state rather than trusting stale capability snapshots in events.

## 26. Why not Redis/BullMQ

Rejected for V2 baseline.

PandaAtlas already has PostgreSQL as its authoritative store and Supabase provides PGMQ as a Postgres-native durable queue.

Adding Redis/BullMQ would introduce:

- another managed datastore;
- another credential/availability/backup surface;
- cross-system transactional Outbox relay complexity;
- no current workload requirement that PGMQ cannot meet.

Revisit only with measured queue throughput/latency requirements that PGMQ cannot satisfy.

## 27. Why not Kafka/RabbitMQ/SQS

Rejected for the same reason: there is no evidence PandaAtlas needs a distributed streaming platform or external broker.

The modular monolith has a small known set of consumers and one authoritative Postgres database.

PGMQ gives sufficient durability, visibility timeout and fan-out execution when paired with the Outbox Dispatcher.

## 28. Why not direct Outbox polling by every module

Rejected.

If every consumer scans `integration.outbox_events` independently:

- each module invents its own receipt/locking/query logic;
- Outbox indexing/query load grows with consumer count;
- backpressure is difficult to observe independently;
- consumer retry semantics become coupled to the shared event table;
- a slow consumer cannot be tuned as cleanly as its own queue.

The dispatcher converts the event log into per-consumer runnable queues once.

## 29. Why not one `integration_events` queue

Rejected as the final cross-module topology.

A work queue is not broadcast pub/sub.

A single message cannot simultaneously be the durable independent work item for Updates, Notification and Audit.

A dispatcher with consumer-specific queues gives explicit fan-out, independent retries, independent DLQs and backpressure.

The current `integration_events` queue is therefore a V1 foundation artifact to retire/replace, not a V2 architectural primitive.

## 30. Why not rely on Vercel `waitUntil()`

Rejected for durable behavior.

Vercel supports background execution after response, but it still runs inside a bounded function lifecycle. PandaAtlas already has a durable database and queue; committing intent before returning is simpler to reason about and recover.

## 31. Why not run everything in GitHub Actions

Rejected.

GitHub Actions is well suited to bounded batch work, but scheduled workflows have a minimum five-minute interval and can be delayed/dropped during high load.

That is too weak for the only low-latency Notification/Updates pump.

Use GitHub Actions for heavy/eventually-drained work; use short Vercel Cron pumps for minute-level queue work when the deployment plan supports it.

## 32. Why not run everything in Vercel Functions

Rejected.

Vercel can now run long Node/Python functions, including up to 30 minutes in some Pro/Enterprise configurations, but this does not make user-facing API functions the right home for crawling, large media/research/rebuild pipelines.

Long/heavy work belongs in batch execution so request scaling, deployment lifecycle and queue draining remain independent.

## 33. Managed execution matrix

| Work | Durability source | Execution plane | Latency target | Notes |
| --- | --- | --- | --- | --- |
| Authoritative command | PostgreSQL transaction | Nest/Vercel request | immediate | state + Outbox only |
| Outbox fan-out | Outbox | Vercel Cron bounded pump | ~minute | DB-only |
| Updates projection | PGMQ + Outbox | Vercel Cron bounded pump | ~minute | DB-only |
| Audit projection | PGMQ + Outbox | Vercel Cron bounded pump | minutes | DB-only |
| Notification intent | PGMQ + Outbox | Vercel Cron bounded pump | ~minute | DB-only |
| Email delivery | Notification job + PGMQ | Vercel Cron bounded pump | minutes | remote provider, bounded |
| Webhook processing | PGMQ + stored webhook | Vercel Cron bounded pump | minutes | idempotent |
| Crawling/enrichment | durable Python job/checkpoint | GitHub Actions | batch | #316 |
| Heavy media/rebuild | durable job/checkpoint | GitHub Actions | batch | no request-bound execution |
| Large maintenance/reconciliation | durable DB job | GitHub Actions | batch | concurrency group |

The exact cadence, Vercel plan and deployment configuration are validated in #318.

## 34. Vercel runtime facts checked

As of 2026-08-26:

- Vercel Fluid Compute supports background processing primitives such as `waitUntil()`;
- Vercel Functions remain bounded by maximum duration;
- Vercel Cron invokes ordinary Vercel Functions;
- Vercel Cron does not automatically retry failed invocations;
- overlapping and duplicate Cron invocations are possible, so jobs must be idempotent;
- Pro/Enterprise support per-minute Cron schedules, while Hobby is once daily;
- Vercel Node/Python Functions can support longer durations, with up to 30-minute execution available in selected Pro/Enterprise Fluid Compute configurations.

These capabilities make bounded queue pumps viable but do not change the decision to keep durable intent in PostgreSQL/PGMQ and heavy jobs outside the user request path.

## 35. Supabase/PGMQ facts checked

Current Supabase Queues documentation confirms:

- Queues are Postgres-native and built on PGMQ;
- Basic queues are durable logged queues;
- messages remain until explicitly archived/deleted;
- read uses a visibility timeout;
- queues are pull-based;
- queue tables are private by default unless explicitly exposed;
- Supabase documents Edge Function consumers plus Cron as one possible execution model.

PandaAtlas uses the queue primitives but keeps worker logic in the Nest/TS or Python execution planes already selected for the project; no Supabase Edge Function tier is added merely because it is available.

## 36. GitHub Actions facts checked

Current GitHub documentation confirms:

- scheduled workflows use cron and have a minimum five-minute interval;
- scheduled events may be delayed at high-load times and can in some cases be dropped;
- workflow/job concurrency groups can limit overlap.

Therefore GitHub schedule is treated as a **wake-up mechanism for durable pending work**, not as a durable scheduler/event source.

## 37. Migration direction from V1

V2 should replace, not wrap, the current event plumbing.

### Preserve behavior/concepts

- integration event envelope identity/version/correlation/causation;
- transactional Outbox;
- private integration/PGMQ access;
- visibility-timeout retries;
- bounded exponential backoff;
- DLQ;
- immutable transport attempt evidence;
- PGMQ metrics;
- bounded CLI worker execution.

### Remove/rewrite

- direct Outbox INSERT SQL copied into domain repositories;
- modules directly scanning Outbox as their normal consumer transport;
- generic shared `integration_events` queue as event bus;
- Activity/Feed consumers superseded by Updates;
- worker/business logic concentrated in large repository classes;
- any request handler invoking worker loops;
- any correctness dependency on post-response callbacks;
- duplicated queue helper SQL in each module.

## 38. Testing requirements

Detailed test organization is #319, but this architecture requires tests proving:

### Producer/outbox

- business state + Outbox commit atomically;
- rollback removes both;
- idempotent command does not duplicate Outbox event;
- event envelope version/shape validation.

### Dispatcher

- one event fans to every registered consumer exactly once per dispatcher transaction;
- concurrent dispatchers do not double-enqueue a committed event;
- crash/rollback before dispatch commit leaves event undispatched and no queue sends persisted;
- unknown routing configuration is surfaced, not silently dropped.

### Consumer

- duplicate queue message does not duplicate projection/state;
- DB state + receipt + archive are atomic for DB-only handlers;
- unsupported event version goes to terminal failure/DLQ policy;
- transient errors retry after visibility/backoff;
- max attempts go to DLQ;
- worker crash produces safe redelivery.

### External delivery

- provider timeout/retry behavior;
- idempotency/reconciliation behavior;
- terminal provider rejection;
- duplicate delivery message;
- webhook duplicate/conflicting provider event ID.

### Scheduling

- overlapping worker pump invocations are safe;
- a missed scheduler invocation leaves work pending;
- batch limits/run budgets stop cleanly without losing work.

## 39. External references checked

- Supabase Queues overview: https://supabase.com/docs/guides/queues
- Supabase PGMQ extension: https://supabase.com/docs/guides/queues/pgmq
- Supabase Queues quickstart: https://supabase.com/docs/guides/queues/quickstart
- Supabase consuming queue messages: https://supabase.com/docs/guides/queues/consuming-messages-with-edge-functions
- Supabase Cron: https://supabase.com/docs/guides/cron
- Vercel Fluid Compute: https://vercel.com/docs/fluid-compute
- Vercel Cron management: https://vercel.com/docs/cron-jobs/manage-cron-jobs
- Vercel Cron usage/limits: https://vercel.com/docs/cron-jobs/usage-and-pricing
- Vercel Function duration: https://vercel.com/docs/functions/configuring-functions/duration
- Vercel Functions 30-minute update: https://vercel.com/changelog/vercel-functions-can-now-run-up-to-30-minutes
- GitHub Actions workflow scheduling: https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run
- GitHub Actions troubleshooting scheduled workflows: https://docs.github.com/en/actions/how-tos/troubleshoot-workflows
- GitHub Actions concurrency: https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency

## Decisions deferred to other Wayfinder tickets

- Exact language-neutral event/job JSON Schema package and Python producer/consumer seam: #316.
- Exact public-release projection consumers and whether release building needs a dedicated queue/job: #317.
- Vercel plan, cron cadence, regions, secrets, worker endpoint deployment and real PGMQ smoke: #318.
- Metrics/alerts/traces, error taxonomy, DLQ operator UI/runbooks and architecture-test gates: #319.
- Exact TypeScript package/CLI layout and script names: #320.
- Legacy worker deletion order and V1/V2 simultaneous processing rules during cutover: #321.

## Acceptance for #315

The event/background architecture is resolved when later planning can assume all of the following without reopening this decision:

- domain events are module-local synchronous facts and are not a cross-module Nest event bus;
- every durable cross-module asynchronous fact is a versioned integration event appended to the transactional Outbox in the producer transaction;
- one shared platform Outbox writer replaces duplicated module SQL;
- the Outbox is the authoritative replay history and `dispatchedAt` means fan-out completed, not consumer processing completed;
- one Outbox Dispatcher fans events into consumer-specific durable PGMQ queues atomically inside PostgreSQL;
- the generic V1 `integration_events` queue is not the V2 broadcast topology;
- consumer queues are pull-based work queues with independent backpressure/retry/DLQ behavior;
- all consumers are idempotent and use event receipts/job uniqueness; PandaAtlas does not claim globally exactly-once side effects;
- DB-only consumer effect + receipt + PGMQ archive commit atomically where possible;
- external side effects use module-owned durable job state and dedicated worker queues rather than executing in producer transactions;
- retry uses bounded attempts, visibility timeout, exponential backoff and stable retry classification;
- terminal/poison work moves atomically to a durable DLQ while preserving attempt evidence;
- queue claims, worker batches and schedulers are safe under overlap, duplicate invocation and crash/redelivery;
- Vercel user requests never poll queues or rely on `waitUntil()` for durable business correctness;
- Vercel Cron is reserved for short bounded idempotent queue pumps, subject to #318 plan/cadence validation;
- GitHub Actions is the managed plane for long/heavy batch work and drains durable pending jobs rather than representing the durable schedule itself;
- PGMQ remains private server-side infrastructure and no Redis/Kafka/RabbitMQ/SQS is added in the V2 baseline;
- Python reuses the same durable semantics through language-neutral contracts to be finalized in #316.
