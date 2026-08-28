import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsIn, IsISO8601, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import type { ModerationAppealDecisionOutcome, ModerationSanctionKind } from "../application/moderation.application.js";

function normalizeText(value: unknown): unknown {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value;
}

export class ApplySanctionDto {
  @ApiProperty({
    enum: [
      "warning",
      "submission_restricted",
      "attachment_restricted",
      "notification_restricted",
      "account_suspended",
      "account_closed_for_abuse",
    ],
  })
  @IsIn([
    "warning",
    "submission_restricted",
    "attachment_restricted",
    "notification_restricted",
    "account_suspended",
    "account_closed_for_abuse",
  ])
  public kind!: ModerationSanctionKind;

  @ApiProperty()
  @Matches(/^[a-z][a-z0-9_.-]{2,63}$/)
  public reasonCode!: string;

  @ApiProperty()
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  public internalExplanation!: string;

  @ApiProperty()
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  public userVisibleExplanation!: string;

  @ApiPropertyOptional({ format: "date-time" })
  @IsOptional()
  @IsISO8601()
  public endsAt?: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  public idempotencyKey!: string;
}

export class RestoreSanctionDto {
  @ApiProperty()
  @Matches(/^[a-z][a-z0-9_.-]{2,63}$/)
  public reasonCode!: string;

  @ApiProperty()
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  public internalExplanation!: string;

  @ApiProperty()
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  public userVisibleExplanation!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  public idempotencyKey!: string;
}

export class SubmitAppealDto {
  @ApiProperty({ format: "uuid" })
  @IsString()
  public sanctionId!: string;

  @ApiProperty()
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  public userStatement!: string;
}

export class DecideAppealDto {
  @ApiProperty({ enum: ["upheld", "modified", "overturned", "dismissed"] })
  @IsIn(["upheld", "modified", "overturned", "dismissed"])
  public outcome!: ModerationAppealDecisionOutcome;

  @ApiProperty()
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  public internalExplanation!: string;

  @ApiProperty()
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  public userVisibleExplanation!: string;
}

export class ModerationSanctionDto {
  @ApiProperty({ format: "uuid" })
  public declare sanctionId: string;

  @ApiProperty({ format: "uuid" })
  public declare accountId: string;

  @ApiProperty({
    enum: [
      "warning",
      "submission_restricted",
      "attachment_restricted",
      "notification_restricted",
      "account_suspended",
      "account_closed_for_abuse",
    ],
  })
  public declare kind: ModerationSanctionKind;

  @ApiProperty()
  public declare reasonCode: string;

  @ApiProperty({ format: "date-time" })
  public declare startsAt: string;

  @ApiPropertyOptional({ format: "date-time" })
  public declare endsAt?: string;

  @ApiProperty({ format: "date-time" })
  public declare createdAt: string;
}

export class ModerationSubjectDto {
  @ApiProperty({ format: "uuid" })
  public declare accountId: string;

  @ApiProperty({ minimum: 1 })
  public declare version: number;

  @ApiProperty()
  public declare submissionRestricted: boolean;

  @ApiProperty()
  public declare attachmentRestricted: boolean;

  @ApiProperty()
  public declare notificationRestricted: boolean;

  @ApiProperty()
  public declare accountSuspended: boolean;

  @ApiProperty()
  public declare accountClosedForAbuse: boolean;

  @ApiProperty({ minimum: 0 })
  public declare repeatAbuseCount: number;
}

export class ModerationAccountDto {
  @ApiProperty({ type: () => ModerationSubjectDto })
  public declare subject: ModerationSubjectDto;

  @ApiProperty({ type: () => ModerationSanctionDto, isArray: true })
  public declare sanctions: ModerationSanctionDto[];
}

export class RestoredSanctionDto {
  @ApiProperty({ enum: [true] })
  public declare restored: true;
}

export class ModerationAppealDto {
  @ApiProperty({ format: "uuid" })
  public declare appealCaseId: string;

  @ApiProperty({ format: "uuid" })
  public declare accountId: string;

  @ApiProperty({ format: "uuid" })
  public declare sanctionId: string;

  @ApiProperty({ enum: ["open", "under_review", "closed"] })
  public declare state: "open" | "under_review" | "closed";

  @ApiProperty({ minimum: 1 })
  public declare version: number;

  @ApiProperty()
  public declare userStatement: string;
}

export class ModerationAppealDecisionDto {
  @ApiProperty({ format: "uuid" })
  public declare decisionId: string;

  @ApiProperty({ format: "uuid" })
  public declare appealCaseId: string;

  @ApiProperty({ enum: ["upheld", "modified", "overturned", "dismissed"] })
  public declare outcome: ModerationAppealDecisionOutcome;

  @ApiProperty({ format: "uuid" })
  public declare decidedByAccountId: string;
}
