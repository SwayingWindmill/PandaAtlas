import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { DatabaseService } from "../database/database.service.js";
import type { PgmqQueue } from "../integration/pgmq.service.js";

// The Cron Trigger runs a cycle every five minutes; work still waiting after four missed cycles
// means async downstream has stalled (#560).
export const ASYNC_DOWNSTREAM_STALL_SECONDS = 20 * 60;

const CONSUMED_QUEUES: readonly PgmqQueue[] = [
  "integration_updates",
  "integration_notification",
  "integration_audit",
  "integration_public_cache",
  "notification_provider",
];

export class AsyncDownstreamStalledError extends Error {
  public constructor(source: string, waitingSeconds: number) {
    super(`Async downstream work from ${source} has waited ${waitingSeconds}s`);
    this.name = "AsyncDownstreamStalledError";
  }
}

// Due work nobody has consumed: undispatched outbox events, visible queue messages (a deferred retry
// is invisible until its backoff ends) and pending privacy requests.
@Injectable()
export class AsyncDownstreamHealth {
  public constructor(private readonly database: DatabaseService) {}

  public async check(): Promise<void> {
    const queues = CONSUMED_QUEUES.map(
      (queue) => sql`select ${queue}::text as source, min(enqueued_at) as oldest from ${sql.table(`pgmq.q_${queue}`)} where vt <= now()`,
    );
    const result = await sql<{ source: string; waiting_seconds: number }>`
      select source, floor(extract(epoch from now() - oldest))::int as waiting_seconds
      from (
        select 'outbox'::text as source, min(available_at) as oldest
        from integration.outbox_events where published_at is null and available_at <= now()
        union all ${sql.join(queues, sql` union all `)}
        union all
        select 'privacy_requests'::text, min(requested_at) from privacy.subject_requests where state = 'pending'
      ) backlog
      where oldest is not null
      order by oldest
      limit 1
    `.execute(this.database.db);
    const oldest = result.rows[0];
    if (oldest !== undefined && oldest.waiting_seconds > ASYNC_DOWNSTREAM_STALL_SECONDS) {
      throw new AsyncDownstreamStalledError(oldest.source, oldest.waiting_seconds);
    }
  }
}
