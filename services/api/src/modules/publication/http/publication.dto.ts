import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsString, Length } from "class-validator";

export class BuildPublicReleaseDto {
  @ApiProperty({ example: "2026.08.27.1", minLength: 1, maxLength: 80 })
  @IsString()
  @Length(1, 80)
  public declare version: string;
}

export class PublicationReasonDto {
  @ApiProperty({ minLength: 3, maxLength: 2000 })
  @IsString()
  @Length(3, 2000)
  public declare reason: string;
}

export class PublicationResourceControlDto extends PublicationReasonDto {
  @ApiProperty({ enum: ["panda", "place", "media", "evidence"] })
  @IsIn(["panda", "place", "media", "evidence"])
  public declare resourceKind: "panda" | "place" | "media" | "evidence";

  @ApiProperty({ minLength: 1, maxLength: 512 })
  @IsString()
  @Length(1, 512)
  public declare resourceId: string;
}

export class PublicReleaseDto {
  @ApiProperty({ format: "uuid" })
  public declare releaseId: string;

  @ApiProperty()
  public declare version: string;

  @ApiProperty({ minimum: 1 })
  public declare projectionSchemaVersion: number;

  @ApiProperty({ enum: ["building", "sealed"] })
  public declare lifecycleState: "building" | "sealed";

  @ApiProperty({ format: "date-time" })
  public declare builtAt: string;

  @ApiPropertyOptional({ format: "date-time" })
  public declare sealedAt?: string;

  @ApiPropertyOptional({ pattern: "^[0-9a-f]{64}$" })
  public declare contentSha256?: string;
}

export class PublicReadReleaseDto {
  @ApiProperty({ format: "uuid" })
  public declare releaseId: string;

  @ApiProperty()
  public declare version: string;
}

export class PublicPandaNameDto {
  @ApiProperty()
  public declare languageTag: string;

  @ApiProperty()
  public declare nameKind: string;

  @ApiProperty()
  public declare value: string;

  @ApiProperty()
  public declare isPrimary: boolean;
}

export class PublicPandaFactDto {
  @ApiProperty()
  public declare fieldKey: string;

  @ApiPropertyOptional({
    oneOf: [
      { type: "string" },
      { type: "number" },
      { type: "boolean" },
      { type: "array", items: {} },
      { type: "object", additionalProperties: true },
      { type: "null" },
    ],
  })
  public declare value?: unknown;

  @ApiProperty()
  public declare status: string;

  @ApiProperty({ format: "date" })
  public declare lastVerifiedOn: string;

  @ApiProperty({ minimum: 1 })
  public declare conclusionVersion: number;
}

export class PublicPandaSummaryDto {
  @ApiProperty({ format: "uuid" })
  public declare pandaId: string;

  @ApiProperty()
  public declare canonicalSlug: string;

  @ApiProperty({ type: String, isArray: true })
  public declare legacySlugs: string[];

  @ApiProperty({ type: () => PublicPandaNameDto, isArray: true })
  public declare names: PublicPandaNameDto[];

  @ApiProperty({ type: () => PublicPandaFactDto, isArray: true })
  public declare facts: PublicPandaFactDto[];
}

export class PublicPlaceSummaryDto {
  @ApiProperty({ format: "uuid" })
  public declare placeId: string;

  @ApiPropertyOptional({ format: "uuid" })
  public declare institutionId?: string;

  @ApiProperty()
  public declare slug: string;

  @ApiProperty()
  public declare placeType: string;

  @ApiPropertyOptional()
  public declare nameZh?: string;

  @ApiPropertyOptional()
  public declare nameEn?: string;

  @ApiPropertyOptional()
  public declare countryCode?: string;

  @ApiPropertyOptional()
  public declare region?: string;

  @ApiPropertyOptional()
  public declare longitude?: number;

  @ApiPropertyOptional()
  public declare latitude?: number;
}

export class PublicEvidenceSummaryDto {
  @ApiProperty()
  public declare sourceId: string;

  @ApiProperty()
  public declare publisher: string;

  @ApiProperty()
  public declare title: string;

  @ApiProperty({ format: "uri" })
  public declare url: string;

  @ApiPropertyOptional({ format: "date" })
  public declare publishedOn?: string;

  @ApiProperty({ format: "date" })
  public declare lastVerifiedOn: string;

  @ApiProperty()
  public declare languageTag: string;

  @ApiProperty()
  public declare accessState: string;

  @ApiPropertyOptional()
  public declare evidenceTier?: string;

  @ApiPropertyOptional()
  public declare publicSummary?: string;
}

export class PublicMediaSummaryDto {
  @ApiProperty({ format: "uuid" })
  public declare assetId: string;

  @ApiProperty({ format: "uuid" })
  public declare pandaId: string;

  @ApiPropertyOptional()
  public declare sourceId?: string;

  @ApiProperty()
  public declare usageRole: string;

  @ApiProperty({ minimum: 0 })
  public declare displayOrder: number;

  @ApiProperty()
  public declare objectKey: string;

  @ApiProperty({ pattern: "^[0-9a-f]{64}$" })
  public declare contentSha256: string;

  @ApiProperty()
  public declare mediaType: string;

  @ApiPropertyOptional()
  public declare title?: string;

  @ApiPropertyOptional()
  public declare creator?: string;

  @ApiPropertyOptional()
  public declare copyrightText?: string;

  @ApiPropertyOptional()
  public declare license?: string;

  @ApiPropertyOptional()
  public declare attributionText?: string;

  @ApiPropertyOptional({ format: "date-time" })
  public declare takenAt?: string;
}

export class PublicLineageSummaryDto {
  @ApiProperty()
  public declare assertionId: string;

  @ApiProperty({ format: "uuid" })
  public declare childId: string;

  @ApiProperty({ format: "uuid" })
  public declare parentId: string;

  @ApiProperty({ enum: ["father", "mother"] })
  public declare parentRole: string;

  @ApiProperty({ type: String, isArray: true })
  public declare sourceIds: string[];
}

export class PublicResidencySummaryDto {
  @ApiProperty()
  public declare residencyId: string;

  @ApiProperty({ format: "uuid" })
  public declare pandaId: string;

  @ApiProperty({ format: "uuid" })
  public declare placeId: string;

  @ApiProperty()
  public declare residencyType: string;

  @ApiPropertyOptional({ format: "date" })
  public declare startOn?: string;

  @ApiProperty()
  public declare startPrecision: string;

  @ApiPropertyOptional({ format: "date" })
  public declare endOn?: string;

  @ApiPropertyOptional()
  public declare endPrecision?: string;

  @ApiProperty()
  public declare status: string;

  @ApiProperty({ type: String, isArray: true })
  public declare sourceIds: string[];
}

export class PublicLifeEventSummaryDto {
  @ApiProperty()
  public declare eventId: string;

  @ApiProperty()
  public declare eventType: string;

  @ApiProperty()
  public declare eventStatus: string;

  @ApiPropertyOptional({ format: "date" })
  public declare occurredOn?: string;

  @ApiProperty()
  public declare occurredPrecision: string;

  @ApiPropertyOptional({ format: "uuid" })
  public declare fromPlaceId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  public declare toPlaceId?: string;

  @ApiPropertyOptional()
  public declare summary?: string;

  @ApiProperty({ type: String, isArray: true, format: "uuid" })
  public declare participantIds: string[];

  @ApiProperty({ type: String, isArray: true })
  public declare sourceIds: string[];
}

export class PublicPandaDetailDto {
  @ApiProperty({ type: () => PublicReadReleaseDto })
  public declare release: PublicReadReleaseDto;

  @ApiProperty({ type: () => PublicPandaSummaryDto })
  public declare panda: PublicPandaSummaryDto;

  @ApiProperty({ type: () => PublicLineageSummaryDto, isArray: true })
  public declare lineage: PublicLineageSummaryDto[];

  @ApiProperty({ type: () => PublicResidencySummaryDto, isArray: true })
  public declare residencies: PublicResidencySummaryDto[];

  @ApiProperty({ type: () => PublicLifeEventSummaryDto, isArray: true })
  public declare events: PublicLifeEventSummaryDto[];

  @ApiProperty({ type: () => PublicMediaSummaryDto, isArray: true })
  public declare media: PublicMediaSummaryDto[];

  @ApiProperty({ type: () => PublicEvidenceSummaryDto, isArray: true })
  public declare evidence: PublicEvidenceSummaryDto[];
}

export class PublicPandaListDto {
  @ApiProperty({ type: () => PublicReadReleaseDto })
  public declare release: PublicReadReleaseDto;

  @ApiProperty({ type: () => PublicPandaSummaryDto, isArray: true })
  public declare items: PublicPandaSummaryDto[];
}

export class PublicPlaceListDto {
  @ApiProperty({ type: () => PublicReadReleaseDto })
  public declare release: PublicReadReleaseDto;

  @ApiProperty({ type: () => PublicPlaceSummaryDto, isArray: true })
  public declare items: PublicPlaceSummaryDto[];
}

export class PublicLineageListDto {
  @ApiProperty({ type: () => PublicReadReleaseDto })
  public declare release: PublicReadReleaseDto;

  @ApiProperty({ type: () => PublicLineageSummaryDto, isArray: true })
  public declare items: PublicLineageSummaryDto[];
}

export class PublicResidencyListDto {
  @ApiProperty({ type: () => PublicReadReleaseDto })
  public declare release: PublicReadReleaseDto;

  @ApiProperty({ type: () => PublicResidencySummaryDto, isArray: true })
  public declare items: PublicResidencySummaryDto[];
}

export class PublicLifeEventListDto {
  @ApiProperty({ type: () => PublicReadReleaseDto })
  public declare release: PublicReadReleaseDto;

  @ApiProperty({ type: () => PublicLifeEventSummaryDto, isArray: true })
  public declare items: PublicLifeEventSummaryDto[];
}

export class PublicPlaceDetailDto {
  @ApiProperty({ type: () => PublicReadReleaseDto })
  public declare release: PublicReadReleaseDto;

  @ApiProperty({ type: () => PublicPlaceSummaryDto })
  public declare place: PublicPlaceSummaryDto;
}

export class PublicEvidenceDetailDto {
  @ApiProperty({ type: () => PublicReadReleaseDto })
  public declare release: PublicReadReleaseDto;

  @ApiProperty({ type: () => PublicEvidenceSummaryDto })
  public declare source: PublicEvidenceSummaryDto;
}

export class PublicStatsDto {
  @ApiProperty({ minimum: 0 })
  public declare pandaCount: number;

  @ApiProperty({ minimum: 0 })
  public declare institutionCount: number;

  @ApiProperty({ minimum: 0 })
  public declare placeCount: number;

  @ApiProperty({ minimum: 0 })
  public declare lineageCount: number;

  @ApiProperty({ minimum: 0 })
  public declare residencyCount: number;

  @ApiProperty({ minimum: 0 })
  public declare lifeEventCount: number;

  @ApiProperty({ minimum: 0 })
  public declare mediaCount: number;

  @ApiProperty({ minimum: 0 })
  public declare evidenceSourceCount: number;
}

export class PublicStatsResponseDto {
  @ApiProperty({ type: () => PublicReadReleaseDto })
  public declare release: PublicReadReleaseDto;

  @ApiProperty({ type: () => PublicStatsDto })
  public declare stats: PublicStatsDto;
}
