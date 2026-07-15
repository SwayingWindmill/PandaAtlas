import type { AtlasLegendItem } from "@/lib/panda-atlas";
import { LocateFixed, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MapOverlayProps {
  modeLabel: string;
  modeHint: string;
  viewLabel: string;
  snapshotDateLabel: string;
  legend: AtlasLegendItem[];
  isUpdating: boolean;
  detailOpen: boolean;
  sheetOpen: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}

export function MapOverlay({
  modeLabel,
  modeHint,
  viewLabel,
  snapshotDateLabel,
  legend,
  isUpdating,
  detailOpen,
  sheetOpen,
  onZoomIn,
  onZoomOut,
  onResetView
}: MapOverlayProps) {
  return (
    <>
      <div className="pointer-events-none absolute left-5 top-5 z-20 max-w-[560px]">
        <div className="border-l-2 border-[rgba(47,107,59,0.3)] bg-[linear-gradient(90deg,rgba(247,246,242,0.84),rgba(247,246,242,0))] pl-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#526354]">{modeHint}</p>
          <p
            className="mt-1 text-[19px] leading-7 text-[#233126]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {modeLabel}
          </p>
        </div>

        <div className="mt-4 hidden flex-wrap items-center gap-x-5 gap-y-2 border-t border-[rgba(63,125,72,0.12)] pt-3 lg:flex">
          {legend.map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-[12px] leading-5 text-[#233126]">
              <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="font-medium">{item.label}</span>
              <span className="text-[#526354]">{item.description}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute right-5 top-5 z-20 hidden max-w-[280px] border-l border-[rgba(63,125,72,0.12)] bg-[linear-gradient(270deg,rgba(247,246,242,0.86),rgba(247,246,242,0))] pl-4 text-right md:block">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#526354]">{viewLabel}</p>
        <div className="mt-1 flex items-center justify-end gap-2 text-[13px] leading-6 text-[#233126]">
          {isUpdating ? <span className="inline-flex h-2 w-2 rounded-full bg-[#C98A45]" /> : null}
          <span>{snapshotDateLabel}</span>
          {isUpdating ? <span className="text-[#8C734F]">更新中</span> : null}
        </div>
      </div>

      <div
        className={cn(
          "absolute right-6 z-20 flex flex-col items-end gap-3 transition-all duration-300",
          detailOpen ? "bottom-[calc(76%+1rem)] md:bottom-6" : sheetOpen ? "bottom-[calc(68%+1rem)] md:bottom-6" : "bottom-6"
        )}
      >
        <div className="flex flex-col overflow-hidden rounded-[18px] border border-[rgba(63,125,72,0.12)] bg-[rgba(247,246,242,0.84)] shadow-[0_16px_30px_rgba(30,40,31,0.08)] backdrop-blur-sm">
          <Button
            type="button"
            variant="outline"
            aria-label="放大地图"
            onClick={onZoomIn}
            className="pointer-events-auto h-11 w-11 rounded-none border-x-0 border-t-0 border-b border-[rgba(63,125,72,0.1)] bg-transparent p-0 text-[#233126] shadow-none hover:bg-white/60"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            aria-label="缩小地图"
            onClick={onZoomOut}
            className="pointer-events-auto h-11 w-11 rounded-none border-0 bg-transparent p-0 text-[#233126] shadow-none hover:bg-white/60"
          >
            <Minus className="h-4 w-4" />
          </Button>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={onResetView}
          className="pointer-events-auto h-10 rounded-none border-x-0 border-t-0 border-b border-[rgba(63,125,72,0.16)] bg-transparent px-0 text-[13px] text-[#233126] shadow-none hover:bg-transparent hover:text-[#2F6B3B]"
        >
          <LocateFixed className="mr-2 h-4 w-4" />
          返回全局
        </Button>
      </div>
    </>
  );
}
