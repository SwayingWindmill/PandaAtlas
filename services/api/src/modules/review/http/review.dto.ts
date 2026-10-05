import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { ContributionReviewSurfaceDto } from "../../contribution/http/contribution.dto.js";
import type {
  ReviewCaseState,
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

export class ReviewCaseListQueryDto {
  @ApiPropertyOptional({
    enum: ["new", "triage", "assigned", "waiting", "decision_ready", "incorporation_recommended", "closed"],
  })
  @IsOptional()
  @IsIn(["new", "triage", "assigned", "waiting", "decision_ready", "incorporation_recommended", "closed"])
  public state?: ReviewCaseState;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public limit?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  public offset?: number;
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

export class ReviewCaseQueueItemDto extends ReviewCaseDto {
  @ApiProperty()
  public declare riskLevel: string;

  @ApiPropertyOptional({ format: "uuid" })
  public declare targetPandaId?: string;

  @ApiPropertyOptional()
  public declare contributorStatus?: string;

  @ApiProperty({ format: "date-time" })
  public declare createdAt: string;

  @ApiProperty({ format: "date-time" })
  public declare updatedAt: string;

  @ApiProperty({ format: "date-time" })
  public declare firstResponseDueAt: string;

  @ApiProperty()
  public declare slaOverdue: boolean;

  @ApiProperty({ minimum: 0 })
  public declare queueAgeSeconds: number;
}

export class ReviewCasePageDto {
  @ApiProperty({ type: () => ReviewCaseQueueItemDto, isArray: true })
  public declare items: ReviewCaseQueueItemDto[];

  @ApiProperty({ minimum: 0 })
  public declare total: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  public declare limit: number;

  @ApiProperty({ minimum: 0 })
  public declare offset: number;
}

export class ReviewCaseSurfaceDto {
  @ApiProperty({ type: () => ReviewCaseDto })
  public declare reviewCase: ReviewCaseDto;

  @ApiProperty({ type: () => ContributionReviewSurfaceDto })
  public declare contribution: ContributionReviewSurfaceDto;
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
