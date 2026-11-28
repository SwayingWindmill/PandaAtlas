export interface OfflinePackManifest {
  slug: string;
  name: string;
  downloadedAt: string;
  pandaCount: number;
  photoCount: number;
  jsonBytes: number;
  pinnedKeys: string[];
}

export interface OfflinePackProgress {
  phase: "index" | "pandas" | "covers" | "photos";
  done: number;
  total: number;
}

export const MAX_PACK_JSON_BYTES = 1_500_000;

/** Formats byte counts using compact units fit for quiet inline labels. */
export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Computes pinned AsyncStorage keys safe to delete when removing one base pack without harming other packs. */
export function keysToDeleteOnPackRemoval(
  removingSlug: string,
  manifests: Readonly<Record<string, OfflinePackManifest>>,
): string[] {
  const target = manifests[removingSlug];
  if (!target) return [];
  const stillPinned = new Set<string>();
  for (const [slug, manifest] of Object.entries(manifests)) {
    if (slug === removingSlug) continue;
    for (const key of manifest.pinnedKeys) stillPinned.add(key);
  }
  return target.pinnedKeys.filter((key) => !stillPinned.has(key));
}

/** One-line factual summary of what a downloaded base pack keeps ready offline. */
export function estimatePackSummary(manifest: OfflinePackManifest): string {
  return `${manifest.pandaCount} 只档案 ${formatByteSize(manifest.jsonBytes)}　${manifest.photoCount} 张封面已存本机`;
}

/** Progress percentage `0..100` across the 4 download phases. */
export function offlinePackPercent(progress: OfflinePackProgress): number {
  const weights: Record<OfflinePackProgress["phase"], [number, number]> = {
    index: [0, 20],
    pandas: [20, 65],
    covers: [65, 75],
    photos: [75, 100],
  };
  const [start, end] = weights[progress.phase];
  const ratio = progress.total > 0 ? Math.min(1, Math.max(0, progress.done / progress.total)) : 1;
  return Math.round(start + (end - start) * ratio);
}
