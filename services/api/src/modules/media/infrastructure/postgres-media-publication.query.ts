import type { DatabaseTransaction } from "../../../platform/database/database.service.js";
import { sha256Content } from "../../../platform/integrity/content-digest.js";
import type {
  MediaPublicationPort,
  MediaPublicationSource,
} from "../application/media-publication.application.js";
import type { MediaUsageRole } from "../application/media.application.js";

export class PostgresMediaPublicationQuery implements MediaPublicationPort {
  public async snapshot(transaction: DatabaseTransaction): Promise<MediaPublicationSource[]> {
    const rows = await transaction
      .selectFrom("media.panda_assets as link")
      .innerJoin("media.assets as asset", "asset.asset_id", "link.asset_id")
      .select([
        "asset.asset_id",
        "link.panda_id",
        "asset.source_id",
        "link.usage_role",
        "link.display_order",
        "asset.storage_key",
        "asset.object_version",
        "asset.storage_etag",
        "asset.content_sha256",
        "asset.media_type",
        "asset.title",
        "asset.creator",
        "asset.copyright_text",
        "asset.license",
        "asset.attribution_text",
        "asset.taken_at",
        "asset.updated_at",
      ])
      .where("asset.rights_status", "=", "cleared")
      .where("asset.eligibility_status", "=", "eligible")
      .orderBy("link.panda_id")
      .orderBy("link.display_order")
      .orderBy("asset.asset_id")
      .execute();

    return rows.map((row) => {
      const projection = {
        membershipId: `${row.panda_id}:${row.asset_id}:${row.usage_role}`,
        assetId: row.asset_id,
        pandaId: row.panda_id,
        ...(row.source_id === null ? {} : { sourceId: row.source_id }),
        usageRole: row.usage_role as MediaUsageRole,
        displayOrder: row.display_order,
        objectKey: row.storage_key,
        contentSha256: row.content_sha256,
        mediaType: row.media_type,
        ...(row.title === null ? {} : { title: row.title }),
        ...(row.creator === null ? {} : { creator: row.creator }),
        ...(row.copyright_text === null ? {} : { copyrightText: row.copyright_text }),
        ...(row.license === null ? {} : { license: row.license }),
        ...(row.attribution_text === null ? {} : { attributionText: row.attribution_text }),
        ...(row.taken_at === null ? {} : { takenAt: row.taken_at.toISOString() }),
      };
      const revision = row.updated_at.toISOString();
      return {
        ...projection,
        sourceRevision: revision,
        sourceVersion: row.object_version ?? row.storage_etag ?? revision,
        sourceSha256: sha256Content({
          ...projection,
          objectVersion: row.object_version,
          storageEtag: row.storage_etag,
        }),
      };
    });
  }
}
