export type GameDifficulty = "easy" | "medium" | "hard";

export interface RandomPandaCandidate {
  pandaId: string;
}

export interface GuessQuestion {
  questionId: string;
  mediaAssetId: string;
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

export const GAME_REPOSITORY = Symbol("GAME_REPOSITORY");
export const GAME_PORT = Symbol("GAME_PORT");

export class GameApplication implements GamePort {
  public constructor(private readonly repository: GameRepository) {}

  public randomPandaCandidate() { return this.repository.randomPandaCandidate(); }
  public getGuessQuestion(difficulty?: GameDifficulty) { return this.repository.getGuessQuestion(difficulty); }
  public evaluateGuess(questionId: string, selectedPandaId: string) { return this.repository.evaluateGuess(questionId, selectedPandaId); }
  public listAttempts(accountId: string) { return this.repository.listAttempts(accountId); }
  public saveAttempt(accountId: string, questionId: string, selectedPandaId: string) {
    return this.repository.saveAttempt(accountId, questionId, selectedPandaId);
  }
}
