import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import type {
  ReviewDecisionOutcome,
  ReviewSourceVerificationOutcome,
} from "../application/review.application.js";

function normalizeText(value: unknown): unknown {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value;
}

export class OpenReviewCaseDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  public submissionId!: string;
}

export class VerifyReviewSourceDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  public sourceId!: string;

  @ApiProperty({ enum: ["verified", "rejected"] })
  @IsIn(["verified", "rejected"])
  public outcome!: ReviewSourceVerificationOutcome;

  @ApiPropertyOptional()
  @Transform(({ value }) => normalizeText(value))
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  public normalizedLocator?: string;

  @ApiPropertyOptional()
  @Transform(({ value }) => normalizeText(value))
  @IsOptional()
  @IsString()
  @MaxLength(255)
  public canonicalSourceId?: string;

  @ApiProperty()
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  public reason!: string;
}

export class RecordReviewDecisionDto {
  @ApiProperty({ enum: ["accepted", "not_accepted", "duplicate", "out_of_scope", "abuse"] })
  @IsIn(["accepted", "not_accepted", "duplicate", "out_of_scope", "abuse"])
  public outcome!: ReviewDecisionOutcome;

  @ApiProperty({ type: String, isArray: true })
  @IsArray()
  @ArrayUnique()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/, { each: true })
  public selectedAssertionKeys!: string[];

  @ApiProperty()
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  public userVisibleExplanation!: string;

  @ApiPropertyOptional()
  @Transform(({ value }) => normalizeText(value))
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  public internalReason?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  public duplicateOfReviewCaseId?: string;
}

export class RecommendReviewDto {
  @ApiProperty()
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  public reason!: string;
}

export class ReviewCaseDto {
  @ApiProperty({ format: "uuid" })
  public declare reviewCaseId: string;

  @ApiProperty({ format: "uuid" })
  public declare submissionId: string;

  @ApiProperty({ minimum: 1 })
  public declare revisionNumber: number;

  @ApiProperty()
  public declare state: string;

  @ApiProperty({ minimum: 1 })
  public declare version: number;

  @ApiPropertyOptional({ format: "uuid" })
  public declare primaryAssigneeId?: string;
}

export class ReviewVerificationResultDto {
  @ApiProperty({ enum: [true] })
  public declare verified: true;
}

export class ReviewDecisionResultDto {
  @ApiProperty({ enum: [true] })
  public declare decided: true;
}

export class ReviewRecommendationDto {
  @ApiProperty({ format: "uuid" })
  public declare changeSetId: string;
}
