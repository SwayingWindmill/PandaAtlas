import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsString, MaxLength, MinLength } from "class-validator";

function normalizeText(value: unknown): unknown {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value;
}

export class ApproveCurationDto {
  @ApiProperty()
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  public reason!: string;
}

export class CurationChangeDto {
  @ApiProperty({ format: "uuid" })
  public declare changeId: string;

  @ApiProperty()
  public declare assertionKey: string;

  @ApiProperty()
  public declare fieldKey: string;

  @ApiProperty({
    oneOf: [
      { type: "string" },
      { type: "number" },
      { type: "boolean" },
      { type: "array", items: {} },
      { type: "object", additionalProperties: true },
      { type: "null" },
    ],
  })
  public declare value: unknown;

  @ApiProperty({ enum: ["confirmed", "provisional"] })
  public declare certainty: "confirmed" | "provisional";

  @ApiProperty({ format: "date" })
  public declare lastVerifiedOn: string;

  @ApiProperty({ type: String, isArray: true })
  public declare sourceIds: string[];

  @ApiPropertyOptional({ format: "uuid" })
  public declare appliedAssertionId?: string;
}

export class CurationChangeSetDto {
  @ApiProperty({ format: "uuid" })
  public declare changeSetId: string;

  @ApiProperty({ format: "uuid" })
  public declare reviewCaseId: string;

  @ApiProperty({ format: "uuid" })
  public declare decisionId: string;

  @ApiProperty({ format: "uuid" })
  public declare submissionId: string;

  @ApiProperty({ minimum: 1 })
  public declare revisionNumber: number;

  @ApiProperty({ format: "uuid" })
  public declare targetPandaId: string;

  @ApiProperty({ enum: ["draft", "validated", "approved", "applied", "rejected"] })
  public declare state: "draft" | "validated" | "approved" | "applied" | "rejected";

  @ApiProperty({ minimum: 1 })
  public declare version: number;

  @ApiProperty()
  public declare reason: string;

  @ApiProperty({ format: "uuid" })
  public declare createdByAccountId: string;

  @ApiPropertyOptional({ format: "uuid" })
  public declare validatedByAccountId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  public declare approvedByAccountId?: string;

  @ApiProperty({ type: () => CurationChangeDto, isArray: true })
  public declare changes: CurationChangeDto[];
}
