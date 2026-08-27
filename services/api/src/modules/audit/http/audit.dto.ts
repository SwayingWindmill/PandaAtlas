import { ApiProperty } from "@nestjs/swagger";

export class AuditEvidenceDto {
  @ApiProperty({ format: "uuid" })
  public declare sourceEventId: string;

  @ApiProperty()
  public declare sourceContext: string;

  @ApiProperty()
  public declare eventType: string;

  @ApiProperty()
  public declare aggregateType: string;

  @ApiProperty()
  public declare aggregateId: string;

  @ApiProperty({ format: "uuid" })
  public declare correlationId: string;

  @ApiProperty({ format: "date-time" })
  public declare occurredAt: string;

  @ApiProperty({ pattern: "^[0-9a-f]{64}$" })
  public declare payloadSha256: string;

  @ApiProperty({ format: "date-time" })
  public declare recordedAt: string;
}
