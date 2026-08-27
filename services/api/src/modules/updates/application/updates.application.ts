export type UpdateType = "release_activated" | "release_rolled_back";
export type UpdateChangeType = "added" | "changed" | "removed";

export interface UpdateTarget {
  resourceKind: string;
  resourceId: string;
  changeType: UpdateChangeType;
}

export interface UpdateItem {
  updateId: string;
  updateType: UpdateType;
  releaseId: string;
  previousReleaseId?: string;
  releaseVersion: string;
  occurredAt: string;
  publishedAt: string;
  targets: UpdateTarget[];
}

export interface UpdatesRepository {
  list(limit: number): Promise<UpdateItem[]>;
}

export type UpdatesPort = UpdatesRepository;
export const UPDATES_REPOSITORY = Symbol("UPDATES_REPOSITORY");
export const UPDATES_PORT = Symbol("UPDATES_PORT");

export class UpdatesApplication implements UpdatesPort {
  public constructor(private readonly repository: UpdatesRepository) {}

  public list(limit = 30): Promise<UpdateItem[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new Error("Updates limit must be an integer between 1 and 100");
    }
    return this.repository.list(limit);
  }
}
