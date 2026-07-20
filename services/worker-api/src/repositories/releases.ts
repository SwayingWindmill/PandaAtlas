import type { Env } from "../bindings";
import { HttpError } from "../http";
import type { PublicReleaseMetadata } from "../types";

interface PublicReleaseRow extends Omit<PublicReleaseMetadata, "licenses"> {
  licenses_json: string;
}

const SUPPORTED_PUBLIC_SCHEMA_VERSIONS = new Set(["1.0.0", "1.1.0", "1.2.0"]);

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
    const withdrawn = await env.DB.prepare(`
      select 1 as withdrawn
      from public_release_pointer pointer
      join public_release_withdrawals withdrawal
        on withdrawal.dataset_release_version = pointer.dataset_release_version
      where pointer.singleton = 1
        and withdrawal.entity_type is null
        and withdrawal.entity_id is null
      limit 1
    `).first<{ withdrawn: number }>();
    if (withdrawn) {
      throw new HttpError(410, "Current public release is withdrawn");
    }
    throw new HttpError(503, "No active public release");
  }
  if (!SUPPORTED_PUBLIC_SCHEMA_VERSIONS.has(row.public_schema_version)) {
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
