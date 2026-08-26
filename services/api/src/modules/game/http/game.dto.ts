import { IsIn, IsOptional, IsUUID } from "class-validator";
import type { GameDifficulty } from "../application/game.application.js";

export class GuessQuestionQueryDto {
  @IsOptional()
  @IsIn(["easy", "medium", "hard"])
  public difficulty?: GameDifficulty;
}

export class GuessAnswerDto {
  @IsUUID()
  public questionId!: string;

  @IsUUID()
  public selectedPandaId!: string;
}
