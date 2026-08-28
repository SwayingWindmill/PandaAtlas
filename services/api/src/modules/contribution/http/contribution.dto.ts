import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type, Transform } from "class-transformer";
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import type {
  ContributionCertainty,
  ContributionSourceKind,
  ContributionSubmissionType,
} from "../application/contribution.application.js";

function trim(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export class ContributionAssertionDto {
  @ApiProperty()
  @Transform(({ value }) => trim(value))
  @IsString()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/)
  public assertionKey!: string;

  @ApiProperty()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  public fieldKey!: string;

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
  @IsDefined()
  public value!: unknown;

  @ApiProperty({ enum: ["confirmed", "provisional"] })
  @IsIn(["confirmed", "provisional"])
  public certainty!: ContributionCertainty;

  @ApiProperty({ format: "date" })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  public lastVerifiedOn!: string;

  @ApiProperty({ type: String, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/, { each: true })
  public sourceKeys!: string[];
}

export class ContributionSourceDto {
  @ApiProperty()
  @Transform(({ value }) => trim(value))
  @IsString()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/)
  public sourceKey!: string;

  @ApiProperty({ enum: ["url", "publication", "document", "other"] })
  @IsIn(["url", "publication", "document", "other"])
  public sourceKind!: ContributionSourceKind;

  @ApiProperty()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  public title!: string;

  @ApiProperty()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  public locator!: string;

  @ApiPropertyOptional()
  @Transform(({ value }) => trim(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  public publisher?: string;

  @ApiPropertyOptional({ format: "date" })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  public publishedOn?: string;
}

export class SubmitContributionDto {
  @ApiProperty({ enum: ["correction", "sourced_information"] })
  @IsIn(["correction", "sourced_information"])
  public submissionType!: ContributionSubmissionType;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  public targetPandaId!: string;

  @ApiProperty()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  public publicVersionSeen!: string;

  @ApiProperty({ type: () => ContributionAssertionDto, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((assertion: ContributionAssertionDto) => assertion.assertionKey)
  @ValidateNested({ each: true })
  @Type(() => ContributionAssertionDto)
  public assertions!: ContributionAssertionDto[];

  @ApiProperty({ type: () => ContributionSourceDto, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((source: ContributionSourceDto) => source.sourceKey)
  @ValidateNested({ each: true })
  @Type(() => ContributionSourceDto)
  public sources!: ContributionSourceDto[];
}

export class RegisterContributionAttachmentDto {
  @ApiProperty()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  public storageObjectKey!: string;

  @ApiProperty()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  public objectVersion!: string;

  @ApiProperty()
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  public originalFilename!: string;

  @ApiProperty({ enum: ["application/pdf", "image/jpeg", "image/png", "image/webp"] })
  @IsIn(["application/pdf", "image/jpeg", "image/png", "image/webp"])
  public mediaType!: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

  @ApiProperty({ minimum: 1, maximum: 10_485_760 })
  @IsInt()
  @Min(1)
  @Max(10_485_760)
  public byteSize!: number;

  @ApiProperty({ pattern: "^[0-9a-f]{64}$" })
  @Matches(/^[0-9a-f]{64}$/)
  public contentSha256!: string;
}

export class ContributionRecordDto {
  @ApiProperty({ format: "uuid" })
  public declare submissionId: string;

  @ApiProperty({ enum: ["correction", "sourced_information"] })
  public declare submissionType: ContributionSubmissionType;

  @ApiProperty({ format: "uuid" })
  public declare targetPandaId: string;

  @ApiProperty()
  public declare publicVersionSeen: string;

  @ApiProperty({ minimum: 1 })
  public declare revisionNumber: number;

  @ApiProperty()
  public declare status: string;

  @ApiProperty({ format: "date-time" })
  public declare submittedAt: string;
}

export class ContributionListDto {
  @ApiProperty({ type: () => ContributionRecordDto, isArray: true })
  public declare items: ContributionRecordDto[];
}

export class ContributionAttachmentDto {
  @ApiProperty({ format: "uuid" })
  public declare attachmentId: string;

  @ApiProperty()
  public declare mediaType: string;

  @ApiProperty({ minimum: 1 })
  public declare byteSize: number;

  @ApiProperty()
  public declare state: string;
}

export class ContributionReviewAssertionDto {
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
  public declare certainty: ContributionCertainty;

  @ApiProperty({ format: "date" })
  public declare lastVerifiedOn: string;

  @ApiProperty({ type: String, isArray: true })
  public declare sourceIds: string[];
}

export class ContributionReviewSourceDto {
  @ApiProperty()
  public declare sourceId: string;

  @ApiProperty({ enum: ["url", "publication", "document", "other"] })
  public declare sourceKind: ContributionSourceKind;

  @ApiProperty()
  public declare title: string;

  @ApiProperty()
  public declare locator: string;

  @ApiPropertyOptional()
  public declare publisher?: string;

  @ApiPropertyOptional({ format: "date" })
  public declare publishedOn?: string;
}

export class ContributionReviewSurfaceDto {
  @ApiProperty({ format: "uuid" })
  public declare submissionId: string;

  @ApiPropertyOptional({ format: "uuid" })
  public declare contributorAccountId?: string;

  @ApiProperty({ format: "uuid" })
  public declare targetPandaId: string;

  @ApiProperty({ minimum: 1 })
  public declare revisionNumber: number;

  @ApiProperty()
  public declare publicVersionSeen: string;

  @ApiProperty({ type: () => ContributionReviewAssertionDto, isArray: true })
  public declare assertions: ContributionReviewAssertionDto[];

  @ApiProperty({ type: () => ContributionReviewSourceDto, isArray: true })
  public declare sources: ContributionReviewSourceDto[];

  @ApiProperty({ type: () => ContributionAttachmentDto, isArray: true })
  public declare attachments: ContributionAttachmentDto[];
}
