import "server-only";

import { isFeedUiEnabled } from "@/features/feed/config";
import type {
  ActivityItem,
  ActivityPageData,
  FeedLoadResult,
  FeedPageData,
  PublicActivityLoadResult,
} from "@/features/feed/types";
import { createServerV2Client } from "@/lib/server/v2-api";

function toActivity(update: {
  updateId: string;
  updateType: "release_activated" | "release_rolled_back";
  releaseId: string;
  previousReleaseId?: string;
  releaseVersion: string;
  occurredAt: string;
  publishedAt: string;
  targets: Array<{
    resourceKind: "panda" | "institution" | "place" | "lineage" | "residency" | "life_event" | "media" | "evidence";
    resourceId: string;
    changeType: "added" | "changed" | "removed";
  }>;
}): ActivityItem {
  const changed = update.targets.length;
  const zhTitle = update.updateType === "release_rolled_back" ? "公开资料版本已回滚" : "公开资料已更新";
  const enTitle = update.updateType === "release_rolled_back" ? "Public data release rolled back" : "Public data updated";
  return {
    activity_id: update.updateId,
    source_type: "publication_release",
    source_id: update.releaseId,
    source_version: 1,
    source_event_id: update.updateId,
    activity_type: "archive.profile_corrected",
    targets: update.targets.flatMap((target) => {
      if (target.resourceKind !== "panda" && target.resourceKind !== "institution") return [];
      return [{ target_type: target.resourceKind, target_id: target.resourceId }];
    }),
    importance: null,
    visibility: "public",
    sitewide: false,
    notification_eligible: true,
    occurred_at: update.occurredAt,
    occurred_precision: "exact",
    published_at: update.publishedAt,
    updated_at: update.publishedAt,
    localization_key: `updates.${update.updateType}`,
    localization_version: 1,
    localized_snapshots: [
      {
        locale: "zh-CN",
        title: zhTitle,
        summary: `公开版本 ${update.releaseVersion} 包含 ${changed} 项资源变更。`,
      },
      {
        locale: "en",
        title: enTitle,
        summary: `Public release ${update.releaseVersion} contains ${changed} resource changes.`,
      },
    ],
    provenance: {
      release_id: update.releaseId,
      data_version: update.releaseVersion,
      public_reference_ids: [],
    },
    retraction_state: "active",
    is_backfill: false,
  };
}

export async function loadPersonalizedFeed(
  accessToken: string,
  _cursor?: string,
): Promise<FeedLoadResult> {
  if (!isFeedUiEnabled()) return { state: "disabled" };
  const api = createServerV2Client();
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "X-Correlation-Id": crypto.randomUUID(),
  };

  try {
    const [favorites, updates] = await Promise.all([
      api.GET("/api/v2/me/favorites", { headers }),
      api.GET("/api/v2/updates", { params: { query: { limit: 100 } } }),
    ]);
    if (favorites.response.status === 401) return { state: "unauthenticated" };
    if (favorites.response.status === 403) return { state: "blocked" };
    if (!favorites.data || !updates.data) return { state: "unavailable", source: "api" };

    const favoriteIds = new Set(favorites.data.items.map((favorite) => favorite.pandaId));
    const items = updates.data
      .filter((update) => update.targets.some((target) => target.resourceKind === "panda" && favoriteIds.has(target.resourceId)))
      .map((update) => ({
        activity: toActivity(update),
        attribution: "followed" as const,
        followed_panda_ids: update.targets
          .filter((target) => target.resourceKind === "panda" && favoriteIds.has(target.resourceId))
          .map((target) => target.resourceId),
        is_pinned: false,
        is_new: false,
        deleted_target_ids: [],
      }));
    const page: FeedPageData = {
      items,
      next_cursor: null,
      last_viewed_at: null,
      projection_stale: false,
      projection_lag_seconds: 0,
    };
    return { state: "ready", page };
  } catch {
    return { state: "unavailable", source: "api" };
  }
}

export async function loadPublicPandaActivity(
  pandaId: string,
  _cursor?: string,
): Promise<PublicActivityLoadResult> {
  if (!isFeedUiEnabled()) return { state: "disabled" };
  const api = createServerV2Client();
  try {
    const result = await api.GET("/api/v2/updates", { params: { query: { limit: 100 } } });
    if (!result.data) return { state: "unavailable", source: "api" };
    const page: ActivityPageData = {
      items: result.data
        .filter((update) => update.targets.some((target) => target.resourceKind === "panda" && target.resourceId === pandaId))
        .map(toActivity),
      next_cursor: null,
    };
    return { state: "ready", page };
  } catch {
    return { state: "unavailable", source: "api" };
  }
}
