export interface AuditEvidence {
  sourceEventId: string;
  sourceContext: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  correlationId: string;
  occurredAt: string;
  payloadSha256: string;
  recordedAt: string;
}

export interface AuditRepository {
  list(limit: number): Promise<AuditEvidence[]>;
}

export type AuditPort = AuditRepository;
export const AUDIT_REPOSITORY = Symbol("AUDIT_REPOSITORY");
export const AUDIT_PORT = Symbol("AUDIT_PORT");

export class AuditApplication implements AuditPort {
  public constructor(private readonly repository: AuditRepository) {}

  public list(limit = 50): Promise<AuditEvidence[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new Error("Audit limit must be an integer between 1 and 200");
    }
    return this.repository.list(limit);
  }
}
