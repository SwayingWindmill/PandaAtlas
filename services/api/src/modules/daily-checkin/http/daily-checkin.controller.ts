import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, Req } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { IncomingMessage as HttpRequest } from "node:http";
import { ProblemException } from "../../../platform/http/problem.exception.js";
import { RequireCapabilities } from "../../identity/http/access.metadata.js";
import { getActorContext } from "../../identity/http/request-actor.js";
import {
  DAILY_CHECKIN_PORT,
  type DailyCheckinPort,
  type DailyCheckinResult,
} from "../application/daily-checkin.application.js";
import { DailyCheckinSummaryDto, DailyCheckinTodayDto } from "./daily-checkin.dto.js";

function accountId(request: HttpRequest): string {
  const actor = getActorContext(request);
  if (actor === undefined) {
    throw new ProblemException(500, "system.internal", "The actor context is unavailable.");
  }
  return actor.accountId;
}

const DAY_PARAM = /^\d{4}-\d{2}-\d{2}$/;

function leaveDay(day: string): string {
  if (!DAY_PARAM.test(day)) {
    throw new ProblemException(400, "request.invalid", "The day must be a YYYY-MM-DD date.");
  }
  return day;
}

function dailyCheckinSummary(result: DailyCheckinResult) {
  if (result.ok) return result.summary;
  switch (result.refusal) {
    case "todayOutOfRange":
      throw new ProblemException(422, "engagement.todayOutOfRange", "The local date is more than a day away from the server date.");
    case "quotaUsed":
      throw new ProblemException(409, "engagement.leaveQuotaUsed", "This month's leave days are already used.");
    case "dayClosed":
      throw new ProblemException(409, "engagement.leaveDayClosed", "Leave cannot change for this day.");
  }
}

@ApiTags("Engagement")
@Controller("me/daily-checkins")
export class DailyCheckinController {
  public constructor(@Inject(DAILY_CHECKIN_PORT) private readonly checkins: DailyCheckinPort) {}

  @Get()
  @RequireCapabilities("engagement.read")
  @ApiOperation({ operationId: "getDailyCheckins" })
  @ApiOkResponse({ type: DailyCheckinSummaryDto })
  public async dailyCheckins(@Req() request: HttpRequest, @Query() query: DailyCheckinTodayDto) {
    return dailyCheckinSummary(await this.checkins.dailyCheckins(accountId(request), query.today));
  }

  @Post()
  @RequireCapabilities("engagement.manage")
  @ApiOperation({ operationId: "recordDailyCheckin" })
  @ApiCreatedResponse({ type: DailyCheckinSummaryDto })
  public async recordDailyCheckin(@Req() request: HttpRequest, @Body() input: DailyCheckinTodayDto) {
    return dailyCheckinSummary(await this.checkins.recordDailyVisit(accountId(request), input.today));
  }

  @Put("leave/:day")
  @RequireCapabilities("engagement.manage")
  @ApiOperation({ operationId: "takeDailyLeave" })
  @ApiOkResponse({ type: DailyCheckinSummaryDto })
  public async takeDailyLeave(
    @Req() request: HttpRequest,
    @Param("day") day: string,
    @Body() input: DailyCheckinTodayDto,
  ) {
    return dailyCheckinSummary(await this.checkins.takeDailyLeave(accountId(request), leaveDay(day), input.today));
  }

  @Delete("leave/:day")
  @RequireCapabilities("engagement.manage")
  @ApiOperation({ operationId: "cancelDailyLeave" })
  @ApiOkResponse({ type: DailyCheckinSummaryDto })
  public async cancelDailyLeave(
    @Req() request: HttpRequest,
    @Param("day") day: string,
    @Query() query: DailyCheckinTodayDto,
  ) {
    return dailyCheckinSummary(await this.checkins.cancelDailyLeave(accountId(request), leaveDay(day), query.today));
  }
}
