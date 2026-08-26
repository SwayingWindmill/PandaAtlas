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
  @IsUUID()
  public submissionId!: string;
}

export class VerifyReviewSourceDto {
  @IsUUID()
  public sourceId!: string;

  @IsIn(["verified", "rejected"])
  public outcome!: ReviewSourceVerificationOutcome;

  @Transform(({ value }) => normalizeText(value))
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  public normalizedLocator?: string;

  @Transform(({ value }) => normalizeText(value))
  @IsOptional()
  @IsString()
  @MaxLength(255)
  public canonicalSourceId?: string;

  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  public reason!: string;
}

export class RecordReviewDecisionDto {
  @IsIn(["accepted", "not_accepted", "duplicate", "out_of_scope", "abuse"])
  public outcome!: ReviewDecisionOutcome;

  @IsArray()
  @ArrayUnique()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/, { each: true })
  public selectedAssertionKeys!: string[];

  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  public userVisibleExplanation!: string;

  @Transform(({ value }) => normalizeText(value))
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  public internalReason?: string;

  @IsOptional()
  @IsUUID()
  public duplicateOfReviewCaseId?: string;
}

export class RecommendReviewDto {
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  public reason!: string;
}
