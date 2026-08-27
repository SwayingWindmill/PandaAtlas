import { sql } from "kysely";
import type { JsonObject } from "../../../platform/database/database.privacy.generated.js";
import type { DatabaseService, DatabaseTransaction } from "../../../platform/database/database.service.js";
import type { IntegrationOutboxService } from "../../../platform/integration/integration-outbox.service.js";
import type { EngagementPrivacyPort } from "../../engagement/application/engagement-privacy.port.js";
import type { GamePrivacyPort } from "../../game/application/game-privacy.port.js";
import type { IdentityPrivacyPort } from "../../identity/application/identity-privacy.port.js";
import type { NotificationPrivacyPort } from "../../notification/application/notification-privacy.port.js";

class PrivacyParticipantFailure extends Error {
  public constructor(
    public readonly participantKey: string,
    cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : "Privacy participant failed");
    this.name = "PrivacyParticipantFailure";
  }
}

export interface PrivacyProcessorResult {
  selected: number;
  completed: number;
  failed: number;
  skipped: number;
}

export class PrivacyRequestProcessorService {
  public constructor(
    private readonly database: DatabaseService,
    private readonly outbox: IntegrationOutboxService,
    private readonly identity: IdentityPrivacyPort,
    private readonly engagement: EngagementPrivacyPort,
    private readonly game: GamePrivacyPort,
    private readonly notification: NotificationPrivacyPort,
  ) {}

  public async processBatch(limit = 5): Promise<PrivacyProcessorResult> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
      throw new Error("Privacy processor limit must be an integer between 1 and 20");
    }
    const rows = await this.database.db
      .selectFrom("privacy.subject_requests")
      .select("request_id")
      .where("state", "=", "pending")
      .orderBy("requested_at")
      .orderBy("request_id")
      .limit(limit)
      .execute();
    const result: PrivacyProcessorResult = { selected: rows.length, completed: 0, failed: 0, skipped: 0 };
    for (const row of rows) {
      try {
        const completed = await this.processRequest(row.request_id);
        result[completed ? "completed" : "skipped"] += 1;
      } catch (error) {
        await this.markFailed(row.request_id, error);
        result.failed += 1;
      }
    }
    return result;
  }

  private async processRequest(requestId: string): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const request = await transaction
        .selectFrom("privacy.subject_requests")
        .selectAll()
        .where("request_id", "=", requestId)
        .forUpdate()
        .executeTakeFirst();
      if (request === undefined || request.state !== "pending") return false;

      const processingAt = new Date();
      await transaction
        .updateTable("privacy.subject_requests")
        .set({ state: "processing", updated_at: processingAt })
        .where("request_id", "=", requestId)
        .executeTakeFirstOrThrow();
      await transaction
        .insertInto("privacy.subject_request_events")
        .values({
          request_id: requestId,
          event_type: "privacy.request.processing",
          previous_state: "pending",
          next_state: "processing",
          correlation_id: request.correlation_id,
        })
        .execute();

      if (request.kind === "access_export") {
        const identity = await this.runParticipant("identity", () =>
          this.identity.exportPrivacySubject(transaction, request.account_id),
        );
        await this.completeStep(transaction, requestId, "identity");
        const engagement = await this.runParticipant("engagement", () =>
          this.engagement.exportPrivacySubject(transaction, request.account_id),
        );
        await this.completeStep(transaction, requestId, "engagement");
        const game = await this.runParticipant("game", () =>
          this.game.exportPrivacySubject(transaction, request.account_id),
        );
        await this.completeStep(transaction, requestId, "game");
        const notification = await this.runParticipant("notification", () =>
          this.notification.exportPrivacySubject(transaction, request.account_id),
        );
        await this.completeStep(transaction, requestId, "notification");
        await transaction
          .insertInto("privacy.export_snapshots")
          .values({
            request_id: requestId,
            account_id: request.account_id,
            payload: { identity, engagement, game, notification } as JsonObject,
          })
          .execute();
      } else if (request.kind === "account_deletion") {
        await this.runParticipant("engagement", () =>
          this.engagement.erasePrivacySubject(transaction, request.account_id),
        );
        await this.completeStep(transaction, requestId, "engagement");
        await this.runParticipant("game", () => this.game.erasePrivacySubject(transaction, request.account_id));
        await this.completeStep(transaction, requestId, "game");
        await this.runParticipant("notification", () =>
          this.notification.erasePrivacySubject(transaction, request.account_id),
        );
        await this.completeStep(transaction, requestId, "notification");
        await this.runParticipant("identity", () =>
          this.identity.erasePrivacySubject(transaction, request.account_id, requestId, request.correlation_id),
        );
        await this.completeStep(transaction, requestId, "identity");
      } else {
        throw new Error(`Unsupported privacy request kind ${request.kind}`);
      }

      const completedAt = new Date();
      await transaction
        .updateTable("privacy.subject_requests")
        .set({ state: "completed", completed_at: completedAt, updated_at: completedAt })
        .where("request_id", "=", requestId)
        .executeTakeFirstOrThrow();
      await transaction
        .insertInto("privacy.subject_request_events")
        .values({
          request_id: requestId,
          event_type: "privacy.request.completed",
          previous_state: "processing",
          next_state: "completed",
          correlation_id: request.correlation_id,
        })
        .execute();
      await this.outbox.append(transaction, {
        eventType: "privacy.request.completed",
        sourceContext: "privacy",
        aggregateType: "privacy_request",
        aggregateId: requestId,
        idempotencyKey: `request-completed:${requestId}`,
        correlationId: request.correlation_id,
        occurredAt: completedAt,
        payload: { requestId, accountId: request.account_id, kind: request.kind },
      });
      return true;
    });
  }

  private async markFailed(requestId: string, error: unknown): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const request = await transaction
        .selectFrom("privacy.subject_requests")
        .select(["state", "correlation_id", "account_id", "kind"])
        .where("request_id", "=", requestId)
        .forUpdate()
        .executeTakeFirst();
      if (request === undefined || request.state !== "pending") return;
      const participantKey = error instanceof PrivacyParticipantFailure ? error.participantKey : undefined;
      const failureCode = participantKey === undefined ? "privacy_processing_failed" : `privacy_${participantKey}_failed`;
      const failedAt = new Date();
      if (participantKey !== undefined) {
        await transaction
          .updateTable("privacy.subject_request_steps")
          .set({
            state: "failed",
            attempts: sql<number>`attempts + 1`,
            last_error_code: failureCode,
            updated_at: failedAt,
          })
          .where("request_id", "=", requestId)
          .where("participant_key", "=", participantKey)
          .executeTakeFirstOrThrow();
      }
      await transaction
        .updateTable("privacy.subject_requests")
        .set({ state: "failed", failed_at: failedAt, failure_code: failureCode, updated_at: failedAt })
        .where("request_id", "=", requestId)
        .executeTakeFirstOrThrow();
      await transaction
        .insertInto("privacy.subject_request_events")
        .values({
          request_id: requestId,
          event_type: "privacy.request.failed",
          previous_state: "pending",
          next_state: "failed",
          error_code: failureCode,
          correlation_id: request.correlation_id,
        })
        .execute();
      await this.outbox.append(transaction, {
        eventType: "privacy.request.failed",
        sourceContext: "privacy",
        aggregateType: "privacy_request",
        aggregateId: requestId,
        idempotencyKey: `request-failed:${requestId}`,
        correlationId: request.correlation_id,
        occurredAt: failedAt,
        payload: { requestId, accountId: request.account_id, kind: request.kind, failureCode },
      });
    });
  }

  private async completeStep(
    transaction: DatabaseTransaction,
    requestId: string,
    participantKey: string,
  ): Promise<void> {
    await transaction
      .updateTable("privacy.subject_request_steps")
      .set({ state: "completed", attempts: sql<number>`attempts + 1`, last_error_code: null, updated_at: new Date() })
      .where("request_id", "=", requestId)
      .where("participant_key", "=", participantKey)
      .executeTakeFirstOrThrow();
  }

  private async runParticipant<T>(participantKey: string, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      throw new PrivacyParticipantFailure(participantKey, error);
    }
  }
}
