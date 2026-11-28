import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsString, MaxLength, MinLength } from "class-validator";

function normalizeProfileText(value: unknown): unknown {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value;
}

export class StoreAppleTokenDto {
  @ApiProperty({ maxLength: 2048 })
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  public authorizationCode!: string;
}

export class StoreAppleTokenResponseDto {
  @ApiProperty()
  public declare stored: boolean;
}

export class ReplaceProfileDto {
  @ApiProperty({ maxLength: 40 })
  @Transform(({ value }) => normalizeProfileText(value))
  @IsString()
  @MaxLength(40)
  public nickname!: string;

  @ApiProperty({ maxLength: 280 })
  @Transform(({ value }) => normalizeProfileText(value))
  @IsString()
  @MaxLength(280)
  public bio!: string;
}

export class CurrentAccountDto {
  @ApiProperty({ format: "uuid" })
  public declare accountId: string;

  @ApiProperty({ enum: ["aal1", "aal2"] })
  public declare aal: "aal1" | "aal2";

  @ApiProperty({ type: String, isArray: true })
  public declare capabilities: string[];
}

export class ProvisionedAccountDto {
  @ApiProperty({ format: "uuid" })
  public declare accountId: string;

  @ApiProperty({ enum: ["active"] })
  public declare state: "active";

  @ApiProperty({ type: String, isArray: true })
  public declare capabilities: string[];
}

export class FanProfileDto {
  @ApiProperty({ format: "uuid" })
  public declare accountId: string;

  @ApiProperty()
  public declare nickname: string;

  @ApiProperty()
  public declare bio: string;
}
