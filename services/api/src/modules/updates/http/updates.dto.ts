import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateTargetDto {
  @ApiProperty({ enum: ["panda", "institution", "place", "lineage", "residency", "life_event", "media", "evidence"] })
  public declare resourceKind: string;

  @ApiProperty()
  public declare resourceId: string;

  @ApiProperty({ enum: ["added", "changed", "removed"] })
  public declare changeType: string;
}

export class UpdateItemDto {
  @ApiProperty({ format: "uuid" })
  public declare updateId: string;

  @ApiProperty({ enum: ["release_activated", "release_rolled_back"] })
  public declare updateType: string;

  @ApiProperty({ format: "uuid" })
  public declare releaseId: string;

  @ApiPropertyOptional({ format: "uuid" })
  public declare previousReleaseId?: string;

  @ApiProperty()
  public declare releaseVersion: string;

  @ApiProperty({ format: "date-time" })
  public declare occurredAt: string;

  @ApiProperty({ format: "date-time" })
  public declare publishedAt: string;

  @ApiProperty({ type: () => UpdateTargetDto, isArray: true })
  public declare targets: UpdateTargetDto[];
}
