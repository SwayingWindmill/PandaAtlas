import type { DatabaseService } from "../../../platform/database/database.service.js";
import type { AuditEvidence, AuditRepository } from "../application/audit.application.js";

export class PostgresAuditRepository implements AuditRepository {
  public constructor(private readonly database: DatabaseService) {}

  public async list(limit: number): Promise<AuditEvidence[]> {
    const rows = await this.database.db
      .selectFrom("audit.evidence_events")
      .selectAll()
      .orderBy("occurred_at", "desc")
      .orderBy("source_event_id", "desc")
      .limit(limit)
      .execute();
    return rows.map((row) => ({
      sourceEventId: row.source_event_id,
      sourceContext: row.source_context,
      eventType: row.event_type,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      correlationId: row.correlation_id,
      occurredAt: row.occurred_at.toISOString(),
      payloadSha256: row.payload_sha256,
      recordedAt: row.recorded_at.toISOString(),
    }));
  }
}
