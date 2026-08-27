import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreatePrivacyRequestDto {
  @ApiProperty({ enum: ["access_export", "account_deletion"] })
  @IsIn(["access_export", "account_deletion"])
  public declare kind: "access_export" | "account_deletion";

  @ApiProperty({ minLength: 3, maxLength: 1000 })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  public declare reason: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  public declare idempotencyKey: string;
}

export class PrivacyRequestDto {
  @ApiProperty({ format: "uuid" })
  public declare requestId: string;

  @ApiProperty({ enum: ["access_export", "account_deletion"] })
  public declare kind: string;

  @ApiProperty({ enum: ["pending", "processing", "completed", "failed"] })
  public declare state: string;

  @ApiProperty()
  public declare reason: string;

  @ApiProperty({ format: "date-time" })
  public declare requestedAt: string;

  @ApiProperty({ format: "date-time" })
  public declare updatedAt: string;

  @ApiPropertyOptional({ format: "date-time" })
  public declare completedAt?: string;

  @ApiPropertyOptional({ format: "date-time" })
  public declare failedAt?: string;

  @ApiPropertyOptional()
  public declare failureCode?: string;
}

export class PrivacyExportDto {
  @ApiProperty({ format: "uuid" })
  public declare requestId: string;

  @ApiProperty({ format: "date-time" })
  public declare createdAt: string;

  @ApiProperty({ format: "date-time" })
  public declare expiresAt: string;

  @ApiProperty({ type: Object, additionalProperties: true })
  public declare payload: Record<string, unknown>;
}
