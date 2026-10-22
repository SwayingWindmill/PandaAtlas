import { Body, Controller, Get, HttpCode, Inject, Post, Query, Req } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { IncomingMessage as HttpRequest } from "node:http";
import { Public } from "../../../platform/auth/public.decorator.js";
import { ProblemException } from "../../../platform/http/problem.exception.js";
import { RequireCapabilities } from "../../identity/http/access.metadata.js";
import { getActorContext } from "../../identity/http/request-actor.js";
import { DAILY_PANDA_PORT, type DailyPandaApplication } from "../application/daily-panda.application.js";
import { GAME_PORT, type GamePort } from "../application/game.application.js";
import { PANDA_BOOK_PORT, type PandaBookApplication } from "../application/panda-book.application.js";
import {
  DailyPandaGuessesDto,
  DailyPandaGuessResultDto,
  DailyPandaPuzzleDto,
  GameAttemptListDto,
  GuessAnswerDto,
  GuessQuestionDto,
  GuessQuestionQueryDto,
  GuessResultDto,
  PandaBookDto,
  RandomPandaDto,
  SavedDailyPandaDto,
  SavedGameAttemptDto,
} from "./game.dto.js";

function accountId(request: HttpRequest): string {
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

@ApiTags("Games")
@Controller("games")
export class GameController {
  public constructor(@Inject(GAME_PORT) private readonly game: GamePort) {}

  @Get("random-panda")
  @Public()
  @ApiOperation({ operationId: "getRandomPanda" })
  @ApiOkResponse({ type: RandomPandaDto })
  public async randomPanda() {
    const candidate = await this.game.randomPandaCandidate();
    if (candidate === undefined) {
      throw new ProblemException(404, "game.candidateNotFound", "No published random-panda candidate is available.");
    }
    return candidate;
  }

  @Get("guess/question")
  @Public()
  @ApiOperation({ operationId: "getGuessQuestion" })
  @ApiOkResponse({ type: GuessQuestionDto })
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
  @ApiOperation({ operationId: "answerGuessQuestion" })
  @ApiOkResponse({ type: GuessResultDto })
  public async answerGuess(@Body() input: GuessAnswerDto) {
    const result = await this.game.evaluateGuess(input.questionId, input.selectedPandaId);
    if (result.kind !== "answer") gameProblem(result.kind);
    return result.answer;
  }
}

function dailyPandaUnavailable(): never {
  throw new ProblemException(503, "game.dailyPandaUnavailable", "Today's Daily Panda is not available.");
}

function dailyPandaGuessProblem(kind: "unknown_panda" | "too_many_guesses" | "unavailable"): never {
  if (kind === "unknown_panda") {
    throw new ProblemException(422, "game.unknownPanda", "A guessed panda is not a published panda.");
  }
  if (kind === "too_many_guesses") {
    throw new ProblemException(422, "game.tooManyGuesses", "Daily Panda allows at most six guesses.");
  }
  dailyPandaUnavailable();
}

@ApiTags("Games")
@Controller("games/daily-panda")
export class DailyPandaController {
  public constructor(@Inject(DAILY_PANDA_PORT) private readonly dailyPanda: DailyPandaApplication) {}

  @Get()
  @Public()
  @ApiOperation({ operationId: "getDailyPanda" })
  @ApiOkResponse({ type: DailyPandaPuzzleDto })
  public async today() {
    const result = await this.dailyPanda.today();
    if (result.kind !== "ok") dailyPandaUnavailable();
    return result.puzzle;
  }

  @Post("guesses")
  @HttpCode(200)
  @Public()
  @ApiOperation({ operationId: "guessDailyPanda" })
  @ApiOkResponse({ type: DailyPandaGuessResultDto })
  public async guess(@Body() input: DailyPandaGuessesDto) {
    const result = await this.dailyPanda.guess(input.guessPandaIds);
    if (result.kind !== "ok") dailyPandaGuessProblem(result.kind);
    return result.result;
  }
}

@ApiTags("Games")
@Controller("me/game-attempts")
export class GameAttemptController {
  public constructor(@Inject(GAME_PORT) private readonly game: GamePort) {}

  @Get()
  @RequireCapabilities("game.attempt.read")
  @ApiOperation({ operationId: "listGameAttempts" })
  @ApiOkResponse({ type: GameAttemptListDto })
  public async listAttempts(@Req() request: HttpRequest) {
    return { items: await this.game.listAttempts(accountId(request)) };
  }

  @Post()
  @RequireCapabilities("game.attempt.manage")
  @ApiOperation({ operationId: "saveGameAttempt" })
  @ApiCreatedResponse({ type: SavedGameAttemptDto })
  public async saveAttempt(@Req() request: HttpRequest, @Body() input: GuessAnswerDto) {
    const result = await this.game.saveAttempt(accountId(request), input.questionId, input.selectedPandaId);
    if (result.kind !== "saved") gameProblem(result.kind);
    return { attempt: result.attempt, answer: result.answer };
  }
}

@ApiTags("Games")
@Controller("me")
export class PandaBookController {
  public constructor(@Inject(PANDA_BOOK_PORT) private readonly pandaBook: PandaBookApplication) {}

  @Get("panda-book")
  @RequireCapabilities("game.attempt.read")
  @ApiOperation({ operationId: "getPandaBook" })
  @ApiOkResponse({ type: PandaBookDto })
  public async book(@Req() request: HttpRequest) {
    const book = await this.pandaBook.book(accountId(request));
    if (book === undefined) {
      throw new ProblemException(503, "game.pandaBookUnavailable", "The panda book is not available.");
    }
    return book;
  }

  @Post("daily-panda-results")
  @RequireCapabilities("game.attempt.manage")
  @ApiOperation({ operationId: "saveDailyPandaResult" })
  @ApiCreatedResponse({ type: SavedDailyPandaDto })
  public async saveDailyPanda(@Req() request: HttpRequest, @Body() input: DailyPandaGuessesDto) {
    const result = await this.pandaBook.saveDailyPanda(accountId(request), input.guessPandaIds);
    if (result.kind === "not_finished") {
      throw new ProblemException(422, "game.dailyPandaNotFinished", "Only a finished Daily Panda can be saved.");
    }
    if (result.kind !== "ok") dailyPandaGuessProblem(result.kind);
    return { result: result.result, saved: result.saved };
  }
}
