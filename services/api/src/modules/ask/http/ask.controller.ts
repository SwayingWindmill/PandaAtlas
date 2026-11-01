import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { IncomingMessage as HttpRequest, ServerResponse } from "node:http";
import { ProblemException } from "../../../platform/http/problem.exception.js";
import { RequireCapabilities } from "../../identity/http/access.metadata.js";
import { getActorContext } from "../../identity/http/request-actor.js";
import { ASK_PORT, AskFailure, type AskApplication, type AskFailureCode, type AskOutcome } from "../application/ask.application.js";
import { AskAnswerDto, AskQuestionDto, AskStatusDto } from "./ask.dto.js";

const FAILURES: Record<AskFailureCode, [number, string]> = {
  "ask.disabled": [503, "Ask Panda is turned off."],
  "ask.questionEmpty": [400, "The question is empty."],
  "ask.questionTooLong": [400, "The question is longer than 500 characters."],
  "ask.rateLimited": [429, "Too many questions in a short time. Try again in a minute."],
  "ask.quotaExhausted": [429, "Today's questions are used up."],
  "ask.dailyCapReached": [429, "Ask Panda has answered all it can today."],
};

function accountId(request: HttpRequest): string {
  const actor = getActorContext(request);
  if (actor === undefined) throw new ProblemException(500, "system.internal", "The actor context is unavailable.");
  return actor.accountId;
}

function clientKey(request: HttpRequest, account: string): string {
  const ip = request.headers["cf-connecting-ip"];
  return typeof ip === "string" && ip !== "" ? `ip:${ip}` : `account:${account}`;
}

function toDto(outcome: AskOutcome): AskAnswerDto {
  if (outcome.kind === "answer") {
    return { kind: "answer", locale: outcome.locale, text: outcome.answer, links: outcome.sources, remainingToday: outcome.remainingToday };
  }
  return {
    kind: outcome.kind,
    locale: outcome.locale,
    text: outcome.message,
    ...(outcome.kind === "refusal" ? { reason: outcome.reason } : {}),
    links: outcome.links,
    remainingToday: outcome.remainingToday,
  };
}

@ApiTags("Ask")
@Controller("ask")
export class AskController {
  public constructor(@Inject(ASK_PORT) private readonly ask: AskApplication) {}

  @Get("status")
  @RequireCapabilities()
  @ApiOperation({ operationId: "getAskStatus", summary: "Whether Ask Panda is on and how many questions are left today" })
  @ApiOkResponse({ type: AskStatusDto })
  public async status(@Req() request: HttpRequest, @Res({ passthrough: true }) response: ServerResponse): Promise<AskStatusDto> {
    response.setHeader("Cache-Control", "no-store");
    return this.ask.status(accountId(request));
  }

  @Post()
  @HttpCode(200)
  @RequireCapabilities()
  @ApiOperation({ operationId: "askPanda", summary: "Answer a panda question from Zhipanda's published material, with sources" })
  @ApiOkResponse({ type: AskAnswerDto })
  public async question(
    @Req() request: HttpRequest,
    @Res({ passthrough: true }) response: ServerResponse,
    @Body() body: AskQuestionDto,
  ): Promise<AskAnswerDto> {
    // Answers are per person and short-lived; no cache may keep them.
    response.setHeader("Cache-Control", "no-store");
    const account = accountId(request);
    try {
      return toDto(await this.ask.ask(account, body.question, clientKey(request, account)));
    } catch (error) {
      if (!(error instanceof AskFailure)) throw error;
      const [status, detail] = FAILURES[error.code];
      throw new ProblemException(status, error.code, detail);
    }
  }
}
