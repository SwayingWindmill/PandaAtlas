import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from "class-validator";
import {
  INSTITUTION_KINDS,
  VISIT_TIP_TOPICS,
  type InstitutionKind,
  type VisitTipTopic,
} from "../../places/application/visitor-content.js";

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

export class PublicPandaCurrentPlaceSummaryDto {
  @ApiProperty({ format: "uuid" })
  public declare placeId: string;

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

  @ApiPropertyOptional({ type: () => PublicPandaCurrentPlaceSummaryDto })
  public declare currentPlace?: PublicPandaCurrentPlaceSummaryDto;

  @ApiPropertyOptional()
  public declare hasFullBleedCover?: boolean;
}

export class LocalizedTextDto {
  @ApiPropertyOptional()
  public declare zh?: string;

  @ApiPropertyOptional()
  public declare en?: string;
}

export class InstitutionProfileDto {
  @ApiProperty({ enum: INSTITUTION_KINDS })
  public declare kind: InstitutionKind;

  @ApiPropertyOptional({ type: () => LocalizedTextDto })
  public declare summary?: LocalizedTextDto;

  @ApiPropertyOptional({ format: "uri" })
  public declare websiteUrl?: string;

  @ApiPropertyOptional({ format: "uri", description: "The institution's own live panda camera, linked and never embedded." })
  public declare liveCamUrl?: string;

  @ApiProperty({ format: "date", description: "The day an editor last checked the profile against its sources." })
  public declare verifiedOn: string;

  @ApiProperty({ type: String, format: "uri", isArray: true })
  public declare sourceUrls: string[];
}

export class FacilityVisitTipDto {
  @ApiProperty({ enum: VISIT_TIP_TOPICS })
  public declare topic: VisitTipTopic;

  @ApiProperty({ type: () => LocalizedTextDto })
  public declare text: LocalizedTextDto;
}

export class TimeWindowDto {
  @ApiProperty({ pattern: "^([01]\\d|2[0-3]):[0-5]\\d$", description: "Local time, HH:MM." })
  public declare start: string;

  @ApiProperty({ pattern: "^([01]\\d|2[0-3]):[0-5]\\d$", description: "Local time, HH:MM." })
  public declare end: string;
}

export class ViewingTimingDto {
  @ApiProperty({ type: () => TimeWindowDto, isArray: true, description: "When the pandas are usually active, as the facility publishes." })
  public declare activeWindows: TimeWindowDto[];

  @ApiPropertyOptional({ type: () => TimeWindowDto, description: "The usual midday rest." })
  public declare napWindow?: TimeWindowDto;
}

export class PhotoSpotDto {
  @ApiProperty({ type: () => LocalizedTextDto })
  public declare name: LocalizedTextDto;

  @ApiPropertyOptional({ type: () => TimeWindowDto })
  public declare window?: TimeWindowDto;
}

export class FacilityVisitGuideDto {
  @ApiPropertyOptional({ type: () => LocalizedTextDto })
  public declare address?: LocalizedTextDto;

  @ApiPropertyOptional({ type: () => LocalizedTextDto })
  public declare openingHours?: LocalizedTextDto;

  @ApiPropertyOptional({ type: () => LocalizedTextDto })
  public declare admission?: LocalizedTextDto;

  @ApiPropertyOptional({ type: () => LocalizedTextDto })
  public declare pandaArea?: LocalizedTextDto;

  @ApiProperty({ type: () => FacilityVisitTipDto, isArray: true })
  public declare tips: FacilityVisitTipDto[];

  @ApiPropertyOptional({ type: () => ViewingTimingDto })
  public declare viewing?: ViewingTimingDto;

  @ApiPropertyOptional({ type: () => PhotoSpotDto, isArray: true })
  public declare photoSpots?: PhotoSpotDto[];

  @ApiProperty({ format: "date", description: "Opening hours and prices change; this is the day they were last checked." })
  public declare verifiedOn: string;

  @ApiProperty({ type: String, format: "uri", isArray: true })
  public declare sourceUrls: string[];
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

  @ApiPropertyOptional({ type: () => FacilityVisitGuideDto, description: "How to see the pandas here; facilities only." })
  public declare visitGuide?: FacilityVisitGuideDto;

  @ApiPropertyOptional({
    type: [String],
    description: "Slugs of duplicate places merged into this one; a request for one of them returns this place.",
  })
  public declare legacySlugs?: string[];
}

export class PublicInstitutionSummaryDto {
  @ApiProperty({ format: "uuid" })
  public declare institutionId: string;

  @ApiProperty()
  public declare slug: string;

  @ApiPropertyOptional()
  public declare nameZh?: string;

  @ApiPropertyOptional()
  public declare nameEn?: string;

  @ApiPropertyOptional()
  public declare countryCode?: string;

  @ApiPropertyOptional({ type: () => InstitutionProfileDto })
  public declare profile?: InstitutionProfileDto;
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

  @ApiPropertyOptional()
  public declare fullBleedReady?: boolean;
}

export class PandaCoversQueryDto {
  @ApiProperty({ type: String, description: "Comma-separated panda IDs, at most 50.", example: "7cf4e916-4801-5b2e-b49b-4e33bb50d5d6" })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.split(",").map((id) => id.trim()).filter(Boolean) : value)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID("all", { each: true })
  public declare ids: string[];
}

export class PublicPandaCoverListDto {
  @ApiProperty({ type: () => PublicReadReleaseDto })
  public declare release: PublicReadReleaseDto;

  @ApiProperty({
    type: () => PublicMediaSummaryDto,
    isArray: true,
    description: "The first deliverable image of each requested panda, in display order; pandas without one are omitted.",
  })
  public declare items: PublicMediaSummaryDto[];
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

  @ApiProperty({
    type: () => PublicPandaSummaryDto,
    isArray: true,
    description:
      "Parents, children, siblings and grandparents of the panda, for profile family sections. Facts are limited to sex, life_status, birth_date and death_date.",
  })
  public declare relatives: PublicPandaSummaryDto[];

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

  @ApiProperty({
    type: () => PublicPandaSummaryDto,
    isArray: true,
    description: "Facts are limited to sex, life_status, birth_date and death_date; the panda detail carries every fact.",
  })
  public declare items: PublicPandaSummaryDto[];
}

export class PublicPlaceListDto {
  @ApiProperty({ type: () => PublicReadReleaseDto })
  public declare release: PublicReadReleaseDto;

  @ApiProperty({ type: () => PublicPlaceSummaryDto, isArray: true })
  public declare items: PublicPlaceSummaryDto[];
}

export class PublicInstitutionListDto {
  @ApiProperty({ type: () => PublicReadReleaseDto })
  public declare release: PublicReadReleaseDto;

  @ApiProperty({ type: () => PublicInstitutionSummaryDto, isArray: true })
  public declare items: PublicInstitutionSummaryDto[];
}

export class PublicFormerResidentSummaryDto {
  @ApiProperty({ type: () => PublicPandaSummaryDto })
  public declare panda: PublicPandaSummaryDto;

  @ApiPropertyOptional()
  public declare fromYear?: number;

  @ApiPropertyOptional()
  public declare toYear?: number;

  @ApiProperty()
  public declare bornHere: boolean;
}

export class PublicInstitutionDetailDto {
  @ApiProperty({ type: () => PublicReadReleaseDto })
  public declare release: PublicReadReleaseDto;

  @ApiProperty({ type: () => PublicInstitutionSummaryDto })
  public declare institution: PublicInstitutionSummaryDto;

  @ApiProperty({ type: () => PublicPlaceSummaryDto, isArray: true, description: "The institution's deliverable facilities." })
  public declare places: PublicPlaceSummaryDto[];

  @ApiProperty({ type: () => PublicPandaSummaryDto, isArray: true })
  public declare residents: PublicPandaSummaryDto[];

  @ApiProperty({ type: () => PublicFormerResidentSummaryDto, isArray: true })
  public declare former: PublicFormerResidentSummaryDto[];

  @ApiProperty({ minimum: 0 })
  public declare bornHereCount: number;
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
