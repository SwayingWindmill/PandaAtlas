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
  @Transform(({ value }) => trim(value))
  @IsString()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/)
  public assertionKey!: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  public fieldKey!: string;

  @IsDefined()
  public value!: unknown;

  @IsIn(["confirmed", "provisional"])
  public certainty!: ContributionCertainty;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  public lastVerifiedOn!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/, { each: true })
  public sourceKeys!: string[];
}

export class ContributionSourceDto {
  @Transform(({ value }) => trim(value))
  @IsString()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/)
  public sourceKey!: string;

  @IsIn(["url", "publication", "document", "other"])
  public sourceKind!: ContributionSourceKind;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  public title!: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  public locator!: string;

  @Transform(({ value }) => trim(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  public publisher?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  public publishedOn?: string;
}

export class SubmitContributionDto {
  @IsIn(["correction", "sourced_information"])
  public submissionType!: ContributionSubmissionType;

  @IsUUID()
  public targetPandaId!: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  public publicVersionSeen!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((assertion: ContributionAssertionDto) => assertion.assertionKey)
  @ValidateNested({ each: true })
  @Type(() => ContributionAssertionDto)
  public assertions!: ContributionAssertionDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((source: ContributionSourceDto) => source.sourceKey)
  @ValidateNested({ each: true })
  @Type(() => ContributionSourceDto)
  public sources!: ContributionSourceDto[];
}

export class RegisterContributionAttachmentDto {
  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  public storageObjectKey!: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  public objectVersion!: string;

  @Transform(({ value }) => trim(value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  public originalFilename!: string;

  @IsIn(["application/pdf", "image/jpeg", "image/png", "image/webp"])
  public mediaType!: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

  @IsInt()
  @Min(1)
  @Max(10_485_760)
  public byteSize!: number;

  @Matches(/^[0-9a-f]{64}$/)
  public contentSha256!: string;
}
