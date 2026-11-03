import { type LearningCatalogRow, type PublicLearningCatalog, publishedCatalog } from "./learning-catalog.js";

export interface LearningRepository {
  current(): Promise<LearningCatalogRow | null>;
}

export const LEARNING_REPOSITORY = Symbol("LEARNING_REPOSITORY");
export const LEARNING_PORT = Symbol("LEARNING_PORT");

export class LearningApplication {
  public constructor(private readonly repository: LearningRepository) {}

  public async published(): Promise<PublicLearningCatalog> {
    return publishedCatalog(await this.repository.current());
  }
}
