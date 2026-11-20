import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from "class-validator";

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

export class PublicationReleaseListQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 10 })
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

  @ApiPropertyOptional({ enum: ["building", "sealed"] })
  @IsOptional()
  @IsIn(["building", "sealed"])
  public lifecycleState?: "building" | "sealed";
}

export class PublicationResourceCountsDto {
  @ApiProperty() public declare panda: number;
  @ApiProperty() public declare institution: number;
  @ApiProperty() public declare place: number;
  @ApiProperty() public declare lineage: number;
  @ApiProperty() public declare residency: number;
  @ApiProperty() public declare lifeEvent: number;
  @ApiProperty() public declare media: number;
  @ApiProperty() public declare evidence: number;
}

export class PublicationReleaseSummaryDto extends PublicReleaseDto {
  @ApiProperty() public declare isCurrent: boolean;
  @ApiProperty() public declare suspended: boolean;
  @ApiProperty({ type: () => PublicationResourceCountsDto })
  public declare counts: PublicationResourceCountsDto;
  @ApiProperty({ type: String, isArray: true })
  public declare blockers: string[];
}

export class PublicationReleasePageDto {
  @ApiPropertyOptional({ format: "uuid" })
  public declare currentReleaseId?: string;
  @ApiPropertyOptional({ type: () => PublicationReleaseSummaryDto })
  public declare currentRelease?: PublicationReleaseSummaryDto;
  @ApiProperty({ type: () => PublicationReleaseSummaryDto, isArray: true })
  public declare items: PublicationReleaseSummaryDto[];
  @ApiProperty() public declare total: number;
  @ApiProperty() public declare limit: number;
  @ApiProperty() public declare offset: number;
}

export class PublicationChangeSummaryDto {
  @ApiProperty({ enum: ["panda", "institution", "place", "lineage", "residency", "life_event", "media", "evidence"] })
  public declare resourceKind: string;
  @ApiProperty() public declare added: number;
  @ApiProperty() public declare changed: number;
  @ApiProperty() public declare removed: number;
}

export class PublicationChangeDetailDto {
  @ApiProperty({ enum: ["panda", "institution", "place", "lineage", "residency", "life_event", "media", "evidence"] })
  public declare resourceKind: string;
  @ApiProperty() public declare resourceId: string;
  @ApiProperty({ enum: ["added", "changed", "removed"] }) public declare changeType: "added" | "changed" | "removed";
}

export class PublicationChangePageQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  public changeLimit?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  public changeOffset?: number;
}

export class PublicationTransitionDto {
  @ApiProperty({ format: "uuid" }) public declare transitionId: string;
  @ApiProperty({ enum: ["built", "sealed", "activated", "rolled_back", "suspended", "restored"] })
  public declare transitionType: string;
  @ApiPropertyOptional({ format: "uuid" }) public declare fromReleaseId?: string;
  @ApiProperty() public declare actor: string;
  @ApiProperty() public declare reason: string;
  @ApiProperty({ format: "date-time" }) public declare occurredAt: string;
}

export class PublicationReleaseInspectionDto {
  @ApiPropertyOptional({ format: "uuid" })
  public declare currentReleaseId?: string;
  @ApiProperty({ type: () => PublicationReleaseSummaryDto })
  public declare release: PublicationReleaseSummaryDto;
  @ApiProperty({ type: () => PublicationChangeSummaryDto, isArray: true })
  public declare changes: PublicationChangeSummaryDto[];
  @ApiProperty() public declare changeTotal: number;
  @ApiProperty() public declare changeOffset: number;
  @ApiProperty({ type: () => PublicationChangeDetailDto, isArray: true })
  public declare changeItems: PublicationChangeDetailDto[];
  @ApiProperty({ type: () => PublicationTransitionDto, isArray: true })
  public declare transitions: PublicationTransitionDto[];
}
