import { type ComparisonCatalogRow, type PublicComparisons, publishedComparisons } from "./comparison-catalog.js";

export interface ComparisonsRepository {
  current(): Promise<ComparisonCatalogRow | null>;
}

export const COMPARISONS_REPOSITORY = Symbol("COMPARISONS_REPOSITORY");
export const COMPARISONS_PORT = Symbol("COMPARISONS_PORT");

export class ComparisonsApplication {
  public constructor(private readonly repository: ComparisonsRepository) {}

  public async published(): Promise<PublicComparisons> {
    return publishedComparisons(await this.repository.current());
  }
}
