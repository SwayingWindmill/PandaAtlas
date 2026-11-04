import { type OverseasStatusCatalogRow, type PublicOverseasStatus, publishedOverseasStatus } from "./overseas-status-catalog.js";

export interface OverseasStatusRepository {
  current(): Promise<OverseasStatusCatalogRow | null>;
}

export const OVERSEAS_STATUS_REPOSITORY = Symbol("OVERSEAS_STATUS_REPOSITORY");
export const OVERSEAS_STATUS_PORT = Symbol("OVERSEAS_STATUS_PORT");

export class OverseasStatusApplication {
  public constructor(private readonly repository: OverseasStatusRepository) {}

  public async published(): Promise<PublicOverseasStatus> {
    return publishedOverseasStatus(await this.repository.current());
  }
}
