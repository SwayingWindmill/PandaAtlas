import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import {
  FACT_REVIEW_STATES,
  NEWS_ITEM_STATUSES,
  NEWS_KINDS,
  NEWS_PLATFORMS,
  NEWS_REVIEW_DECISIONS,
  NEWS_SOURCE_TIERS,
  type FactReviewState,
  type NewsItemStatus,
  type NewsKind,
  type NewsPlatform,
  type NewsReviewDecision,
  type NewsSourceTier,
} from "../application/news.application.js";
import type { ExtractedFactChangeInput, FactChangeKind } from "../application/news-fact-gate.js";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HTTPS_URL_PATTERN = /^https:\/\/[^\s]+$/i;
const FACT_CHANGE_KINDS = ["none", "birth", "death", "transfer", "naming"] as const;

function trimText(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export class NewsFactChangeInputDto implements ExtractedFactChangeInput {
  @ApiProperty({ enum: FACT_CHANGE_KINDS })
  @IsIn(FACT_CHANGE_KINDS)
  public kind!: FactChangeKind;

  @ApiPropertyOptional({ enum: ["announced", "completed"], nullable: true })
  @IsOptional()
  @IsIn(["announced", "completed"])
  public phase?: "announced" | "completed" | null;

  @ApiPropertyOptional({ enum: ["proposed", "official"], nullable: true })
  @IsOptional()
  @IsIn(["proposed", "official"])
  public namingStatus?: "proposed" | "official" | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}(?:-\d{2})?$/)
  public date?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  public motherName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  public toPlace?: string | null;
}

export class NewsIngestItemDto {
  @ApiProperty()
  @Transform(({ value }) => trimText(value))
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  public externalId!: string;

  @ApiProperty({ enum: NEWS_PLATFORMS })
  @IsIn(NEWS_PLATFORMS)
  public platform!: NewsPlatform;

  @ApiProperty({ enum: NEWS_SOURCE_TIERS })
  @IsIn(NEWS_SOURCE_TIERS)
  public sourceTier!: NewsSourceTier;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(SLUG_PATTERN)
  public authorInstitutionSlug?: string;

  @ApiProperty()
  @Transform(({ value }) => trimText(value))
  @IsString()
  @MaxLength(1000)
  @Matches(HTTPS_URL_PATTERN)
  public sourceUrl!: string;

  @ApiProperty()
  @Transform(({ value }) => trimText(value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  public sourcePublisher!: string;

  @ApiProperty({ format: "date-time" })
  @IsString()
  @MaxLength(64)
  public publishedAt!: string;

  @ApiProperty({ enum: NEWS_KINDS })
  @IsIn(NEWS_KINDS)
  public kind!: NewsKind;

  @ApiProperty({ enum: ["single", "composite", "unknown"] })
  @IsIn(["single", "composite", "unknown"])
  public scope!: "single" | "composite" | "unknown";

  @ApiProperty()
  @Transform(({ value }) => trimText(value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  public titleZh!: string;

  @ApiProperty()
  @Transform(({ value }) => trimText(value))
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  public summaryZh!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  public pandaNames!: string[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  public institutionName?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  public coverUrl?: string;

  @ApiPropertyOptional({ type: NewsFactChangeInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NewsFactChangeInputDto)
  public factChange?: NewsFactChangeInputDto;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  public evidenceQuote?: string;
}

export class NewsIngestBatchDto {
  @ApiProperty({ type: [NewsIngestItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => NewsIngestItemDto)
  public items!: NewsIngestItemDto[];
}

export class NewsIngestResultDto {
  @ApiProperty() public declare accepted: number;
  @ApiProperty() public declare published: number;
  @ApiProperty() public declare pendingReview: number;
  @ApiProperty() public declare factCandidatesCreated: number;
}

export class PublicNewsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(SLUG_PATTERN)
  public panda?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(SLUG_PATTERN)
  public institution?: string;

  @ApiPropertyOptional({ enum: NEWS_SOURCE_TIERS })
  @IsOptional()
  @IsIn(NEWS_SOURCE_TIERS)
  public sourceTier?: NewsSourceTier;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  public limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(256)
  public cursor?: string;
}

export class PublicNewsItemDto {
  @ApiProperty({ format: "uuid" }) public declare newsItemId: string;
  @ApiProperty({ enum: NEWS_PLATFORMS }) public declare platform: NewsPlatform;
  @ApiProperty({ enum: NEWS_SOURCE_TIERS }) public declare sourceTier: NewsSourceTier;
  @ApiProperty({ enum: NEWS_KINDS }) public declare kind: NewsKind;
  @ApiProperty() public declare titleZh: string;
  @ApiProperty() public declare summaryZh: string;
  @ApiProperty() public declare sourceUrl: string;
  @ApiProperty() public declare sourcePublisher: string;
  @ApiPropertyOptional() public declare coverUrl?: string;
  @ApiProperty({ type: [String] }) public declare pandaIds: string[];
  @ApiProperty({ type: [String] }) public declare pandaSlugs: string[];
  @ApiPropertyOptional() public declare institutionId?: string;
  @ApiPropertyOptional() public declare institutionSlug?: string;
  @ApiPropertyOptional() public declare institutionName?: string;
  @ApiProperty({ format: "date-time" }) public declare publishedAt: string;
}

export class PublicNewsPageDto {
  @ApiProperty({ type: [PublicNewsItemDto] }) public declare items: PublicNewsItemDto[];
  @ApiPropertyOptional() public declare nextCursor?: string;
}

export class NewsReviewListQueryDto {
  @ApiPropertyOptional({ enum: NEWS_ITEM_STATUSES })
  @IsOptional()
  @IsIn(NEWS_ITEM_STATUSES)
  public status?: NewsItemStatus;

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

export class NewsReviewItemDto extends PublicNewsItemDto {
  @ApiProperty() public declare externalId: string;
  @ApiProperty({ type: [String] }) public declare rawPandaNames: string[];
  @ApiProperty({ enum: NEWS_ITEM_STATUSES }) public declare status: NewsItemStatus;
  @ApiPropertyOptional() public declare reviewNote?: string;
  @ApiPropertyOptional({ format: "date-time" }) public declare reviewedAt?: string;
  @ApiProperty({ format: "date-time" }) public declare createdAt: string;
}

export class DecideNewsItemDto {
  @ApiProperty({ enum: NEWS_REVIEW_DECISIONS })
  @IsIn(NEWS_REVIEW_DECISIONS)
  public decision!: NewsReviewDecision;

  @ApiPropertyOptional()
  @Transform(({ value }) => trimText(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  public reviewNote?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @Matches(SLUG_PATTERN, { each: true })
  public pandaSlugs?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(SLUG_PATTERN)
  public institutionSlug?: string;
}

export class FactCandidateListQueryDto {
  @ApiPropertyOptional({ enum: FACT_REVIEW_STATES })
  @IsOptional()
  @IsIn(FACT_REVIEW_STATES)
  public reviewState?: FactReviewState;

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

export class FactCandidateDto {
  @ApiProperty({ format: "uuid" }) public declare candidateId: string;
  @ApiProperty() public declare candidateKey: string;
  @ApiProperty({ format: "uuid" }) public declare newsItemId: string;
  @ApiProperty() public declare kind: string;
  @ApiPropertyOptional() public declare phase?: string;
  @ApiPropertyOptional() public declare namingStatus?: string;
  @ApiPropertyOptional() public declare eventDate?: string;
  @ApiPropertyOptional() public declare targetPandaId?: string;
  @ApiPropertyOptional() public declare targetPandaSlug?: string;
  @ApiProperty({ type: [String] }) public declare rawPandaNames: string[];
  @ApiPropertyOptional() public declare targetInstitutionId?: string;
  @ApiPropertyOptional() public declare targetInstitutionSlug?: string;
  @ApiPropertyOptional() public declare rawInstitutionName?: string;
  @ApiProperty({ type: Object, additionalProperties: true }) public declare changePayload: Record<string, unknown>;
  @ApiProperty({ type: [Object] }) public declare evidenceItems: Array<Record<string, unknown>>;
  @ApiProperty() public declare gateStatus: string;
  @ApiProperty({ enum: FACT_REVIEW_STATES }) public declare reviewState: FactReviewState;
  @ApiPropertyOptional() public declare reviewNote?: string;
  @ApiPropertyOptional({ format: "date-time" }) public declare reviewedAt?: string;
  @ApiProperty({ format: "date-time" }) public declare createdAt: string;
}

export class DecideFactCandidateDto {
  @ApiProperty({ enum: ["approved", "rejected"] })
  @IsIn(["approved", "rejected"])
  public decision!: "approved" | "rejected";

  @ApiPropertyOptional()
  @Transform(({ value }) => trimText(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  public reviewNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(SLUG_PATTERN)
  public targetPandaSlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(SLUG_PATTERN)
  public targetInstitutionSlug?: string;
}
