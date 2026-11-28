import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsString, Matches, MaxLength } from "class-validator";
import {
  EXPO_PUSH_TOKEN_PATTERN,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  type NotificationCategory,
  type NotificationChannel,
} from "../application/notification.application.js";

export class NotificationPreferenceInputDto {
  @ApiProperty({ enum: [...NOTIFICATION_CATEGORIES] })
  @IsIn([...NOTIFICATION_CATEGORIES])
  public declare category: NotificationCategory;

  @ApiProperty({ enum: [...NOTIFICATION_CHANNELS] })
  @IsIn([...NOTIFICATION_CHANNELS])
  public declare channel: NotificationChannel;

  @ApiProperty()
  @IsBoolean()
  public declare enabled: boolean;
}

export class NotificationPreferenceDto {
  @ApiProperty({ enum: [...NOTIFICATION_CATEGORIES] })
  public declare category: string;

  @ApiProperty({ enum: [...NOTIFICATION_CHANNELS] })
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

  @ApiProperty({ enum: [...NOTIFICATION_CATEGORIES] })
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

export class NotificationDeviceInputDto {
  @ApiProperty({ example: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" })
  @IsString()
  @MaxLength(255)
  @Matches(EXPO_PUSH_TOKEN_PATTERN, {
    message: "expoPushToken must match ExponentPushToken[...] or ExpoPushToken[...]",
  })
  public declare expoPushToken: string;

  @ApiProperty({ enum: ["ios", "android"] })
  @IsIn(["ios", "android"])
  public declare platform: "ios" | "android";
}

export class NotificationDeviceDto {
  @ApiProperty({ format: "uuid" })
  public declare deviceTokenId: string;

  @ApiProperty()
  public declare expoPushToken: string;

  @ApiProperty({ enum: ["ios", "android"] })
  public declare platform: string;

  @ApiProperty()
  public declare active: boolean;

  @ApiProperty({ format: "date-time" })
  public declare lastActiveAt: string;

  @ApiProperty({ format: "date-time" })
  public declare updatedAt: string;
}

export class NotificationDeviceDeleteResultDto {
  @ApiProperty({ format: "uuid" })
  public declare deviceTokenId: string;

  @ApiProperty()
  public declare removed: boolean;
}
