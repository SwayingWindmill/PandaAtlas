import { Body, Controller, DefaultValuePipe, Delete, Get, Inject, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { IncomingMessage as HttpRequest } from "node:http";
import { ProblemException } from "../../../platform/http/problem.exception.js";
import { RateLimit } from "../../../platform/rate-limit/rate-limit.decorator.js";
import { RequireCapabilities } from "../../identity/http/access.metadata.js";
import { getActorContext } from "../../identity/http/request-actor.js";
import { NOTIFICATION_PORT, type NotificationPort } from "../application/notification.application.js";
import {
  NotificationBulkReadResultDto,
  NotificationDeviceDeleteResultDto,
  NotificationDeviceDto,
  NotificationDeviceInputDto,
  NotificationMessageDto,
  NotificationPreferenceDto,
  NotificationPreferenceInputDto,
} from "./notification.dto.js";

function accountId(request: HttpRequest): string {
  const actor = getActorContext(request);
  if (actor === undefined) {
    throw new ProblemException(500, "system.internal", "The actor context is unavailable.");
  }
  return actor.accountId;
}

@ApiTags("Notification")
@ApiBearerAuth("supabaseJwt")
@Controller("me/notifications")
export class NotificationController {
  public constructor(@Inject(NOTIFICATION_PORT) private readonly notifications: NotificationPort) {}

  @Get()
  @RequireCapabilities("notification.read")
  @ApiOperation({ operationId: "listMyNotifications", summary: "List the signed-in account notification inbox" })
  @ApiQuery({ name: "limit", required: false, type: Number, minimum: 1, maximum: 100 })
  @ApiOkResponse({ type: NotificationMessageDto, isArray: true })
  public list(
    @Req() request: HttpRequest,
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.notifications.listMessages(accountId(request), limit);
  }

  @Patch(":messageId/read")
  @RequireCapabilities("notification.manage")
  @RateLimit("write")
  @ApiOperation({ operationId: "markMyNotificationRead", summary: "Mark one inbox item read" })
  @ApiOkResponse({ type: NotificationMessageDto })
  public async markRead(
    @Req() request: HttpRequest,
    @Param("messageId", ParseUUIDPipe) messageId: string,
  ) {
    const message = await this.notifications.markRead(accountId(request), messageId);
    if (message === undefined) {
      throw new ProblemException(404, "notification.messageNotFound", "The notification does not exist.");
    }
    return message;
  }

  @Patch("read-all")
  @RequireCapabilities("notification.manage")
  @RateLimit("write")
  @ApiOperation({ operationId: "markAllMyNotificationsRead", summary: "Mark every unread inbox item read" })
  @ApiOkResponse({ type: NotificationBulkReadResultDto })
  public async markAllRead(@Req() request: HttpRequest) {
    return { updatedCount: await this.notifications.markAllRead(accountId(request)) };
  }

  @Get("preferences")
  @RequireCapabilities("notification.read")
  @ApiOperation({ operationId: "listMyNotificationPreferences", summary: "List effective notification preferences" })
  @ApiOkResponse({ type: NotificationPreferenceDto, isArray: true })
  public preferences(@Req() request: HttpRequest) {
    return this.notifications.listPreferences(accountId(request));
  }

  @Put("preferences")
  @RequireCapabilities("notification.manage")
  @RateLimit("write")
  @ApiOperation({ operationId: "setMyNotificationPreference", summary: "Set one notification channel preference" })
  @ApiOkResponse({ type: NotificationPreferenceDto })
  public setPreference(@Req() request: HttpRequest, @Body() input: NotificationPreferenceInputDto) {
    return this.notifications.setPreference(accountId(request), input.category, input.channel, input.enabled);
  }

  @Get("devices")
  @RequireCapabilities("notification.read")
  @ApiOperation({ operationId: "listMyNotificationDevices", summary: "List registered push notification devices" })
  @ApiOkResponse({ type: NotificationDeviceDto, isArray: true })
  public listDevices(@Req() request: HttpRequest) {
    return this.notifications.listDevices(accountId(request));
  }

  @Post("devices")
  @RequireCapabilities("notification.manage")
  @RateLimit("write")
  @ApiOperation({ operationId: "registerMyNotificationDevice", summary: "Register or refresh an Expo push token" })
  @ApiCreatedResponse({ type: NotificationDeviceDto })
  public registerDevice(@Req() request: HttpRequest, @Body() input: NotificationDeviceInputDto) {
    return this.notifications.registerDevice(accountId(request), input.expoPushToken, input.platform);
  }

  @Delete("devices/:tokenId")
  @RequireCapabilities("notification.manage")
  @RateLimit("write")
  @ApiOperation({ operationId: "removeMyNotificationDevice", summary: "Unregister an Expo push token" })
  @ApiOkResponse({ type: NotificationDeviceDeleteResultDto })
  public async removeDevice(
    @Req() request: HttpRequest,
    @Param("tokenId", ParseUUIDPipe) tokenId: string,
  ) {
    const removed = await this.notifications.removeDevice(accountId(request), tokenId);
    if (!removed) {
      throw new ProblemException(404, "notification.deviceNotFound", "The notification device does not exist.");
    }
    return { deviceTokenId: tokenId, removed: true };
  }
}
