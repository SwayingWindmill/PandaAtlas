import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsOptional, IsUUID } from "class-validator";
import { DAILY_PANDA_MAX_GUESSES, type BirthYearHint } from "../application/daily-panda.application.js";
import type { GameDifficulty } from "../application/game.application.js";

export class GuessQuestionQueryDto {
  @ApiPropertyOptional({ enum: ["easy", "medium", "hard"] })
  @IsOptional()
  @IsIn(["easy", "medium", "hard"])
  public difficulty?: GameDifficulty;
}

export class GuessAnswerDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  public questionId!: string;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  public selectedPandaId!: string;
}

export class RandomPandaDto {
  @ApiProperty({ format: "uuid" })
  public declare pandaId: string;
}

export class GuessQuestionDto {
  @ApiProperty({ format: "uuid" })
  public declare questionId: string;

  @ApiProperty({ format: "uuid" })
  public declare mediaAssetId: string;

  @ApiProperty({ description: "Public object key of the question photo in the active release." })
  public declare photoObjectKey: string;

  @ApiProperty({ enum: ["easy", "medium", "hard"] })
  public declare difficulty: GameDifficulty;

  @ApiProperty({ type: String, isArray: true, format: "uuid" })
  public declare optionPandaIds: string[];
}

export class GuessResultDto {
  @ApiProperty()
  public declare correct: boolean;

  @ApiProperty({ format: "uuid" })
  public declare answerPandaId: string;

  @ApiProperty({ type: String, isArray: true })
  public declare recognitionTips: string[];
}

export class GameAttemptDto {
  @ApiProperty({ format: "uuid" })
  public declare attemptId: string;

  @ApiProperty({ format: "uuid" })
  public declare questionId: string;

  @ApiProperty({ format: "uuid" })
  public declare selectedPandaId: string;

  @ApiProperty()
  public declare correct: boolean;

  @ApiProperty({ format: "date-time" })
  public declare attemptedAt: string;
}

export class GameAttemptListDto {
  @ApiProperty({ type: () => GameAttemptDto, isArray: true })
  public declare items: GameAttemptDto[];
}

export class SavedGameAttemptDto {
  @ApiProperty({ type: () => GameAttemptDto })
  public declare attempt: GameAttemptDto;

  @ApiProperty({ type: () => GuessResultDto })
  public declare answer: GuessResultDto;
}

export class DailyPandaGuessesDto {
  @ApiProperty({ type: String, isArray: true, format: "uuid", maxItems: DAILY_PANDA_MAX_GUESSES })
  @IsArray()
  @ArrayMaxSize(DAILY_PANDA_MAX_GUESSES)
  @ArrayUnique()
  @IsUUID("all", { each: true })
  public guessPandaIds!: string[];
}

export class DailyPandaClueDto {
  @ApiProperty({ enum: ["sex", "birth_year", "life_status", "birthplace", "name_initial", "photo"] })
  public declare kind: string;

  @ApiPropertyOptional({
    description: "female | male for sex, a year for birth_year, alive | deceased for life_status, text otherwise. Absent for photo.",
    oneOf: [{ type: "string" }, { type: "integer" }],
  })
  public declare value?: string | number;

  @ApiPropertyOptional({ format: "uuid", description: "Photo clue only." })
  public declare assetId?: string;

  @ApiPropertyOptional({ description: "Photo clue only: the public media object key." })
  public declare objectKey?: string;
}

export class DailyPandaPuzzleDto {
  @ApiProperty({ format: "date" })
  public declare puzzleDate: string;

  @ApiProperty()
  public declare maxGuesses: number;

  @ApiProperty({ description: "How many clues today's panda has in total." })
  public declare clueCount: number;

  @ApiProperty({ type: () => DailyPandaClueDto, isArray: true })
  public declare clues: DailyPandaClueDto[];
}

export class DailyPandaGuessFeedbackDto {
  @ApiProperty({ format: "uuid" })
  public declare pandaId: string;

  @ApiProperty()
  public declare correct: boolean;

  @ApiProperty({ type: Boolean, nullable: true, description: "Null when either sex is unpublished." })
  public declare sameSex: boolean | null;

  @ApiProperty({ enum: ["answer_earlier", "answer_later", "same", "unknown"] })
  public declare birthYear: BirthYearHint;
}

export class DailyPandaAnswerDto {
  @ApiProperty({ format: "uuid" })
  public declare pandaId: string;

  @ApiProperty()
  public declare canonicalSlug: string;
}

export class DailyPandaGuessResultDto {
  @ApiProperty({ format: "date" })
  public declare puzzleDate: string;

  @ApiProperty()
  public declare solved: boolean;

  @ApiProperty()
  public declare finished: boolean;

  @ApiProperty({ type: () => DailyPandaGuessFeedbackDto, isArray: true })
  public declare guesses: DailyPandaGuessFeedbackDto[];

  @ApiProperty({ type: () => DailyPandaClueDto, isArray: true })
  public declare clues: DailyPandaClueDto[];

  @ApiPropertyOptional({ type: () => DailyPandaAnswerDto, description: "Present once the puzzle is finished." })
  public declare answer?: DailyPandaAnswerDto;
}

export class SavedDailyPandaDto {
  @ApiProperty({ type: () => DailyPandaGuessResultDto })
  public declare result: DailyPandaGuessResultDto;

  @ApiProperty({ description: "False when today's result was already saved; nothing changed." })
  public declare saved: boolean;
}

export class PandaBookEntryDto {
  @ApiProperty({ format: "uuid" })
  public declare pandaId: string;

  @ApiProperty({ enum: ["guess_panda", "daily_panda"], description: "The game where the fan first met this panda." })
  public declare firstGame: "guess_panda" | "daily_panda";

  @ApiProperty({ format: "date-time" })
  public declare firstMetAt: string;

  @ApiProperty({ format: "date-time" })
  public declare lastMetAt: string;

  @ApiProperty()
  public declare timesMet: number;
}

export class PandaBookDto {
  @ApiProperty({ description: "Pandas in the current public release." })
  public declare publishedCount: number;

  @ApiProperty()
  public declare knownCount: number;

  @ApiProperty({ type: () => PandaBookEntryDto, isArray: true, description: "Newest first." })
  public declare items: PandaBookEntryDto[];
}
