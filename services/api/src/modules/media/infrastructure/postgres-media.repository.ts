import type { DatabaseService } from "../../../platform/database/database.service.js";
import type {
  CreateMediaAssetInput,
  MediaAsset,
  MediaDerivativeKind,
  MediaEligibilityStatus,
  MediaRepository,
  MediaRightsStatus,
  MediaUsageRole,
} from "../application/media.application.js";

export class PostgresMediaRepository implements MediaRepository {
  public constructor(private readonly database: DatabaseService) {}

  public async createAsset(input: CreateMediaAssetInput): Promise<MediaAsset> {
    const row = await this.database.db
      .insertInto("media.assets")
      .values({
        source_id: input.sourceId,
        storage_bucket: input.storageBucket,
        storage_key: input.storageKey,
        object_version: input.objectVersion,
        storage_etag: input.storageEtag,
        content_sha256: input.contentSha256,
        media_type: input.mediaType,
        byte_size: input.byteSize,
        title: input.title,
        creator: input.creator,
        copyright_text: input.copyrightText,
        license: input.license,
        attribution_text: input.attributionText,
        rights_status: input.rightsStatus,
        eligibility_status: input.eligibilityStatus,
        taken_at: input.takenAt,
        metadata: input.metadata,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return {
      assetId: row.asset_id,
      ...(row.source_id === null ? {} : { sourceId: row.source_id }),
      storageBucket: row.storage_bucket,
      storageKey: row.storage_key,
      ...(row.object_version === null ? {} : { objectVersion: row.object_version }),
      ...(row.storage_etag === null ? {} : { storageEtag: row.storage_etag }),
      contentSha256: row.content_sha256,
      mediaType: row.media_type,
      byteSize: Number(row.byte_size),
      ...(row.title === null ? {} : { title: row.title }),
      ...(row.creator === null ? {} : { creator: row.creator }),
      ...(row.copyright_text === null ? {} : { copyrightText: row.copyright_text }),
      ...(row.license === null ? {} : { license: row.license }),
      ...(row.attribution_text === null ? {} : { attributionText: row.attribution_text }),
      rightsStatus: row.rights_status as MediaRightsStatus,
      eligibilityStatus: row.eligibility_status as MediaEligibilityStatus,
      ...(row.taken_at === null ? {} : { takenAt: row.taken_at.toISOString() }),
      metadata: row.metadata as MediaAsset["metadata"],
    };
  }

  public async getAsset(assetId: string): Promise<MediaAsset | undefined> {
    const row = await this.database.db
      .selectFrom("media.assets")
      .selectAll()
      .where("asset_id", "=", assetId)
      .executeTakeFirst();
    if (row === undefined) {
      return undefined;
    }
    return {
      assetId: row.asset_id,
      ...(row.source_id === null ? {} : { sourceId: row.source_id }),
      storageBucket: row.storage_bucket,
      storageKey: row.storage_key,
      ...(row.object_version === null ? {} : { objectVersion: row.object_version }),
      ...(row.storage_etag === null ? {} : { storageEtag: row.storage_etag }),
      contentSha256: row.content_sha256,
      mediaType: row.media_type,
      byteSize: Number(row.byte_size),
      ...(row.title === null ? {} : { title: row.title }),
      ...(row.creator === null ? {} : { creator: row.creator }),
      ...(row.copyright_text === null ? {} : { copyrightText: row.copyright_text }),
      ...(row.license === null ? {} : { license: row.license }),
      ...(row.attribution_text === null ? {} : { attributionText: row.attribution_text }),
      rightsStatus: row.rights_status as MediaRightsStatus,
      eligibilityStatus: row.eligibility_status as MediaEligibilityStatus,
      ...(row.taken_at === null ? {} : { takenAt: row.taken_at.toISOString() }),
      metadata: row.metadata as MediaAsset["metadata"],
    };
  }

  public async setReviewState(
    assetId: string,
    rightsStatus: MediaRightsStatus,
    eligibilityStatus: MediaEligibilityStatus,
  ): Promise<MediaAsset> {
    await this.database.db
      .updateTable("media.assets")
      .set({ rights_status: rightsStatus, eligibility_status: eligibilityStatus, updated_at: new Date() })
      .where("asset_id", "=", assetId)
      .returning("asset_id")
      .executeTakeFirstOrThrow();
    const asset = await this.getAsset(assetId);
    if (asset === undefined) {
      throw new Error("Updated media asset could not be reloaded");
    }
    return asset;
  }

  public async attachToPanda(
    pandaId: string,
    assetId: string,
    usageRole: MediaUsageRole,
    displayOrder: number,
  ): Promise<void> {
    await this.database.db.insertInto("media.panda_assets").values({
      panda_id: pandaId,
      asset_id: assetId,
      usage_role: usageRole,
      display_order: displayOrder,
    }).execute();
  }

  public async addDerivative(
    parentAssetId: string,
    derivativeAssetId: string,
    kind: MediaDerivativeKind,
  ): Promise<void> {
    await this.database.db.insertInto("media.derivatives").values({
      parent_asset_id: parentAssetId,
      derivative_asset_id: derivativeAssetId,
      derivative_kind: kind,
    }).execute();
  }
}
