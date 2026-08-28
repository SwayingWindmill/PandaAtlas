import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsUUID } from "class-validator";
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
