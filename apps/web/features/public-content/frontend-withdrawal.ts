import riRiWithdrawal from "../../../../data/frontend-withdrawals/2026.07.20.2-ri-ri.json";
import type { PandaDetail } from "@/lib/types";

export interface FrontendWithdrawalManifest {
  schema_version: 1;
  withdrawal_id: string;
  review_state: "approved";
  dataset_release_version: string;
  public_schema_version: string;
  database_migration_version: string;
  public_release_manifest_sha256: string;
  reviewed_at: string;
  reason: string;
  panda_ids: string[];
  media_ids: string[];
}

const REVIEWED_WITHDRAWALS: Record<string, FrontendWithdrawalManifest> = {
  [riRiWithdrawal.withdrawal_id]: riRiWithdrawal as FrontendWithdrawalManifest,
};

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Frontend withdrawal manifest is invalid: ${message}`);
}

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export function validateFrontendWithdrawalManifest(
  manifest: FrontendWithdrawalManifest,
  details: readonly PandaDetail[],
): FrontendWithdrawalManifest {
  requireCondition(manifest.schema_version === 1, "schema_version must be 1.");
  requireCondition(manifest.review_state === "approved", "review_state must be approved.");
  requireCondition(Boolean(manifest.withdrawal_id), "withdrawal_id is required.");
  requireCondition(Boolean(manifest.reason), "reason is required.");
  requireCondition(!Number.isNaN(Date.parse(manifest.reviewed_at)), "reviewed_at must be an ISO timestamp.");
  requireCondition(manifest.panda_ids.length > 0, "at least one panda ID is required.");
  requireCondition(manifest.media_ids.length > 0, "at least one media ID is required.");
  requireCondition(unique(manifest.panda_ids), "panda IDs must be unique.");
  requireCondition(unique(manifest.media_ids), "media IDs must be unique.");

  const releaseVersions = new Set(details.map((detail) => detail.public_revision?.data_version));
  const schemaVersions = new Set(details.map((detail) => detail.public_revision?.public_schema_version));
  requireCondition(
    releaseVersions.size === 1 && releaseVersions.has(manifest.dataset_release_version),
    `dataset release must match ${manifest.dataset_release_version}.`,
  );
  requireCondition(
    schemaVersions.size === 1 && schemaVersions.has(manifest.public_schema_version),
    `public schema must match ${manifest.public_schema_version}.`,
  );

  const detailsById = new Map(details.map((detail) => [detail.id, detail]));
  for (const pandaId of manifest.panda_ids) {
    requireCondition(detailsById.has(pandaId), `unknown panda ID ${pandaId}.`);
  }

  const selectedMedia = manifest.panda_ids.flatMap((pandaId) => detailsById.get(pandaId)?.media ?? []);
  const selectedMediaIds = new Set(selectedMedia.map((media) => media.id));
  for (const mediaId of manifest.media_ids) {
    requireCondition(selectedMediaIds.has(mediaId), `media ID ${mediaId} does not belong to a withdrawn panda.`);
  }
  requireCondition(
    selectedMediaIds.size === manifest.media_ids.length
      && manifest.media_ids.every((mediaId) => selectedMediaIds.has(mediaId)),
    "media_ids must list every media record owned by the withdrawn pandas.",
  );

  return manifest;
}

export function resolveActiveFrontendWithdrawal(
  details: readonly PandaDetail[],
  withdrawalId = process.env.PANDA_ATLAS_FRONTEND_WITHDRAWAL_ID,
): FrontendWithdrawalManifest | null {
  const normalized = withdrawalId?.trim();
  if (!normalized) return null;
  const manifest = REVIEWED_WITHDRAWALS[normalized];
  requireCondition(Boolean(manifest), `unknown withdrawal ID ${normalized}.`);
  return validateFrontendWithdrawalManifest(manifest, details);
}

export function applyFrontendWithdrawal(
  details: readonly PandaDetail[],
  manifest: FrontendWithdrawalManifest | null,
): PandaDetail[] {
  if (!manifest) return [...details];
  const withdrawn = new Set(manifest.panda_ids);
  return details
    .filter((detail) => !withdrawn.has(detail.id))
    .map((detail) => ({
      ...detail,
      father_id: detail.father_id && withdrawn.has(detail.father_id) ? null : detail.father_id,
      mother_id: detail.mother_id && withdrawn.has(detail.mother_id) ? null : detail.mother_id,
      events: detail.events.map((event) => ({
        ...event,
        participants: event.participants.filter((participantId) => !withdrawn.has(participantId)),
      })),
    }));
}
