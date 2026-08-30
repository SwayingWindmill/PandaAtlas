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

  @ApiPropertyOptional()
  public declare appliedAssertionId?: string;
}

export class CurationOwnerChangeDto {
  @ApiProperty({ format: "uuid" })
  public declare changeId: string;

  @ApiProperty()
  public declare candidateId: string;

  @ApiProperty({ enum: ["panda", "lineage", "life_history"] })
  public declare ownerModule: "panda" | "lineage" | "life_history";

  @ApiProperty({
    enum: [
      "fact.propose",
      "fact.corroborate",
      "fact.dispute",
      "name.add",
      "name.corroborate",
      "external_identifier.add",
      "external_identifier.corroborate",
      "parentage.create",
      "residency.create",
      "event.create",
    ],
  })
  public declare operation: string;

  @ApiProperty({ type: "object", additionalProperties: true })
  public declare payload: Record<string, unknown>;

  @ApiProperty({ format: "date" })
  public declare lastVerifiedOn: string;

  @ApiProperty({ type: String, isArray: true })
  public declare sourceIds: string[];

  @ApiPropertyOptional()
  public declare appliedReference?: string;
}

export class CurationChangeSetDto {
  @ApiProperty({ format: "uuid" })
  public declare changeSetId: string;

  @ApiProperty({ enum: ["review", "acquisition"] })
  public declare originKind: "review" | "acquisition";

  @ApiPropertyOptional({ format: "uuid" })
  public declare reviewCaseId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  public declare decisionId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  public declare submissionId?: string;

  @ApiPropertyOptional({ minimum: 1 })
  public declare revisionNumber?: number;

  @ApiPropertyOptional()
  public declare acquisitionBundleId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  public declare pipelineArtifactId?: string;

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

  @ApiProperty({ type: () => CurationOwnerChangeDto, isArray: true })
  public declare ownerChanges: CurationOwnerChangeDto[];
}
