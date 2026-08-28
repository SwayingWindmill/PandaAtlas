import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from "class-validator";

function normalizeText(value: unknown): unknown {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value;
}

function normalizeOptionalText(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  const normalized = normalizeText(value);
  return normalized === "" ? null : normalized;
}

export class CollectionNameDto {
  @ApiProperty({ minLength: 1, maxLength: 80 })
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  public name!: string;
}

export class CreateCheckinDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  public placeId!: string;

  @ApiProperty({ format: "date" })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  public visitedOn!: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 280 })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(280)
  public note?: string | null;
}

export class SaveSeenPandaDto {
  @ApiPropertyOptional({ type: String, format: "date", nullable: true })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  public seenOn?: string | null;

  @ApiPropertyOptional({ type: String, format: "uuid", nullable: true })
  @IsOptional()
  @IsUUID()
  public placeId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 280 })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(280)
  public note?: string | null;
}

export class FavoriteDto {
  @ApiProperty({ format: "uuid" })
  public declare pandaId: string;

  @ApiProperty({ format: "date-time" })
  public declare favoritedAt: string;
}

export class FavoriteListDto {
  @ApiProperty({ type: () => FavoriteDto, isArray: true })
  public declare items: FavoriteDto[];
}

export class UnfavoriteDto {
  @ApiProperty({ format: "uuid" })
  public declare pandaId: string;

  @ApiProperty({ enum: [false] })
  public declare favorited: false;

  @ApiProperty({ type: "null" })
  public declare favoritedAt: null;
}

export class CollectionDto {
  @ApiProperty({ format: "uuid" })
  public declare collectionId: string;

  @ApiProperty()
  public declare name: string;

  @ApiProperty({ type: String, isArray: true, format: "uuid" })
  public declare pandaIds: string[];

  @ApiProperty({ format: "date-time" })
  public declare createdAt: string;

  @ApiProperty({ format: "date-time" })
  public declare updatedAt: string;
}

export class CollectionListDto {
  @ApiProperty({ type: () => CollectionDto, isArray: true })
  public declare items: CollectionDto[];
}

export class DeletedCollectionDto {
  @ApiProperty({ format: "uuid" })
  public declare collectionId: string;

  @ApiProperty({ enum: [true] })
  public declare deleted: true;
}

export class CheckinDto {
  @ApiProperty({ format: "uuid" })
  public declare checkinId: string;

  @ApiProperty({ format: "uuid" })
  public declare placeId: string;

  @ApiProperty({ format: "date" })
  public declare visitedOn: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  public declare note: string | null;

  @ApiProperty({ format: "date-time" })
  public declare createdAt: string;
}

export class CheckinListDto {
  @ApiProperty({ type: () => CheckinDto, isArray: true })
  public declare items: CheckinDto[];
}

export class DeletedCheckinDto {
  @ApiProperty({ format: "uuid" })
  public declare checkinId: string;

  @ApiProperty({ enum: [true] })
  public declare deleted: true;
}

export class SeenPandaDto {
  @ApiProperty({ format: "uuid" })
  public declare seenId: string;

  @ApiProperty({ format: "uuid" })
  public declare pandaId: string;

  @ApiPropertyOptional({ type: String, format: "date", nullable: true })
  public declare seenOn: string | null;

  @ApiPropertyOptional({ type: String, format: "uuid", nullable: true })
  public declare placeId: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  public declare note: string | null;

  @ApiProperty({ format: "date-time" })
  public declare firstSeenAt: string;

  @ApiProperty({ format: "date-time" })
  public declare updatedAt: string;
}

export class SeenPandaListDto {
  @ApiProperty({ type: () => SeenPandaDto, isArray: true })
  public declare items: SeenPandaDto[];
}

export class DeletedSeenPandaDto {
  @ApiProperty({ format: "uuid" })
  public declare pandaId: string;

  @ApiProperty({ enum: [true] })
  public declare deleted: true;
}
