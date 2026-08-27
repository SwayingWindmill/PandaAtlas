import type { DatabaseService } from "../../../platform/database/database.service.js";
import type { IntegrationOutboxService } from "../../../platform/integration/integration-outbox.service.js";
import type {
  CreatePrivacyRequestInput,
  PrivacyExportRecord,
  PrivacyRepository,
  PrivacyRequestKind,
  PrivacyRequestRecord,
  PrivacyRequestState,
} from "../application/privacy.application.js";

const PARTICIPANT_KEYS = ["engagement", "game", "notification", "identity"] as const;

export class PostgresPrivacyRepository implements PrivacyRepository {
  public constructor(
    private readonly database: DatabaseService,
    private readonly outbox: IntegrationOutboxService,
  ) {}

  public async create(accountId: string, input: CreatePrivacyRequestInput): Promise<PrivacyRequestRecord> {
    return this.database.transaction(async (transaction) => {
      const inserted = await transaction
        .insertInto("privacy.subject_requests")
        .values({
          account_id: accountId,
          kind: input.kind,
          reason: input.reason,
          idempotency_key: input.idempotencyKey,
          correlation_id: input.correlationId,
        })
        .onConflict((conflict) => conflict.columns(["account_id", "idempotency_key"]).doNothing())
        .returningAll()
        .executeTakeFirst();
      if (inserted === undefined) {
        const existing = await transaction
          .selectFrom("privacy.subject_requests")
          .selectAll()
          .where("account_id", "=", accountId)
          .where("idempotency_key", "=", input.idempotencyKey)
          .executeTakeFirstOrThrow();
        return this.mapRequest(existing);
      }

      await transaction
        .insertInto("privacy.subject_request_steps")
        .values(PARTICIPANT_KEYS.map((participantKey) => ({ request_id: inserted.request_id, participant_key: participantKey })))
        .execute();
      await transaction
        .insertInto("privacy.subject_request_events")
        .values({
          request_id: inserted.request_id,
          event_type: "privacy.request.created",
          previous_state: null,
          next_state: "pending",
          correlation_id: input.correlationId,
        })
        .execute();
      await this.outbox.append(transaction, {
        eventType: "privacy.request.created",
        sourceContext: "privacy",
        aggregateType: "privacy_request",
        aggregateId: inserted.request_id,
        idempotencyKey: `request-created:${inserted.request_id}`,
        correlationId: input.correlationId,
        occurredAt: inserted.requested_at,
        payload: { requestId: inserted.request_id, accountId, kind: input.kind },
      });
      return this.mapRequest(inserted);
    });
  }

  public async get(accountId: string, requestId: string): Promise<PrivacyRequestRecord | undefined> {
    const row = await this.database.db
      .selectFrom("privacy.subject_requests")
      .selectAll()
      .where("account_id", "=", accountId)
      .where("request_id", "=", requestId)
      .executeTakeFirst();
    return row === undefined ? undefined : this.mapRequest(row);
  }

  public async getExport(accountId: string, requestId: string): Promise<PrivacyExportRecord | undefined> {
    const row = await this.database.db
      .selectFrom("privacy.export_snapshots as snapshot")
      .innerJoin("privacy.subject_requests as request", "request.request_id", "snapshot.request_id")
      .select(["snapshot.request_id", "snapshot.created_at", "snapshot.expires_at", "snapshot.payload"])
      .where("request.account_id", "=", accountId)
      .where("snapshot.request_id", "=", requestId)
      .where("snapshot.expires_at", ">", new Date())
      .executeTakeFirst();
    if (row === undefined) return undefined;
    return {
      requestId: row.request_id,
      createdAt: row.created_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      payload: row.payload as Record<string, unknown>,
    };
  }

  private mapRequest(row: {
    request_id: string;
    kind: string;
    state: string;
    reason: string;
    requested_at: Date;
    updated_at: Date;
    completed_at: Date | null;
    failed_at: Date | null;
    failure_code: string | null;
  }): PrivacyRequestRecord {
    return {
      requestId: row.request_id,
      kind: row.kind as PrivacyRequestKind,
      state: row.state as PrivacyRequestState,
      reason: row.reason,
      requestedAt: row.requested_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      ...(row.completed_at === null ? {} : { completedAt: row.completed_at.toISOString() }),
      ...(row.failed_at === null ? {} : { failedAt: row.failed_at.toISOString() }),
      ...(row.failure_code === null ? {} : { failureCode: row.failure_code }),
    };
  }
}
