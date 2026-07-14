import type { Env } from "../bindings";
import { HttpError } from "../http";

export interface PublicReleaseMetadata {
  dataset_release_version: string;
  public_schema_version: string;
  database_migration_version: string;
  publication_batch_id: string;
  projection_code_version: string;
  released_at: string;
  licenses: Record<string, string>;
}

interface PublicReleaseRow extends Omit<PublicReleaseMetadata, "licenses"> {
  licenses_json: string;
}

export async function requireCurrentRelease(env: Env): Promise<PublicReleaseMetadata> {
  const row = await env.DB.prepare(`
    select
      dataset_release_version,
      public_schema_version,
      database_migration_version,
      publication_batch_id,
      projection_code_version,
      released_at,
      licenses_json
    from current_public_release
  `).first<PublicReleaseRow>();
  if (!row) {
    throw new HttpError(503, "No active public release");
  }
  if (row.public_schema_version !== "1.0.0") {
    throw new HttpError(503, `Unsupported Public Schema version: ${row.public_schema_version}`);
  }
  return {
    dataset_release_version: row.dataset_release_version,
    public_schema_version: row.public_schema_version,
    database_migration_version: row.database_migration_version,
    publication_batch_id: row.publication_batch_id,
    projection_code_version: row.projection_code_version,
    released_at: row.released_at,
    licenses: JSON.parse(row.licenses_json) as Record<string, string>
  };
}

export function releaseHeaders(release: PublicReleaseMetadata): Record<string, string> {
  return {
    "X-PandaAtlas-Dataset-Version": release.dataset_release_version,
    "X-PandaAtlas-Public-Schema-Version": release.public_schema_version,
    "X-PandaAtlas-Database-Migration-Version": release.database_migration_version
  };
}
