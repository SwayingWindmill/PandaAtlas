import { Body, Controller, Get, HttpCode, Inject, Post, Query, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { Public } from "../../../platform/auth/public.decorator.js";
import { ProblemException } from "../../../platform/http/problem.exception.js";
import { RequireCapabilities } from "../../identity/http/access.metadata.js";
import { getActorContext } from "../../identity/http/request-actor.js";
import { GAME_PORT, type GamePort } from "../application/game.application.js";
import { GuessAnswerDto, GuessQuestionQueryDto } from "./game.dto.js";

function accountId(request: FastifyRequest): string {
  const actor = getActorContext(request);
  if (actor === undefined) {
    throw new ProblemException(500, "system.internal", "The actor context is unavailable.");
  }
  return actor.accountId;
}

function gameProblem(kind: "question_not_found" | "invalid_option"): never {
  if (kind === "question_not_found") {
    throw new ProblemException(404, "game.questionNotFound", "The published game question does not exist.");
  }
  throw new ProblemException(422, "game.invalidOption", "The selected panda is not an option for this question.");
}

@Controller("games")
export class GameController {
  public constructor(@Inject(GAME_PORT) private readonly game: GamePort) {}

  @Get("random-panda")
  @Public()
  public async randomPanda() {
    const candidate = await this.game.randomPandaCandidate();
    if (candidate === undefined) {
      throw new ProblemException(404, "game.candidateNotFound", "No published random-panda candidate is available.");
    }
    return candidate;
  }

  @Get("guess/question")
  @Public()
  public async guessQuestion(@Query() query: GuessQuestionQueryDto) {
    const question = await this.game.getGuessQuestion(query.difficulty);
    if (question === undefined) {
      throw new ProblemException(404, "game.questionNotFound", "No published game question is available.");
    }
    return question;
  }

  @Post("guess/answer")
  @HttpCode(200)
  @Public()
  public async answerGuess(@Body() input: GuessAnswerDto) {
    const result = await this.game.evaluateGuess(input.questionId, input.selectedPandaId);
    if (result.kind !== "answer") gameProblem(result.kind);
    return result.answer;
  }
}

@Controller("me/game-attempts")
export class GameAttemptController {
  public constructor(@Inject(GAME_PORT) private readonly game: GamePort) {}

  @Get()
  @RequireCapabilities("game.attempt.read")
  public async listAttempts(@Req() request: FastifyRequest) {
    return { items: await this.game.listAttempts(accountId(request)) };
  }

  @Post()
  @RequireCapabilities("game.attempt.manage")
  public async saveAttempt(@Req() request: FastifyRequest, @Body() input: GuessAnswerDto) {
    const result = await this.game.saveAttempt(accountId(request), input.questionId, input.selectedPandaId);
    if (result.kind !== "saved") gameProblem(result.kind);
    return { attempt: result.attempt, answer: result.answer };
  }
}
