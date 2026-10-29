/** Dots closer than this, in outline units, are drawn as one. 34 units keep 24px tap targets apart on a phone. */
export const WORLD_CLUSTER_DISTANCE = 34;

/** Where China sits across the outline's width, so a phone can open the map there. */
export const WORLD_CHINA_SHARE = 0.76;

/**
 * Greedy clustering in outline units. Items should already be ordered with the one that should
 * keep the dot's position first: the cluster stays where that item was projected.
 */
export function clusterWorldPoints<T>(
  items: readonly T[],
  pointOf: (item: T) => { x: number; y: number } | null,
  distance = WORLD_CLUSTER_DISTANCE,
): Array<{ x: number; y: number; items: T[] }> {
  const clusters: Array<{ x: number; y: number; items: T[] }> = [];
  for (const item of items) {
    const point = pointOf(item);
    if (!point) continue;
    const near = clusters.find((cluster) => Math.hypot(cluster.x - point.x, cluster.y - point.y) < distance);
    if (near) near.items.push(item);
    else clusters.push({ x: point.x, y: point.y, items: [item] });
  }
  return clusters;
}
