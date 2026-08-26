import { Transform } from "class-transformer";
import { IsIn, IsISO8601, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import type { ModerationAppealDecisionOutcome, ModerationSanctionKind } from "../application/moderation.application.js";

function normalizeText(value: unknown): unknown {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value;
}

export class ApplySanctionDto {
  @IsIn([
    "warning",
    "submission_restricted",
    "attachment_restricted",
    "notification_restricted",
    "account_suspended",
    "account_closed_for_abuse",
  ])
  public kind!: ModerationSanctionKind;

  @Matches(/^[a-z][a-z0-9_.-]{2,63}$/)
  public reasonCode!: string;

  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  public internalExplanation!: string;

  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  public userVisibleExplanation!: string;

  @IsOptional()
  @IsISO8601()
  public endsAt?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  public idempotencyKey!: string;
}

export class RestoreSanctionDto {
  @Matches(/^[a-z][a-z0-9_.-]{2,63}$/)
  public reasonCode!: string;

  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  public internalExplanation!: string;

  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  public userVisibleExplanation!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  public idempotencyKey!: string;
}

export class SubmitAppealDto {
  @IsString()
  public sanctionId!: string;

  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  public userStatement!: string;
}

export class DecideAppealDto {
  @IsIn(["upheld", "modified", "overturned", "dismissed"])
  public outcome!: ModerationAppealDecisionOutcome;

  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  public internalExplanation!: string;

  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  public userVisibleExplanation!: string;
}
