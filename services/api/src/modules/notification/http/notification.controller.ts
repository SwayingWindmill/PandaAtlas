import { Body, Controller, DefaultValuePipe, Get, Inject, Param, ParseIntPipe, ParseUUIDPipe, Patch, Put, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";
import { ProblemException } from "../../../platform/http/problem.exception.js";
import { RequireCapabilities } from "../../identity/http/access.metadata.js";
import { getActorContext } from "../../identity/http/request-actor.js";
import { NOTIFICATION_PORT, type NotificationPort } from "../application/notification.application.js";
import {
  NotificationBulkReadResultDto,
  NotificationMessageDto,
  NotificationPreferenceDto,
  NotificationPreferenceInputDto,
} from "./notification.dto.js";

function accountId(request: FastifyRequest): string {
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
    @Req() request: FastifyRequest,
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.notifications.listMessages(accountId(request), limit);
  }

  @Patch(":messageId/read")
  @RequireCapabilities("notification.manage")
  @ApiOperation({ operationId: "markMyNotificationRead", summary: "Mark one inbox item read" })
  @ApiOkResponse({ type: NotificationMessageDto })
  public async markRead(
    @Req() request: FastifyRequest,
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
  @ApiOperation({ operationId: "markAllMyNotificationsRead", summary: "Mark every unread inbox item read" })
  @ApiOkResponse({ type: NotificationBulkReadResultDto })
  public async markAllRead(@Req() request: FastifyRequest) {
    return { updatedCount: await this.notifications.markAllRead(accountId(request)) };
  }

  @Get("preferences")
  @RequireCapabilities("notification.read")
  @ApiOperation({ operationId: "listMyNotificationPreferences", summary: "List effective notification preferences" })
  @ApiOkResponse({ type: NotificationPreferenceDto, isArray: true })
  public preferences(@Req() request: FastifyRequest) {
    return this.notifications.listPreferences(accountId(request));
  }

  @Put("preferences")
  @RequireCapabilities("notification.manage")
  @ApiOperation({ operationId: "setMyNotificationPreference", summary: "Set one notification channel preference" })
  @ApiOkResponse({ type: NotificationPreferenceDto })
  public setPreference(@Req() request: FastifyRequest, @Body() input: NotificationPreferenceInputDto) {
    return this.notifications.setPreference(accountId(request), input.category, input.channel, input.enabled);
  }
}
