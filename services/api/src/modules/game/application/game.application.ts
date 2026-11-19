export type GameDifficulty = "easy" | "medium" | "hard";

export interface RandomPandaCandidate {
  pandaId: string;
}

export interface GuessQuestion {
  questionId: string;
  mediaAssetId: string;
  /** The photo's public object key in the active release; questions whose photo is not public are skipped. */
  photoObjectKey: string;
  difficulty: GameDifficulty;
  optionPandaIds: string[];
}

export interface GuessAnswer {
  correct: boolean;
  answerPandaId: string;
  recognitionTips: string[];
}

export interface SavedGameAttempt {
  attemptId: string;
  questionId: string;
  selectedPandaId: string;
  correct: boolean;
  attemptedAt: Date;
}

export type GuessEvaluation =
  | { kind: "question_not_found" }
  | { kind: "invalid_option" }
  | { kind: "answer"; answer: GuessAnswer };

export type SaveAttemptResult =
  | { kind: "question_not_found" }
  | { kind: "invalid_option" }
  | { kind: "saved"; attempt: SavedGameAttempt; answer: GuessAnswer };

export interface GameRepository {
  randomPandaCandidate(): Promise<RandomPandaCandidate | undefined>;
  getGuessQuestion(difficulty?: GameDifficulty): Promise<GuessQuestion | undefined>;
  evaluateGuess(questionId: string, selectedPandaId: string): Promise<GuessEvaluation>;
  listAttempts(accountId: string): Promise<SavedGameAttempt[]>;
  saveAttempt(accountId: string, questionId: string, selectedPandaId: string): Promise<SaveAttemptResult>;
}

export type GamePort = GameRepository;

export const GAME_PORT = Symbol("GAME_PORT");
