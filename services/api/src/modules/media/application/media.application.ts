export type MediaRightsStatus = "cleared" | "restricted" | "unknown";
export type MediaEligibilityStatus = "eligible" | "restricted" | "pending";
export type MediaUsageRole = "cover" | "gallery" | "historical" | "evidence";
export type MediaDerivativeKind = "thumbnail" | "web" | "preview" | "crop" | "other";

export type MediaJsonValue = string | number | boolean | null | MediaJsonObject | MediaJsonValue[];
export interface MediaJsonObject {
  [key: string]: MediaJsonValue;
}

export interface MediaAsset {
  assetId: string;
  sourceId?: string;
  storageBucket: string;
  storageKey: string;
  objectVersion?: string;
  storageEtag?: string;
  contentSha256: string;
  mediaType: string;
  byteSize: number;
  title?: string;
  creator?: string;
  copyrightText?: string;
  license?: string;
  attributionText?: string;
  rightsStatus: MediaRightsStatus;
  eligibilityStatus: MediaEligibilityStatus;
  takenAt?: string;
  metadata: MediaJsonObject;
}

export type CreateMediaAssetInput = Omit<MediaAsset, "assetId">;

export interface MediaRepository {
  createAsset(input: CreateMediaAssetInput): Promise<MediaAsset>;
  getAsset(assetId: string): Promise<MediaAsset | undefined>;
  setReviewState(
    assetId: string,
    rightsStatus: MediaRightsStatus,
    eligibilityStatus: MediaEligibilityStatus,
  ): Promise<MediaAsset>;
  attachToPanda(pandaId: string, assetId: string, usageRole: MediaUsageRole, displayOrder: number): Promise<void>;
  addDerivative(parentAssetId: string, derivativeAssetId: string, kind: MediaDerivativeKind): Promise<void>;
}

export type MediaPort = MediaRepository;

export const MEDIA_REPOSITORY = Symbol("MEDIA_REPOSITORY");
export const MEDIA_PORT = Symbol("MEDIA_PORT");

export class MediaApplication implements MediaPort {
  public constructor(private readonly repository: MediaRepository) {}

  public createAsset(input: CreateMediaAssetInput): Promise<MediaAsset> {
    this.assertReviewState(input.rightsStatus, input.eligibilityStatus);
    return this.repository.createAsset(input);
  }

  public getAsset(assetId: string): Promise<MediaAsset | undefined> {
    return this.repository.getAsset(assetId);
  }

  public setReviewState(
    assetId: string,
    rightsStatus: MediaRightsStatus,
    eligibilityStatus: MediaEligibilityStatus,
  ): Promise<MediaAsset> {
    this.assertReviewState(rightsStatus, eligibilityStatus);
    return this.repository.setReviewState(assetId, rightsStatus, eligibilityStatus);
  }

  public attachToPanda(
    pandaId: string,
    assetId: string,
    usageRole: MediaUsageRole,
    displayOrder: number,
  ): Promise<void> {
    return this.repository.attachToPanda(pandaId, assetId, usageRole, displayOrder);
  }

  public addDerivative(
    parentAssetId: string,
    derivativeAssetId: string,
    kind: MediaDerivativeKind,
  ): Promise<void> {
    if (parentAssetId === derivativeAssetId) {
      throw new Error("A media asset cannot be its own derivative");
    }
    return this.repository.addDerivative(parentAssetId, derivativeAssetId, kind);
  }

  private assertReviewState(
    rightsStatus: MediaRightsStatus,
    eligibilityStatus: MediaEligibilityStatus,
  ): void {
    if (eligibilityStatus === "eligible" && rightsStatus !== "cleared") {
      throw new Error("Only rights-cleared media may be marked eligible");
    }
  }
}
