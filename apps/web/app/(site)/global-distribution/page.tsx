import type { Metadata } from "next";
import { GlobalDistributionShell } from "@/components/atlas/global-distribution-shell";
import {
  buildAvailableSnapshotDates,
  filterDistributionBySnapshot,
  resolveInitialSnapshotDate
} from "@/components/atlas/helpers";
import { getDistribution, getDistributionSnapshots, getHabitats, getOverviewStats } from "@/lib/api-client";

const DEFAULT_BBOX = "100,25,110,36";

export const metadata: Metadata = {
  title: "全球熊猫分布图谱 | 大熊猫图鉴",
  description:
    "以地图为主舞台的 Panda Atlas 工作台，统一承载中国野生分布、国内圈养网络、海外合作节点与时间变化。"
};

export default async function GlobalDistributionPage() {
  const [distribution, habitats, overviewStats, snapshots] = await Promise.all([
    getDistribution({ bbox: DEFAULT_BBOX, layer: "wild", zoom: 6 }),
    getHabitats({ bbox: DEFAULT_BBOX }),
    getOverviewStats(),
    getDistributionSnapshots(24)
  ]);

  const initialSnapshotDate = resolveInitialSnapshotDate(
    snapshots,
    distribution,
    overviewStats.latest_snapshot_date
  );
  const availableSnapshotDates = buildAvailableSnapshotDates(
    snapshots,
    distribution,
    overviewStats.latest_snapshot_date
  );
  const initialDistribution = filterDistributionBySnapshot(distribution, initialSnapshotDate);

  return (
    <div data-testid="global-distribution-page">
      <GlobalDistributionShell
        initialDistribution={initialDistribution}
        initialHabitats={habitats}
        initialStats={overviewStats}
        defaultBBox={DEFAULT_BBOX}
        initialSnapshotDate={initialSnapshotDate}
        availableSnapshotDates={availableSnapshotDates}
      />
    </div>
  );
}
