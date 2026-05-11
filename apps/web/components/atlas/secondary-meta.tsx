import type { AtlasLegendItem } from "@/lib/panda-atlas";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatDateLabel } from "./helpers";

interface SecondaryMetaProps {
  legend: AtlasLegendItem[];
  selectedSnapshotDate: string;
  latestSnapshotDate: string;
  dataStatus: string;
  dataSource: string;
  recentChangeTitle: string;
  onUseLatestSnapshot: () => void;
}

export function SecondaryMeta({
  legend,
  selectedSnapshotDate,
  latestSnapshotDate,
  dataStatus,
  dataSource,
  recentChangeTitle,
  onUseLatestSnapshot
}: SecondaryMetaProps) {
  const isLatest = selectedSnapshotDate === latestSnapshotDate;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div>
          <h3 className="text-xl font-semibold leading-tight text-zinc-900">图例与附加信息</h3>
          <p className="pt-2 text-[13px] leading-6 text-zinc-500">低权重信息放在侧栏下部，避免抢走地图舞台。</p>
        </div>

        <div className="space-y-3">
          {legend.map((item) => (
            <div key={item.label} className="flex items-start gap-3">
              <span className="mt-[9px] h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <div>
                <p className="text-[14px] leading-6 text-zinc-800">{item.label}</p>
                <p className="text-[13px] leading-6 text-zinc-500">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onUseLatestSnapshot}
          disabled={isLatest}
          className="h-10 rounded-full border-zinc-200 bg-white px-4 text-[14px] leading-6 text-zinc-700 hover:bg-stone-100"
        >
          切换至最新快照
        </Button>
        <Button
          type="button"
          variant="outline"
          asChild
          className="h-10 rounded-full border-zinc-200 bg-white px-4 text-[14px] leading-6 text-zinc-700 hover:bg-stone-100"
        >
          <a href="#timeline-section">查看最近变化</a>
        </Button>
      </div>

      <div className="space-y-3 text-[13px] leading-6 text-zinc-500">
        <p>当前快照：{formatDateLabel(selectedSnapshotDate)}</p>
        <p>最新快照：{formatDateLabel(latestSnapshotDate)}</p>
        <p>最近变化：{recentChangeTitle}</p>
        <p>{dataStatus}</p>
        <p>{dataSource}</p>
      </div>
    </div>
  );
}
