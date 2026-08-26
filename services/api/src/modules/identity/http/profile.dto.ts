import { Transform } from "class-transformer";
import { IsString, MaxLength } from "class-validator";

function normalizeProfileText(value: unknown): unknown {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value;
}

export class ReplaceProfileDto {
  @Transform(({ value }) => normalizeProfileText(value))
  @IsString()
  @MaxLength(40)
  public nickname!: string;

  @Transform(({ value }) => normalizeProfileText(value))
  @IsString()
  @MaxLength(280)
  public bio!: string;
}
