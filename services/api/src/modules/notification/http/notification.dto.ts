import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsIn } from "class-validator";

export class NotificationPreferenceInputDto {
  @ApiProperty({ enum: ["knowledge_update", "correction"] })
  @IsIn(["knowledge_update", "correction"])
  public declare category: "knowledge_update" | "correction";

  @ApiProperty({ enum: ["station", "email"] })
  @IsIn(["station", "email"])
  public declare channel: "station" | "email";

  @ApiProperty()
  @IsBoolean()
  public declare enabled: boolean;
}

export class NotificationPreferenceDto {
  @ApiProperty({ enum: ["knowledge_update", "correction"] })
  public declare category: string;

  @ApiProperty({ enum: ["station", "email"] })
  public declare channel: string;

  @ApiProperty()
  public declare enabled: boolean;

  @ApiProperty()
  public declare version: number;

  @ApiProperty({ type: String, nullable: true, format: "date-time" })
  public declare updatedAt: string | null;
}

export class NotificationMessageDto {
  @ApiProperty({ format: "uuid" })
  public declare messageId: string;

  @ApiProperty({ enum: ["knowledge_update", "correction"] })
  public declare category: string;

  @ApiProperty({ type: Object, additionalProperties: true })
  public declare content: Record<string, unknown>;

  @ApiProperty({ format: "date-time" })
  public declare createdAt: string;

  @ApiProperty({ type: String, nullable: true, format: "date-time" })
  public declare seenAt: string | null;

  @ApiProperty({ type: String, nullable: true, format: "date-time" })
  public declare readAt: string | null;
}

export class NotificationBulkReadResultDto {
  @ApiProperty({ type: Number })
  public declare updatedCount: number;
}
