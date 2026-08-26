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
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  public name!: string;
}

export class CreateCheckinDto {
  @IsUUID()
  public placeId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  public visitedOn!: string;

  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(280)
  public note?: string | null;
}

export class SaveSeenPandaDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  public seenOn?: string | null;

  @IsOptional()
  @IsUUID()
  public placeId?: string | null;

  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(280)
  public note?: string | null;
}
