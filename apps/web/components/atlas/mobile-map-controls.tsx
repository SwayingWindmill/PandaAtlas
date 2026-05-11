"use client";

import { X } from "lucide-react";
import {
  ATLAS_DATA_SOURCE,
  ATLAS_DATA_STATUS,
  ATLAS_MODES,
  ATLAS_SEARCH_PLACEHOLDER,
  type AtlasInstitutionTypeFilter,
  type AtlasMode,
  type AtlasModeMeta,
  type AtlasRegionFilter,
  type AtlasStatusFilter
} from "@/lib/panda-atlas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatDateLabel, REGION_OPTIONS, STATUS_OPTIONS, TYPE_OPTIONS } from "./helpers";

interface MobileMapControlsProps {
  open: boolean;
  mode: AtlasMode;
  modeMeta: AtlasModeMeta;
  searchQuery: string;
  resultCount: number;
  regionFilter: AtlasRegionFilter;
  statusFilter: AtlasStatusFilter;
  typeFilter: AtlasInstitutionTypeFilter;
  selectedSnapshotDate: string;
  latestSnapshotDate: string;
  availableSnapshotDates: string[];
  onOpenChange: (nextOpen: boolean) => void;
  onModeChange: (nextValue: AtlasMode) => void;
  onSearchChange: (nextValue: string) => void;
  onRegionChange: (nextValue: AtlasRegionFilter) => void;
  onStatusChange: (nextValue: AtlasStatusFilter) => void;
  onTypeChange: (nextValue: AtlasInstitutionTypeFilter) => void;
  onSnapshotChange: (nextValue: string) => void;
  onUseLatestSnapshot: () => void;
}

export function MobileMapControls({
  open,
  mode,
  modeMeta,
  searchQuery,
  resultCount,
  regionFilter,
  statusFilter,
  typeFilter,
  selectedSnapshotDate,
  latestSnapshotDate,
  availableSnapshotDates,
  onOpenChange,
  onModeChange,
  onSearchChange,
  onRegionChange,
  onStatusChange,
  onTypeChange,
  onSnapshotChange,
  onUseLatestSnapshot
}: MobileMapControlsProps) {
  const orderedSnapshotDates = Array.from(new Set([...availableSnapshotDates, selectedSnapshotDate])).sort(
    (left, right) => right.localeCompare(left)
  );
  const isLatest = selectedSnapshotDate === latestSnapshotDate;

  return (
    <div className={cn("absolute inset-0 z-30 xl:hidden", open ? "pointer-events-auto" : "pointer-events-none")}>
      <button
        type="button"
        aria-label="关闭地图控制面板"
        onClick={() => onOpenChange(false)}
        className={cn("absolute inset-0 transition-colors", open ? "bg-[rgba(24,34,25,0.12)]" : "bg-transparent")}
      />

      <section
        className={cn(
          "absolute inset-x-0 bottom-0 z-10 flex h-[68%] max-h-[36rem] flex-col rounded-t-[28px] border-t border-[rgba(63,125,72,0.12)] bg-[rgba(255,255,255,0.98)] shadow-[0_-18px_36px_rgba(24,34,25,0.14)] transition-transform duration-300",
          open ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(63,125,72,0.08)] px-4 py-4">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#6D7C6E]">地图控制</p>
            <h2
              className="mt-2 text-[24px] leading-[1.1] text-[#233126]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {modeMeta.label}
            </h2>
            <p className="mt-2 text-[13px] leading-6 text-[#6D7C6E]">
              当前命中 {resultCount} 个对象，快照 {formatDateLabel(selectedSnapshotDate)}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            aria-label="关闭地图控制面板"
            onClick={() => onOpenChange(false)}
            className="h-10 w-10 rounded-none border-0 bg-transparent p-0 text-[#233126] shadow-none hover:bg-transparent hover:text-[#2F6B3B]"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          <section className="space-y-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6D7C6E]">阅读模式</p>
              <p className="mt-1 text-[13px] leading-6 text-[#6D7C6E]">{modeMeta.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {ATLAS_MODES.map((entry) => {
                const active = entry.value === mode;

                return (
                  <button
                    key={entry.value}
                    type="button"
                    onClick={() => onModeChange(entry.value)}
                    className={cn(
                      "rounded-[18px] border px-3 py-3 text-left transition-colors",
                      active
                        ? "border-[rgba(63,125,72,0.18)] bg-[rgba(63,125,71,0.08)] text-[#233126]"
                        : "border-[rgba(47,92,69,0.08)] bg-[rgba(246,247,244,0.86)] text-[#5F6E61]"
                    )}
                  >
                    <p className="text-[14px] font-semibold">{entry.label}</p>
                    <p className="mt-1 text-[12px] leading-5">{entry.shortLabel}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6D7C6E]">搜索与筛选</p>
              <p className="mt-1 text-[13px] leading-6 text-[#6D7C6E]">搜索区域、城市、机构或相关标签</p>
            </div>

            <Input
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={ATLAS_SEARCH_PLACEHOLDER}
              className="h-11 rounded-[18px] border-[rgba(47,92,69,0.08)] bg-[rgba(246,247,244,0.86)] shadow-none"
            />

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="text-[12px] text-[#6D7C6E]">区域</span>
                <Select
                  value={regionFilter}
                  onChange={(event) => onRegionChange(event.target.value as AtlasRegionFilter)}
                  className="h-11 rounded-[18px] border-[rgba(47,92,69,0.08)] bg-[rgba(246,247,244,0.86)] shadow-none"
                >
                  {REGION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="space-y-1.5">
                <span className="text-[12px] text-[#6D7C6E]">状态</span>
                <Select
                  value={statusFilter}
                  onChange={(event) => onStatusChange(event.target.value as AtlasStatusFilter)}
                  className="h-11 rounded-[18px] border-[rgba(47,92,69,0.08)] bg-[rgba(246,247,244,0.86)] shadow-none"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="col-span-2 space-y-1.5">
                <span className="text-[12px] text-[#6D7C6E]">机构类型</span>
                <Select
                  value={typeFilter}
                  onChange={(event) => onTypeChange(event.target.value as AtlasInstitutionTypeFilter)}
                  className="h-11 rounded-[18px] border-[rgba(47,92,69,0.08)] bg-[rgba(246,247,244,0.86)] shadow-none"
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6D7C6E]">时间快照</p>
                <p className="mt-1 text-[13px] leading-6 text-[#6D7C6E]">当前快照 {formatDateLabel(selectedSnapshotDate)}</p>
              </div>

              {!isLatest ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onUseLatestSnapshot}
                  className="h-10 rounded-none border-x-0 border-t-0 border-b border-[rgba(47,107,59,0.18)] bg-transparent px-0 text-[13px] text-[#2F6B3B] shadow-none hover:bg-transparent hover:text-[#244F2D]"
                >
                  切到最新快照
                </Button>
              ) : (
                <span className="pt-1 text-[13px] leading-6 text-[#2F6B3B]">已是最新</span>
              )}
            </div>

            <Select
              value={selectedSnapshotDate}
              onChange={(event) => onSnapshotChange(event.target.value)}
              className="h-11 rounded-[18px] border-[rgba(47,92,69,0.08)] bg-[rgba(246,247,244,0.86)] shadow-none"
            >
              {orderedSnapshotDates.map((snapshotDate) => (
                <option key={snapshotDate} value={snapshotDate}>
                  {formatDateLabel(snapshotDate)}
                </option>
              ))}
            </Select>
          </section>

          <section className="border-t border-[rgba(47,92,69,0.08)] pt-4 text-[12px] leading-6 text-[#6D7C6E]">
            <p>{ATLAS_DATA_STATUS}</p>
            <p className="mt-1">{ATLAS_DATA_SOURCE}</p>
          </section>
        </div>
      </section>
    </div>
  );
}
